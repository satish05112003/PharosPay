// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @notice Admin-updatable multi-pair price oracle simulating Chainlink/Pyth feeds.
 *         Stores price feeds with 8-decimal precision and provides PROS conversion quotes.
 *
 *         Supported pairs: PROS/USD, USD/INR, USD/BRL, USD/SGD, USD/USD, etc.
 *         Example: PROS/USD = 21400000 means $0.214 per PROS (8 decimal places).
 */
contract PriceOracle is Ownable {
    // ═══════════════════════════════════════════════════════════════════
    //  Types
    // ═══════════════════════════════════════════════════════════════════

    struct PriceFeed {
        uint256 price;       // 8 decimal precision (Chainlink-style)
        uint256 updatedAt;   // Timestamp of last update
        string  pair;        // Human-readable pair name
    }

    // ═══════════════════════════════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Price feed storage: keccak256(pair) => PriceFeed
    mapping(bytes32 => PriceFeed) public feeds;

    /// @notice List of registered pair keys for enumeration
    bytes32[] public pairKeys;
    mapping(bytes32 => bool) public pairRegistered;

    // ═══════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════

    event PriceUpdated(string indexed pair, uint256 price, uint256 timestamp);

    // ═══════════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════
    //  Admin: Set Prices
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Set a price feed for a given pair
    /// @param pair Human-readable pair (e.g., "PROS/USD", "USD/INR")
    /// @param price Price with 8 decimal precision
    function setPrice(string calldata pair, uint256 price) external onlyOwner {
        require(price > 0, "Price must be > 0");
        bytes32 key = keccak256(abi.encodePacked(pair));
        feeds[key] = PriceFeed(price, block.timestamp, pair);

        if (!pairRegistered[key]) {
            pairKeys.push(key);
            pairRegistered[key] = true;
        }

        emit PriceUpdated(pair, price, block.timestamp);
    }

    /// @notice Batch set multiple price feeds in one transaction
    /// @param pairs Array of pair names
    /// @param prices Array of prices (8 decimal precision)
    function setPrices(string[] calldata pairs, uint256[] calldata prices) external onlyOwner {
        require(pairs.length == prices.length, "Length mismatch");
        for (uint256 i = 0; i < pairs.length; i++) {
            require(prices[i] > 0, "Price must be > 0");
            bytes32 key = keccak256(abi.encodePacked(pairs[i]));
            feeds[key] = PriceFeed(prices[i], block.timestamp, pairs[i]);

            if (!pairRegistered[key]) {
                pairKeys.push(key);
                pairRegistered[key] = true;
            }

            emit PriceUpdated(pairs[i], prices[i], block.timestamp);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Read: Get Prices
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get the current price for a pair
    /// @param pair The pair name (e.g., "PROS/USD")
    /// @return price The price (8 decimals)
    /// @return updatedAt Timestamp of last update
    function getPrice(string calldata pair) external view returns (uint256 price, uint256 updatedAt) {
        bytes32 key = keccak256(abi.encodePacked(pair));
        PriceFeed memory f = feeds[key];
        require(f.updatedAt > 0, "Price not set");
        return (f.price, f.updatedAt);
    }

    /// @notice Calculate PROS tokens needed for a given fiat amount
    /// @dev Conversion: fiatAmount → USD (via fiatPair) → PROS (via PROS/USD)
    /// @param fiatAmount Amount in fiat currency (18 decimals)
    /// @param fiatPair The USD/fiat pair (e.g., "USD/INR" where price = how many fiat per 1 USD)
    /// @return prosAmount PROS tokens needed (18 decimals)
    function quotePROS(
        uint256 fiatAmount,
        string calldata fiatPair
    ) external view returns (uint256 prosAmount) {
        bytes32 prosKey = keccak256(abi.encodePacked("PROS/USD"));
        bytes32 fiatKey = keccak256(abi.encodePacked(fiatPair));

        PriceFeed memory prosFeed = feeds[prosKey];
        PriceFeed memory fiatFeed = feeds[fiatKey];

        require(prosFeed.updatedAt > 0, "PROS/USD price not set");
        require(fiatFeed.updatedAt > 0, "Fiat pair price not set");

        // Step 1: Convert fiat to USD
        // fiatFeed.price = how many fiat units per 1 USD (8 decimals)
        // usdAmount = fiatAmount / fiatRate
        // fiatAmount is 18 dec, fiatFeed.price is 8 dec
        // usdAmount (18 dec) = fiatAmount * 1e8 / fiatFeed.price
        uint256 usdAmount = (fiatAmount * 1e8) / fiatFeed.price;

        // Step 2: Convert USD to PROS
        // prosFeed.price = price of 1 PROS in USD (8 decimals)
        // prosAmount = usdAmount / prosPrice
        // prosAmount (18 dec) = usdAmount * 1e8 / prosFeed.price
        prosAmount = (usdAmount * 1e8) / prosFeed.price;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View: Pair Count
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get the number of registered price pairs
    function getPairCount() external view returns (uint256) {
        return pairKeys.length;
    }
}
