# PharosPay — Bounty Submission Package

This document contains the official metadata, descriptions, architecture overviews, and usage instructions required for the Pharos Skill Builder bounty submission.

---

## 1. Submission Metadata

* **Skill Name:** PharosPay
* **Supported Framework:** Pharos Agent Centre Skill
* **GitHub Repository:** `d:\Predictions\PharosPay`

---

## 2. Descriptions

### Short Description (Max 200 chars)
Pay any traditional merchant (UPI, PIX, ACH) instantly using $PROS tokens. PharosPay bridges web3 liquidity directly to legacy bank rails with on-chain price oracles and transparent fee models.

### Long Description
PharosPay is a next-generation crypto-to-fiat payment protocol built on the Pharos Network that enables crypto-native users to spend their digital assets at everyday retail shops. By scanning a merchant’s standard payment QR code (such as India's UPI, Brazil's PIX, or Singapore's PayNow), users can pay in $PROS tokens while the merchant receives the exact local fiat currency in their legacy bank account. 

Traditional payment setups require merchants to undergo complex web3 onboarding, accept price volatility, or manage wallet private keys. PharosPay completely eliminates merchant friction: they keep their existing banking and QR code infrastructure unchanged. 

The core protocol handles real-time fiat-to-token calculations via an on-chain `PriceOracle`, splits a 2% platform fee to a secure `FeeVault` treasury, and executes payment processing atomically.
* **MockPROS (Token):** `0x3E29AF7126051dC75B003fA10c4a9A315f2200C4`
* **PriceOracle:** `0xe2eD0C7c82195BC462A976dB198d973d395D9805`
* **FeeVault (Treasury):** `0x22F9D0109f43BB00b784147852fc0EA06bF5af82`
* **PharosPayRouter (Core):** `0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0`
It features both a sleek, high-fidelity React frontend dashboard and a native integration file (`SKILL.md`) for the Pharos Agent Centre, allowing users to send payments using natural language commands.

---

## 3. Core Highlights

### Architecture Summary
PharosPay consists of three key architectural layers:
1. **On-Chain Solidity Smart Contracts (Foundry):**
   * `MockPROS.sol`: Simulates the standard $PROS ERC-20 payment token.
   * `PriceOracle.sol`: Simulates Chainlink/Pyth price feeds for multi-currency conversion (`PROS/USD`, `USD/INR`, `USD/BRL`, etc.).
   * `FeeVault.sol`: Accumulates platform fees for governance and treasury management.
   * `PharosPayRouter.sol`: The execution hub that coordinates approvals, transfers, oracle price checks, fee distributions, and simulated settlement.
2. **Off-Chain Express API Server (Node.js):**
   * Parses standard payment QR formats (UPI strings, EMVCo TLV structures, or PharosPay urls) into merchant descriptors.
   * Collects price quotes and listens for contract events to trigger simulated settlement payouts.
3. **Frontend Application (Vite + React):**
   * Uses `html5-qrcode` to enable camera-based QR scanning directly in-browser.
   * Leverages `ethers.js` (v6) to prompt wallet connection, network switching, allowance approvals, and payment transactions.

### Innovation Summary
* **Zero Merchant Friction:** No changes are required from merchants. They receive local fiat directly through standard payment rails (UPI, PIX).
* **Decentralized Price Validation:** Price math is processed fully on-chain using standard decimal precision rules, protecting users from backend price manipulations.
* **Dual-Interface Flexibility:** Works as an immersive web application with wallet connection, and registers as an LLM-compatible agent skill for the Pharos Agent Centre.

### Technical Summary
* **Solidity Safety:** Implements OpenZeppelin's `SafeERC20` for token operations, uses `ReentrancyGuard` to secure payment pathways, and enforces granular admin checks (`Ownable`) on fee configurations.
* **Responsive Styling:** Modern glassmorphism UI with gradient aesthetics, dark mode by default, and micro-animations to represent transaction states.
* **Flexible Parsing:** Supports parsing of multiple legacy payment standards in a single, lightweight backend endpoint.

---

## 4. How It Uses Pharos
PharosPay leverages Pharos Atlantic Testnet (Chain ID `688689`) to achieve ultra-fast payments. Legacy payment rails demand immediate feedback (e.g. UPI transactions must resolve in 2-3 seconds at the counter). Pharos’s high-throughput architecture and instant transaction finality are crucial: they ensure the `$PROS` payment is validated on-chain and the merchant settlement is simulated in near real-time, matching the speed of standard credit card or mobile payments.

---

## 5. Future Scope
1. **DEX Liquidity Integration:** Route `$PROS` through on-chain AMMs to acquire stablecoins or fiat tokens (e.g., EUR/USD stables) before settlement.
2. **Account Abstraction (ERC-4337):** Implement paymasters so that users can pay for transactions without holding native `$PHRS` gas tokens, using `$PROS` for gas instead.
3. **Real Fiat Gateway Integrations:** Partner with payment aggregators (e.g., Stripe, Wyre, or local UPI settlement providers) to convert the on-chain stables into real bank transfers automatically.

---

## 6. Usage Instructions

### Smart Contract Deployment
```bash
# 1. Set environment variables
export PRIVATE_KEY=<YOUR_PRIVATE_KEY>
export RPC_URL=https://atlantic.dplabs-internal.com

# 2. Deploy contracts
forge script script/DeployPharosPay.s.sol:DeployPharosPay --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast

# 3. Initialize prices
forge script script/SetPrices.s.sol:SetPrices --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Running Backend API
```bash
cd backend
npm install
npm start
```

### Running Frontend React App
```bash
cd frontend
npm install
npm run dev
```

---

## 7. Judge Notes
* **Mock Deployments:** Consistent contract addresses are pre-configured in `frontend/src/config.js` and `backend/.env` for testing.
* **Demo Simulator:** Since camera permissions vary on desktop environments, the frontend scanner features "Quick Select" buttons that feed mock QR codes into the parser instantly.
* **Event Verification:** Look for `PaymentInitiated` and `SettlementSimulated` events emitted by the router on PharosScan to verify that token movements trigger the backend simulation properly.
