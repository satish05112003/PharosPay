// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/PharosPayRouter.sol";

/**
 * @title DeployPharosPayRouter
 * @notice Deploys the PharosPayRouter contract on Pharos Atlantic Testnet.
 *
 * Usage:
 *   forge script script/DeployPharosPayRouter.s.sol:DeployPharosPayRouter \
 *     --rpc-url https://atlantic.dplabs-internal.com \
 *     --private-key $PRIVATE_KEY --broadcast
 */
contract DeployPharosPayRouter is Script {
    // ⚠️ UPDATE THESE placeholder addresses before running the script!
    address constant MOCK_PROS_ADDRESS = 0x3E29AF7126051dC75B003fA10c4a9A315f2200C4;
    address constant PRICE_ORACLE_ADDRESS = 0xe2eD0C7c82195BC462A976dB198d973d395D9805;
    address constant FEE_VAULT_ADDRESS = 0x22F9D0109f43BB00b784147852fc0EA06bF5af82;

    function run() external {
        require(PRICE_ORACLE_ADDRESS != address(0), "Set PRICE_ORACLE_ADDRESS first!");
        require(FEE_VAULT_ADDRESS != address(0), "Set FEE_VAULT_ADDRESS first!");

        console.log("===================================");
        console.log("   Deploying PharosPayRouter Core  ");
        console.log("===================================");
        console.log("Deployer:         ", msg.sender);
        console.log("MockPROS:         ", MOCK_PROS_ADDRESS);
        console.log("PriceOracle:      ", PRICE_ORACLE_ADDRESS);
        console.log("FeeVault:         ", FEE_VAULT_ADDRESS);
        console.log("");

        vm.startBroadcast();
        PharosPayRouter router = new PharosPayRouter(
            MOCK_PROS_ADDRESS,
            PRICE_ORACLE_ADDRESS,
            FEE_VAULT_ADDRESS,
            200 // platform fee: 2% = 200 bps
        );
        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("PharosPayRouter deployed at:", address(router));
    }
}
