// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FeeVault
 * @notice Collects and holds PharosPay platform fees in PROS tokens.
 *         All fee deposits are recorded on-chain with payment IDs for full transparency.
 *         Only the owner (treasury multisig) can withdraw accumulated fees.
 */
contract FeeVault is Ownable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════════════════════════════

    /// @notice The PROS token used for fee collection
    IERC20 public immutable prosToken;

    /// @notice Total PROS fees collected since deployment
    uint256 public totalFeesCollected;

    /// @notice Total number of fee deposits
    uint256 public depositCount;

    // ═══════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════

    event FeeDeposited(
        address indexed from,
        uint256 amount,
        bytes32 indexed paymentId,
        uint256 timestamp
    );

    event FeeWithdrawn(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════════

    /// @param _prosToken Address of the PROS ERC20 token
    constructor(address _prosToken) Ownable(msg.sender) {
        require(_prosToken != address(0), "Invalid token address");
        prosToken = IERC20(_prosToken);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Fee Collection
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Deposit platform fee (called by PharosPayRouter during payment)
    /// @param amount Amount of PROS tokens to deposit as fee
    /// @param paymentId The payment ID this fee is associated with
    function depositFee(uint256 amount, bytes32 paymentId) external {
        require(amount > 0, "Amount must be > 0");
        prosToken.safeTransferFrom(msg.sender, address(this), amount);
        totalFeesCollected += amount;
        depositCount++;
        emit FeeDeposited(msg.sender, amount, paymentId, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Withdrawal (Owner Only)
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Withdraw accumulated PROS fees to owner
    /// @param amount Amount of PROS to withdraw
    function withdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        uint256 balance = prosToken.balanceOf(address(this));
        require(amount <= balance, "Exceeds vault balance");
        prosToken.safeTransfer(msg.sender, amount);
        emit FeeWithdrawn(msg.sender, amount, block.timestamp);
    }

    /// @notice Withdraw all accumulated PROS fees to owner
    function withdrawAll() external onlyOwner {
        uint256 balance = prosToken.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        prosToken.safeTransfer(msg.sender, balance);
        emit FeeWithdrawn(msg.sender, balance, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get current PROS balance held in vault
    function getBalance() external view returns (uint256) {
        return prosToken.balanceOf(address(this));
    }
}
