// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/FeeVault.sol";

/**
 * @title DeployFeeVault
 * @notice Deploys the FeeVault treasury contract on Pharos Atlantic Testnet.
 *
 * Usage:
 *   forge script script/DeployFeeVault.s.sol:DeployFeeVault \
 *     --rpc-url https://atlantic.dplabs-internal.com \
 *     --private-key $PRIVATE_KEY --broadcast
 */
contract DeployFeeVault is Script {
    // Already deployed MockPROS token address on Pharos Testnet
    address constant MOCK_PROS = 0x3E29AF7126051dC75B003fA10c4a9A315f2200C4;

    function run() external {
        console.log("===================================");
        console.log("     Deploying PharosPay FeeVault   ");
        console.log("===================================");
        console.log("Deployer:      ", msg.sender);
        console.log("MockPROS Token:", MOCK_PROS);
        console.log("");

        vm.startBroadcast();
        FeeVault feeVault = new FeeVault(MOCK_PROS);
        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("FeeVault deployed at:", address(feeVault));
    }
}
