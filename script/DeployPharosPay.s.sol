// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockPROS.sol";
import "../src/PriceOracle.sol";
import "../src/FeeVault.sol";
import "../src/PharosPayRouter.sol";

/**
 * @title DeployPharosPay
 * @notice Deploys the complete PharosPay system to Pharos Atlantic Testnet.
 *
 * Usage:
 *   forge script script/DeployPharosPay.s.sol:DeployPharosPay \
 *     --rpc-url https://atlantic.dplabs-internal.com \
 *     --private-key $PRIVATE_KEY --broadcast
 */
contract DeployPharosPay is Script {
    function run() external {
        console.log("===================================");
        console.log("  PharosPay Full System Deployment  ");
        console.log("===================================");
        console.log("");
        console.log("Deployer:", msg.sender);
        console.log("");

        vm.startBroadcast();

        // ─── 1. Deploy MockPROS ──────────────────────────────────────
        MockPROS mockPros = new MockPROS();
        console.log("[1/4] MockPROS deployed at:", address(mockPros));

        // ─── 2. Deploy PriceOracle ───────────────────────────────────
        PriceOracle priceOracle = new PriceOracle();
        console.log("[2/4] PriceOracle deployed at:", address(priceOracle));

        // ─── 3. Deploy FeeVault ──────────────────────────────────────
        FeeVault feeVault = new FeeVault(address(mockPros));
        console.log("[3/4] FeeVault deployed at:", address(feeVault));

        // ─── 4. Deploy PharosPayRouter ───────────────────────────────
        PharosPayRouter router = new PharosPayRouter(
            address(mockPros),
            address(priceOracle),
            address(feeVault),
            200 // platform fee: 2% = 200 basis points
        );
        console.log("[4/4] PharosPayRouter deployed at:", address(router));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("MockPROS:         ", address(mockPros));
        console.log("PriceOracle:      ", address(priceOracle));
        console.log("FeeVault:         ", address(feeVault));
        console.log("PharosPayRouter:  ", address(router));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Set PRICE_ORACLE address in script/SetPrices.s.sol and run it.");
        console.log("2. Update frontend/src/config.js and backend/.env with these addresses.");
    }
}
