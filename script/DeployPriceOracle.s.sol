// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/PriceOracle.sol";

/**
 * @title DeployPriceOracle
 * @notice Deploys the PriceOracle contract on Pharos Atlantic Testnet.
 *
 * Usage:
 *   forge script script/DeployPriceOracle.s.sol:DeployPriceOracle \
 *     --rpc-url https://atlantic.dplabs-internal.com \
 *     --private-key $PRIVATE_KEY --broadcast
 */
contract DeployPriceOracle is Script {
    function run() external {
        console.log("===================================");
        console.log("   Deploying PharosPay PriceOracle  ");
        console.log("===================================");
        console.log("Deployer:", msg.sender);
        console.log("");

        vm.startBroadcast();
        PriceOracle priceOracle = new PriceOracle();
        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("PriceOracle deployed at:", address(priceOracle));
    }
}
