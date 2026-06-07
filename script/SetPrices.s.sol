// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title SetPrices
 * @notice Configures initial price feeds on the PriceOracle contract.
 *
 * Sets realistic exchange rates (8 decimal precision, Chainlink-style):
 *   - PROS/USD = $0.214
 *   - USD/INR = ₹83.56
 *   - USD/BRL = R$5.12
 *   - USD/SGD = S$1.34
 *   - USD/THB = ฿35.20
 *   - USD/IDR = Rp15,700
 *   - USD/GBP = £0.79
 *   - USD/EUR = €0.92
 *   - USD/JPY = ¥154.50
 *   - USD/USD = $1.00
 *
 * Usage:
 *   forge script script/SetPrices.s.sol:SetPrices \
 *     --rpc-url https://atlantic.dplabs-internal.com \
 *     --private-key $PRIVATE_KEY --broadcast
 */

interface IPriceOracleAdmin {
    function setPrices(string[] calldata pairs, uint256[] calldata prices) external;
}

contract SetPrices is Script {
    // ⚠️ UPDATE THIS after deploying PriceOracle
    address constant PRICE_ORACLE = 0xe2eD0C7c82195BC462A976dB198d973d395D9805; // TODO: Set after deployment

    function run() external {
        require(PRICE_ORACLE != address(0), "Set PRICE_ORACLE address first!");

        console.log("=== Setting PharosPay Oracle Prices ===");
        console.log("Oracle:", PRICE_ORACLE);
        console.log("");

        // Build price arrays
        string[] memory pairs = new string[](10);
        uint256[] memory prices = new uint256[](10);

        pairs[0] = "PROS/USD";   prices[0] = 21_400_000;         // $0.214
        pairs[1] = "USD/INR";   prices[1] = 8_356_000_000;       // ₹83.56
        pairs[2] = "USD/BRL";   prices[2] = 512_000_000;         // R$5.12
        pairs[3] = "USD/SGD";   prices[3] = 134_000_000;         // S$1.34
        pairs[4] = "USD/THB";   prices[4] = 3_520_000_000;       // ฿35.20
        pairs[5] = "USD/IDR";   prices[5] = 1_570_000_000_000;   // Rp15,700
        pairs[6] = "USD/GBP";   prices[6] = 79_000_000;          // £0.79
        pairs[7] = "USD/EUR";   prices[7] = 92_000_000;          // €0.92
        pairs[8] = "USD/JPY";   prices[8] = 15_450_000_000;      // ¥154.50
        pairs[9] = "USD/USD";   prices[9] = 100_000_000;         // $1.00

        vm.startBroadcast();

        IPriceOracleAdmin(PRICE_ORACLE).setPrices(pairs, prices);

        vm.stopBroadcast();

        console.log("Prices set successfully!");
        for (uint256 i = 0; i < pairs.length; i++) {
            console.log(" ", pairs[i], "=", prices[i]);
        }
    }
}
