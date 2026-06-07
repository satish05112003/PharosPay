// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockPROS
 * @notice Mintable ERC20 token simulating $PROS on Pharos Atlantic Testnet.
 *         Anyone can mint for testing purposes.
 */
contract MockPROS is ERC20 {
    constructor() ERC20("Pharos Token", "PROS") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    /// @notice Anyone can mint testnet tokens (for testing only)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
