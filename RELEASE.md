# PharosPay Release Notes

## Current Status

PharosPay is currently in pre-release/testnet testing phase. The system contracts are fully deployed and operational on the Pharos Atlantic Testnet. The backend API server, database migrator, and transaction indexing event listener are fully functional. Payout executions are routed through a simulated settlement adapter mimicking UPI/PIX/PayNow settlement rails.

## Completed Components

* **On-Chain Contracts**:
  - `PharosPayRouter`: Handles token lockups, fee distribution, and payment registries.
  - `PriceOracle`: Admin-controlled multi-currency exchange rate feed registry.
  - `FeeVault`: Handles protocol fees collected in PROS.
  - `MockPROS`: Standard ERC20 token for testnet utility testing.
* **Backend Services**:
  - `EventListener`: Monitors blockchain block logs for `PaymentInitiated` event topics.
  - `SettlementEngine`: Job queue processor validating payment rails and initiating payouts.
  - `PriceService`: Multi-provider price service querying contracts, CoinGecko, and DexScreener with 30-second memory caching.
* **Frontend Web Application**:
  - Dynamic checkout wizard including country select, checkout details, QR scanner, quote reviews, and execution status tracking.
  - Historical lookup logs showing receipts with explorer hashes, payment channels, and exact execution conversion rates.
  - Merchant OS portal for registering beneficiaries and checking payouts.
  - Native wallet module showing PHRS/PROS balances, transaction details, and gas.

## Known Limitations

* **Simulated Settlement**: Local bank transfers are currently simulated rather than integrated with active commercial banking gateways.
* **Admin Key Centralization**: The Price Oracle pricing feeds and the Router fee configuration parameters are currently controlled by the deployer key.
* **Single Network Support**: Payout locks are only supported natively on the Pharos blockchain network.

## Future Work

* Production mainnet contracts audit and deployment.
* Commercial payout integrations (e.g. RazorpayX for UPI, PIX banking APIs for Brazil).
* Multi-signature or decentralized oracle pricing network (e.g., Pyth or Chainlink) for rate validation.
* Production KYC/KYB flow integration with compliance scoring.
* Dedicated merchant portals with customizable webhook endpoints.
* Multi-chain payment support via cross-chain messaging bridges.
