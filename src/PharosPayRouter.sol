// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PharosPayRouter
 * @notice Core payment router for PharosPay — the crypto-to-fiat payment skill on Pharos Network.
 *
 *         Processes payments by:
 *         1. Querying the PriceOracle for real-time PROS/fiat conversion
 *         2. Deducting PROS tokens from the user (merchant amount + platform fee)
 *         3. Sending the platform fee to the FeeVault treasury
 *         4. Emitting a SettlementSimulated event (fiat settlement is simulated for MVP)
 *         5. Recording the full payment on-chain for transparency
 *
 *         Fee: Configurable 1–5% (default 2% = 200 bps), deducted atomically.
 *         Treasury: All fees go to immutable FeeVault contract.
 */

interface IPriceOracle {
    function quotePROS(uint256 fiatAmount, string calldata fiatPair) external view returns (uint256);
    function getPrice(string calldata pair) external view returns (uint256 price, uint256 updatedAt);
}

interface IFeeVault {
    function depositFee(uint256 amount, bytes32 paymentId) external;
}

contract PharosPayRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════
    //  Constants
    // ═══════════════════════════════════════════════════════════════════

    uint256 public constant MAX_FEE_BPS = 500;   // 5% maximum fee
    uint256 public constant MIN_FEE_BPS = 100;   // 1% minimum fee
    uint256 public constant BPS = 10_000;         // Basis points denominator

    // ═══════════════════════════════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════════════════════════════

    IERC20 public immutable prosToken;
    IPriceOracle public priceOracle;
    IFeeVault public feeVault;

    /// @notice Platform fee in basis points (200 = 2%)
    uint256 public feeRateBps;

    /// @notice Total number of payments processed
    uint256 public paymentCount;

    /// @notice Total PROS volume processed
    uint256 public totalVolumeProcessed;

    /// @notice Payment record
    struct Payment {
        bytes32         id;
        address         payer;
        string          merchantId;       // UPI VPA, PIX key, PayNow ID, etc.
        string          merchantName;     // Human-readable merchant name
        string          fiatCurrency;     // ISO 4217: "INR", "BRL", "USD", etc.
        uint256         fiatAmount;       // Amount in fiat (18 decimals)
        uint256         prosAmount;       // Total PROS deducted from user
        uint256         feeAmount;        // PROS sent to treasury
        uint256         merchantPros;     // PROS representing merchant value
        string          paymentRail;      // "UPI", "PIX", "SEPA", "ACH", etc.
        string          country;          // ISO 3166-1: "IN", "BR", "US", etc.
        uint256         timestamp;
        PaymentStatus   status;
    }

    enum PaymentStatus { PENDING, SETTLED, FAILED }

    /// @notice Payment storage: paymentId => Payment
    mapping(bytes32 => Payment) public payments;

    /// @notice User payment history: user address => paymentId[]
    mapping(address => bytes32[]) public userPayments;

    // ═══════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════

    event PaymentInitiated(
        bytes32 indexed paymentId,
        address indexed payer,
        string  merchantId,
        string  merchantName,
        string  fiatCurrency,
        uint256 fiatAmount,
        uint256 prosAmount,
        uint256 feeAmount,
        string  paymentRail,
        string  country
    );

    event SettlementSimulated(
        bytes32 indexed paymentId,
        string  merchantId,
        string  fiatCurrency,
        uint256 fiatAmount,
        string  paymentRail,
        string  country,
        uint256 timestamp
    );

    event PaymentSettlementConfirmed(
        bytes32 indexed paymentId,
        bytes32 settlementReference,
        uint256 confirmedAt
    );

    event PaymentRefunded(
        bytes32 indexed paymentId,
        string reason,
        uint256 refundedAt
    );

    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event OracleUpdated(address oldOracle, address newOracle);

    // ═══════════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════════

    /// @param _prosToken Address of the PROS ERC20 token
    /// @param _priceOracle Address of the PriceOracle contract
    /// @param _feeVault Address of the FeeVault treasury contract
    /// @param _feeRateBps Initial platform fee in basis points (e.g., 200 = 2%)
    constructor(
        address _prosToken,
        address _priceOracle,
        address _feeVault,
        uint256 _feeRateBps
    ) Ownable(msg.sender) {
        require(_prosToken != address(0), "Invalid PROS token");
        require(_priceOracle != address(0), "Invalid oracle");
        require(_feeVault != address(0), "Invalid fee vault");
        require(_feeRateBps >= MIN_FEE_BPS && _feeRateBps <= MAX_FEE_BPS, "Fee out of range");

        prosToken = IERC20(_prosToken);
        priceOracle = IPriceOracle(_priceOracle);
        feeVault = IFeeVault(_feeVault);
        feeRateBps = _feeRateBps;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Core: Execute Payment
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Execute a crypto-to-fiat payment
    /// @param merchantId The merchant's payment identifier (UPI VPA, PIX key, etc.)
    /// @param merchantName Human-readable merchant name
    /// @param fiatCurrency ISO 4217 currency code ("INR", "BRL", "USD")
    /// @param fiatAmount Amount in fiat currency (18 decimals)
    /// @param fiatPair Oracle pair for USD conversion (e.g., "USD/INR")
    /// @param paymentRail Settlement rail identifier ("UPI", "PIX", "SEPA", etc.)
    /// @param country ISO 3166-1 country code ("IN", "BR", "US", etc.)
    /// @return paymentId Unique payment identifier
    function pay(
        string calldata merchantId,
        string calldata merchantName,
        string calldata fiatCurrency,
        uint256 fiatAmount,
        string calldata fiatPair,
        string calldata paymentRail,
        string calldata country
    ) external nonReentrant returns (bytes32 paymentId) {
        require(fiatAmount > 0, "Amount must be > 0");
        require(bytes(merchantId).length > 0, "Empty merchantId");

        // 1. Get PROS quote for the merchant amount
        string memory actualPair = getPairString(fiatCurrency);
        uint256 merchantPros = priceOracle.quotePROS(fiatAmount, actualPair);
        require(merchantPros > 0, "Invalid oracle quote");

        // 2. Calculate platform fee
        uint256 feeAmount = (merchantPros * feeRateBps) / BPS;
        uint256 totalPros = merchantPros + feeAmount;

        // 3. Generate unique payment ID
        paymentCount++;
        paymentId = keccak256(abi.encodePacked(
            msg.sender, merchantId, fiatAmount, block.timestamp, paymentCount
        ));

        // 4. Update state (Effects)
        totalVolumeProcessed += totalPros;

        payments[paymentId] = Payment({
            id: paymentId,
            payer: msg.sender,
            merchantId: merchantId,
            merchantName: merchantName,
            fiatCurrency: fiatCurrency,
            fiatAmount: fiatAmount,
            prosAmount: totalPros,
            feeAmount: feeAmount,
            merchantPros: merchantPros,
            paymentRail: paymentRail,
            country: country,
            timestamp: block.timestamp,
            status: PaymentStatus.PENDING
        });
        userPayments[msg.sender].push(paymentId);

        // 5. Transfer total PROS from user to this contract (Interactions)
        prosToken.safeTransferFrom(msg.sender, address(this), totalPros);

        // 6. Send fee portion to FeeVault (only if fee is > 0)
        if (feeAmount > 0) {
            prosToken.forceApprove(address(feeVault), feeAmount);
            feeVault.depositFee(feeAmount, paymentId);
        }

        // 8. Emit events
        emit PaymentInitiated(
            paymentId, msg.sender, merchantId, merchantName,
            fiatCurrency, fiatAmount, totalPros, feeAmount,
            paymentRail, country
        );

        emit SettlementSimulated(
            paymentId, merchantId, fiatCurrency,
            fiatAmount, paymentRail, country, block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View: Quotes
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get a payment quote without executing
    /// @param fiatAmount Amount in fiat currency (18 decimals)
    /// @param fiatPair Oracle pair for conversion (e.g., "USD/INR")
    /// @return merchantPros PROS representing merchant value
    /// @return feeAmount PROS fee for treasury
    /// @return totalPros Total PROS user will pay
    /// @return feeRateBpsUsed Fee rate applied
    function getQuote(
        uint256 fiatAmount,
        string calldata fiatPair
    ) external view returns (
        uint256 merchantPros,
        uint256 feeAmount,
        uint256 totalPros,
        uint256 feeRateBpsUsed
    ) {
        string memory actualPair = getPairString(fiatPair);
        merchantPros = priceOracle.quotePROS(fiatAmount, actualPair);
        feeAmount = (merchantPros * feeRateBps) / BPS;
        totalPros = merchantPros + feeAmount;
        feeRateBpsUsed = feeRateBps;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View: Payment History
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get a specific payment record
    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    /// @notice Get all payment IDs for a user
    function getUserPayments(address user) external view returns (bytes32[] memory) {
        return userPayments[user];
    }

    /// @notice Get the number of payments for a user
    function getUserPaymentCount(address user) external view returns (uint256) {
        return userPayments[user].length;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Update the platform fee rate
    /// @param _feeRateBps New fee rate in basis points (100-500)
    function setFeeRate(uint256 _feeRateBps) external onlyOwner {
        require(_feeRateBps >= MIN_FEE_BPS && _feeRateBps <= MAX_FEE_BPS, "Fee out of range");
        emit FeeRateUpdated(feeRateBps, _feeRateBps);
        feeRateBps = _feeRateBps;
    }

    /// @notice Update the price oracle address
    /// @param _oracle New oracle contract address
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        emit OracleUpdated(address(priceOracle), _oracle);
        priceOracle = IPriceOracle(_oracle);
    }

    /// @notice Confirm fiat settlement and set payment status to SETTLED
    /// @param paymentId On-chain payment ID
    /// @param settlementReference Hashed reference number
    function confirmSettlement(
        bytes32 paymentId,
        bytes32 settlementReference
    ) external onlyOwner {
        require(payments[paymentId].id != bytes32(0), "Payment not found");
        payments[paymentId].status = PaymentStatus.SETTLED;
        emit PaymentSettlementConfirmed(paymentId, settlementReference, block.timestamp);
    }

    /// @notice Refund payment to payer on settlement failure
    /// @param paymentId On-chain payment ID
    /// @param reason Failure reasoning
    function refundPROS(
        bytes32 paymentId,
        string calldata reason
    ) external onlyOwner {
        Payment storage payment = payments[paymentId];
        require(payment.id != bytes32(0), "Payment not found");
        require(payment.status != PaymentStatus.FAILED, "Already failed/refunded");

        payment.status = PaymentStatus.FAILED;

        // Refund total PROS deducted (payment.prosAmount) to payer
        prosToken.safeTransfer(payment.payer, payment.prosAmount);

        emit PaymentRefunded(paymentId, reason, block.timestamp);
    }

    /// @notice Helper to parse 3-letter fiat currency code into a standard oracle pair string (e.g. INR -> USD/INR)
    function getPairString(string memory currencyOrPair) internal pure returns (string memory) {
        if (bytes(currencyOrPair).length == 3) {
            return string.concat("USD/", currencyOrPair);
        }
        return currencyOrPair;
    }
}
