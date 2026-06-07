// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MockPROS.sol";
import "../src/PriceOracle.sol";
import "../src/FeeVault.sol";
import "../src/PharosPayRouter.sol";

/**
 * @title PharosPayRouterTest
 * @notice Comprehensive tests for the PharosPay payment flow.
 */
contract PharosPayRouterTest is Test {
    MockPROS public pros;
    PriceOracle public oracle;
    FeeVault public vault;
    PharosPayRouter public router;

    address public deployer = address(this);
    address public user = address(0xBEEF);
    address public user2 = address(0xCAFE);

    uint256 constant FEE_RATE = 200; // 2%
    uint256 constant MINT_AMOUNT = 100_000 * 1e18;

    // ═══════════════════════════════════════════════════════════════════
    //  Setup
    // ═══════════════════════════════════════════════════════════════════

    function setUp() public {
        // Deploy contracts
        pros = new MockPROS();
        oracle = new PriceOracle();
        vault = new FeeVault(address(pros));
        router = new PharosPayRouter(
            address(pros),
            address(oracle),
            address(vault),
            FEE_RATE
        );

        // Set oracle prices (8 decimal precision)
        oracle.setPrice("PROS/USD", 21_400_000);      // $0.214 per PROS
        oracle.setPrice("USD/INR", 8_356_000_000);     // ₹83.56 per USD
        oracle.setPrice("USD/BRL", 512_000_000);       // R$5.12 per USD
        oracle.setPrice("USD/USD", 100_000_000);       // $1.00 per USD

        // Mint PROS to test users
        pros.mint(user, MINT_AMOUNT);
        pros.mint(user2, MINT_AMOUNT);

        // User approves Router to spend PROS
        vm.prank(user);
        pros.approve(address(router), type(uint256).max);

        vm.prank(user2);
        pros.approve(address(router), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Full Payment Flow
    // ═══════════════════════════════════════════════════════════════════

    function testPaymentFlowINR() public {
        uint256 fiatAmount = 100 * 1e18; // ₹100

        // Get quote first
        (uint256 merchantPros, uint256 feeAmount, uint256 totalPros,) =
            router.getQuote(fiatAmount, "USD/INR");

        assertGt(merchantPros, 0, "Merchant PROS should be > 0");
        assertGt(feeAmount, 0, "Fee should be > 0");
        assertEq(totalPros, merchantPros + feeAmount, "Total should be merchant + fee");

        // Record balances before
        uint256 userBalBefore = pros.balanceOf(user);
        uint256 vaultBalBefore = pros.balanceOf(address(vault));

        // Execute payment
        vm.prank(user);
        bytes32 paymentId = router.pay(
            "chaiwala@ybl",
            "Chai Wala",
            "INR",
            fiatAmount,
            "USD/INR",
            "UPI",
            "IN"
        );

        // Verify user balance decreased by totalPros
        assertEq(
            pros.balanceOf(user),
            userBalBefore - totalPros,
            "User balance should decrease by totalPros"
        );

        // Verify vault received fee
        assertEq(
            pros.balanceOf(address(vault)),
            vaultBalBefore + feeAmount,
            "Vault should receive fee amount"
        );

        // Verify payment record
        PharosPayRouter.Payment memory p = router.getPayment(paymentId);
        assertEq(p.payer, user);
        assertEq(keccak256(bytes(p.merchantId)), keccak256(bytes("chaiwala@ybl")));
        assertEq(keccak256(bytes(p.fiatCurrency)), keccak256(bytes("INR")));
        assertEq(p.fiatAmount, fiatAmount);
        assertEq(p.prosAmount, totalPros);
        assertEq(p.feeAmount, feeAmount);
        assertEq(uint256(p.status), uint256(PharosPayRouter.PaymentStatus.SETTLED));

        // Verify payment count
        assertEq(router.paymentCount(), 1);
    }

    function testPaymentFlowBRL() public {
        uint256 fiatAmount = 50 * 1e18; // R$50

        vm.prank(user);
        bytes32 paymentId = router.pay(
            "pix:11999887766",
            "Cafe Brasil",
            "BRL",
            fiatAmount,
            "USD/BRL",
            "PIX",
            "BR"
        );

        PharosPayRouter.Payment memory p = router.getPayment(paymentId);
        assertEq(keccak256(bytes(p.paymentRail)), keccak256(bytes("PIX")));
        assertEq(keccak256(bytes(p.country)), keccak256(bytes("BR")));
    }

    function testPaymentFlowUSD() public {
        uint256 fiatAmount = 10 * 1e18; // $10

        vm.prank(user);
        bytes32 paymentId = router.pay(
            "merchant@ach",
            "Demo Store",
            "USD",
            fiatAmount,
            "USD/USD",
            "ACH",
            "US"
        );

        PharosPayRouter.Payment memory p = router.getPayment(paymentId);
        assertEq(keccak256(bytes(p.paymentRail)), keccak256(bytes("ACH")));
        assertEq(keccak256(bytes(p.country)), keccak256(bytes("US")));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Quote Calculation
    // ═══════════════════════════════════════════════════════════════════

    function testQuoteCalculation() public view {
        uint256 fiatAmount = 100 * 1e18; // ₹100

        (uint256 merchantPros, uint256 feeAmount, uint256 totalPros, uint256 feeBps) =
            router.getQuote(fiatAmount, "USD/INR");

        // ₹100 / 83.56 = ~$1.1967 USD
        // $1.1967 / $0.214 = ~5.592 PROS
        assertGt(merchantPros, 5 * 1e18, "PROS should be > 5");
        assertLt(merchantPros, 6 * 1e18, "PROS should be < 6");

        // Fee = 2% of merchantPros
        assertEq(feeAmount, (merchantPros * 200) / 10_000, "Fee should be 2%");
        assertEq(totalPros, merchantPros + feeAmount, "Total = merchant + fee");
        assertEq(feeBps, 200, "Fee rate should be 200 bps");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Fee Collection
    // ═══════════════════════════════════════════════════════════════════

    function testFeeCollection() public {
        uint256 fiatAmount = 1000 * 1e18; // ₹1000 (larger amount)

        (, uint256 expectedFee,,) = router.getQuote(fiatAmount, "USD/INR");

        vm.prank(user);
        router.pay("merchant@upi", "Big Store", "INR", fiatAmount, "USD/INR", "UPI", "IN");

        // Verify FeeVault state
        assertEq(vault.totalFeesCollected(), expectedFee, "Vault total should match fee");
        assertEq(vault.depositCount(), 1, "Should have 1 deposit");
        assertEq(pros.balanceOf(address(vault)), expectedFee, "Vault PROS balance should match");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Payment History
    // ═══════════════════════════════════════════════════════════════════

    function testPaymentHistory() public {
        // User makes 3 payments
        vm.startPrank(user);

        router.pay("merchant1@upi", "Shop 1", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");
        router.pay("merchant2@upi", "Shop 2", "INR", 200 * 1e18, "USD/INR", "UPI", "IN");
        router.pay("merchant3@pix", "Shop 3", "BRL", 50 * 1e18, "USD/BRL", "PIX", "BR");

        vm.stopPrank();

        // Verify history
        bytes32[] memory history = router.getUserPayments(user);
        assertEq(history.length, 3, "Should have 3 payments");
        assertEq(router.getUserPaymentCount(user), 3, "Count should be 3");
        assertEq(router.paymentCount(), 3, "Global count should be 3");

        // User2 should have no payments
        assertEq(router.getUserPaymentCount(user2), 0, "User2 should have 0 payments");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Volume Tracking
    // ═══════════════════════════════════════════════════════════════════

    function testVolumeTracking() public {
        (, , uint256 total1,) = router.getQuote(100 * 1e18, "USD/INR");
        (, , uint256 total2,) = router.getQuote(200 * 1e18, "USD/INR");

        vm.startPrank(user);
        router.pay("m1@upi", "S1", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");
        router.pay("m2@upi", "S2", "INR", 200 * 1e18, "USD/INR", "UPI", "IN");
        vm.stopPrank();

        assertEq(router.totalVolumeProcessed(), total1 + total2, "Volume should match");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Reverts
    // ═══════════════════════════════════════════════════════════════════

    function testRevertZeroAmount() public {
        vm.prank(user);
        vm.expectRevert("Amount must be > 0");
        router.pay("merchant@upi", "Shop", "INR", 0, "USD/INR", "UPI", "IN");
    }

    function testRevertEmptyMerchantId() public {
        vm.prank(user);
        vm.expectRevert("Empty merchantId");
        router.pay("", "Shop", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");
    }

    function testRevertInsufficientBalance() public {
        address poorUser = address(0xDEAD);
        pros.mint(poorUser, 1); // Only 1 wei of PROS

        vm.startPrank(poorUser);
        pros.approve(address(router), type(uint256).max);

        vm.expectRevert(); // SafeERC20: insufficient balance
        router.pay("merchant@upi", "Shop", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");
        vm.stopPrank();
    }

    function testRevertNoApproval() public {
        address noApprovalUser = address(0xFACE);
        pros.mint(noApprovalUser, MINT_AMOUNT);
        // No approval given

        vm.prank(noApprovalUser);
        vm.expectRevert(); // SafeERC20: insufficient allowance
        router.pay("merchant@upi", "Shop", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");
    }

    function testRevertInvalidOraclePair() public {
        vm.prank(user);
        vm.expectRevert("Fiat pair price not set");
        router.pay("merchant@upi", "Shop", "KRW", 100 * 1e18, "USD/KRW", "KakaoPay", "KR");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Admin Functions
    // ═══════════════════════════════════════════════════════════════════

    function testFeeRateUpdateByOwner() public {
        router.setFeeRate(300); // 3%
        assertEq(router.feeRateBps(), 300);

        router.setFeeRate(100); // 1%
        assertEq(router.feeRateBps(), 100);
    }

    function testFeeRateUpdateByNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setFeeRate(300);
    }

    function testFeeRateOutOfRange() public {
        vm.expectRevert("Fee out of range");
        router.setFeeRate(600); // 6% > MAX_FEE

        vm.expectRevert("Fee out of range");
        router.setFeeRate(50); // 0.5% < MIN_FEE
    }

    function testOracleUpdateByOwner() public {
        PriceOracle newOracle = new PriceOracle();
        router.setOracle(address(newOracle));
        assertEq(address(router.priceOracle()), address(newOracle));
    }

    function testOracleUpdateByNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setOracle(address(0x1234));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Events
    // ═══════════════════════════════════════════════════════════════════

    function testPaymentEmitsEvents() public {
        uint256 fiatAmount = 100 * 1e18;
        (uint256 merchantPros, uint256 feeAmount, uint256 totalPros,) =
            router.getQuote(fiatAmount, "USD/INR");

        vm.prank(user);

        // We just verify the call succeeds and emits (exact event checking
        // requires knowing the paymentId, which is computed inside pay())
        vm.recordLogs();
        router.pay("chaiwala@ybl", "Chai Wala", "INR", fiatAmount, "USD/INR", "UPI", "IN");

        Vm.Log[] memory logs = vm.getRecordedLogs();
        // Should have at least: Transfer (user→router), Approve, Transfer (router→vault),
        // FeeDeposited, PaymentInitiated, SettlementSimulated
        assertGe(logs.length, 4, "Should emit multiple events");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: FeeVault Withdrawal
    // ═══════════════════════════════════════════════════════════════════

    function testVaultWithdrawal() public {
        // Make a payment to generate fees
        vm.prank(user);
        router.pay("merchant@upi", "Shop", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");

        uint256 vaultBal = pros.balanceOf(address(vault));
        assertGt(vaultBal, 0);

        uint256 ownerBalBefore = pros.balanceOf(deployer);
        vault.withdraw(vaultBal);
        assertEq(pros.balanceOf(deployer), ownerBalBefore + vaultBal);
    }

    function testVaultWithdrawAll() public {
        vm.prank(user);
        router.pay("merchant@upi", "Shop", "INR", 500 * 1e18, "USD/INR", "UPI", "IN");

        uint256 vaultBal = pros.balanceOf(address(vault));
        uint256 ownerBalBefore = pros.balanceOf(deployer);

        vault.withdrawAll();

        assertEq(pros.balanceOf(address(vault)), 0);
        assertEq(pros.balanceOf(deployer), ownerBalBefore + vaultBal);
    }

    function testVaultWithdrawByNonOwner() public {
        vm.prank(user);
        router.pay("merchant@upi", "Shop", "INR", 100 * 1e18, "USD/INR", "UPI", "IN");

        vm.prank(user);
        vm.expectRevert();
        vault.withdraw(1);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Test: Micro Payouts (Zero Platform Fee)
    // ═══════════════════════════════════════════════════════════════════

    function testTinyPaymentZeroFeeFlow() public {
        uint256 tinyAmount = 100; // 100 Wei of fiat

        (, uint256 feeAmount,,) = router.getQuote(tinyAmount, "USD/INR");
        assertEq(feeAmount, 0, "Fee should be exactly 0 for tiny amounts");

        uint256 vaultBalBefore = pros.balanceOf(address(vault));

        vm.prank(user);
        bytes32 paymentId = router.pay(
            "tiny@upi",
            "Tiny Store",
            "INR",
            tinyAmount,
            "USD/INR",
            "UPI",
            "IN"
        );

        // Verify transaction completes successfully
        PharosPayRouter.Payment memory p = router.getPayment(paymentId);
        assertEq(p.feeAmount, 0);
        assertEq(uint256(p.status), uint256(PharosPayRouter.PaymentStatus.SETTLED));
        assertEq(pros.balanceOf(address(vault)), vaultBalBefore, "Vault balance should not change");
    }
}
