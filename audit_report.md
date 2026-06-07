# PharosPay — Security Audit & Launch Checklist

This document details the code safety audit, risk profiles, mitigation patterns, and a final pre-flight launch checklist for the PharosPay protocol deployment.

---

## 1. Smart Contract & Backend Audit Report

### [Medium Risk] Admin Centralization (Price Oracle & Fee Rate Controls)
* **Location:** [PharosPayRouter.sol](file:///d:/Predictions/PharosPay/src/PharosPayRouter.sol) (`setFeeRate` and `setOracle`)
* **Risk:** The contract owner has unilateral control to change the `PriceOracle` reference address or increase the platform fee up to 5% (`MAX_FEE_BPS`). If the owner private key is compromised, an attacker could point the router to a malicious oracle contract that inflates quotes, draining user token balances.
* **Fixes & Mitigations:**
  1. **Multisig Ownership:** The production deployer owner address must be transferred to a Multi-Signature treasury wallet (e.g. Gnosis Safe with a 3-of-5 signing rule).
  2. **Timelock Controller:** Deploy a `TimelockController` contract as the owner of the router, enforcing a minimum 48-hour delay on admin actions. This gives users time to opt-out if unexpected changes occur.

### [Minor Risk / Fixed] Deviating from Checks-Effects-Interactions (CEI) Pattern
* **Location:** [PharosPayRouter.sol](file:///d:/Predictions/PharosPay/src/PharosPayRouter.sol#L179-L210) (`pay` function)
* **Risk:** The router previously transferred PROS tokens from the user and deposited fees into `FeeVault` (external interactions) *before* updating its internal state variables (`totalVolumeProcessed` and `payments[paymentId]`). Although this contract uses the `nonReentrant` modifier to prevent callback exploits and standard ERC20 tokens don't support code execution callbacks, this was a minor deviation from strict CEI guidelines.
* **Fixes & Mitigations:**
  1. **Strict CEI Ordering:** Updated the function structure so that payment records, volume, and history arrays are written to state *before* invoking token transfers. The compiler optimization guarantees no change in gas usage.
  2. **Reentrancy Guard:** OpenZeppelin's `ReentrancyGuard` remains active on `pay()` to block potential reentrancy entry-points.

### [Minor Risk / Fixed] Zero Fee Reverts in Micro-payments (Tiny Payout Bug)
* **Location:** [PharosPayRouter.sol](file:///d:/Predictions/PharosPay/src/PharosPayRouter.sol) (`pay` method calling `FeeVault.depositFee`)
* **Risk:** For tiny fiat payments (e.g., fractional coins/micropayments), the calculated 2% platform fee rounds down to 0 (`feeAmount == 0`). Previously, the contract would still try to call `FeeVault.depositFee(0, paymentId)`. However, `FeeVault` requires `amount > 0`, causing the entire transaction to revert.
* **Fixes & Mitigations:**
  1. **Zero-Fee Skip:** Wrapped the approval and FeeVault deposit calls inside `pay()` in a conditional block: `if (feeAmount > 0)`. Micro-payments resulting in zero fees now execute successfully.

### [Minor Risk / Fixed] Redundant Parameter Mismatch
* **Location:** [PharosPayRouter.sol](file:///d:/Predictions/PharosPay/src/PharosPayRouter.sol) (`pay` method parameter lookup)
* **Risk:** The contract signature took both `fiatCurrency` and `fiatPair` arguments. If CLI or automated callers passed misaligned parameters (e.g. passing owner name in place of `fiatPair`), the oracle lookup reverted with `Price not set`.
* **Fixes & Mitigations:**
  1. **Internal Pair Generation:** Patched the contract to derive the oracle lookup string directly from `fiatCurrency` using `getPairString(fiatCurrency)` (e.g. `"INR"` automatically becomes `"USD/INR"`). The redundant `fiatPair` argument is ignored for pricing validation, making execution foolproof.

### [Minor Risk] Oracle Price Feed Expiration
* **Location:** [PharosPayRouter.sol](file:///d:/Predictions/PharosPay/src/PharosPayRouter.sol) (`quotePROS` call)
* **Risk:** The `PriceOracle` returns prices containing an `updatedAt` timestamp, but the `PharosPayRouter` does not validate whether this price is fresh. In a volatile market, using stale prices could result in arbitrage or user loss.
* **Fixes & Mitigations:**
  1. **Freshness Checks:** Enforce an oracle heartbeat threshold (e.g. 24 hours). If `block.timestamp - updatedAt > HEARTBEAT_WINDOW`, revert the transaction.

### [Informational] SafeERC20 Adoption & Allowance Reset
* **Location:** [PharosPayRouter.sol](file:///d:/Predictions/PharosPay/src/PharosPayRouter.sol#L184) and [FeeVault.sol](file:///d:/Predictions/PharosPay/src/FeeVault.sol)
* **Findings:** The contracts follow best practices by using Ethers `SafeERC20` wrapper library for token transfers. In addition, the router uses OpenZeppelin's modern `forceApprove()` helper to handle non-standard ERC20 tokens that require resetting allowances to zero before updating them.

---

## 2. Final Launch Checklist (Pre-Flight)

### 1. Smart Contracts
- [ ] Compiles cleanly under Solidity `0.8.24` with optimizer enabled (200 runs, `via_ir` true).
- [ ] Contract tests (`forge test`) pass with 100% success rate.
- [ ] Deployment private key is loaded securely from env files and has at least `1.0 PHRS` for deployment gas.
- [ ] Deploy MockPROS, PriceOracle, FeeVault, and PharosPayRouter in exact order.
- [ ] Set initial token prices (PROS/USD, USD/INR, USD/BRL, etc.) on `PriceOracle`.
- [ ] Submit verification to Pharos Atlantic Explorer using `forge verify-contract`.

### 2. Backend API
- [ ] Backend `.env` configured with the correct RPC URL and newly deployed contract addresses.
- [ ] Run `npm audit` to check for dependency vulnerabilities.
- [ ] Run backend tests or health check endpoint `http://localhost:3001/api/health`.

### 3. Frontend App
- [ ] Update [config.js](file:///d:/Predictions/PharosPay/frontend/src/config.js) with the verified contract addresses.
- [ ] Confirm MetaMask network details match chain ID `688689` and RPC endpoint `https://atlantic.dplabs-internal.com`.
- [ ] Run `npx vite build` to ensure the production bundle outputs cleanly.

### 4. Integration Verification
- [ ] Connect MetaMask, check that `$PROS` balance displays correctly.
- [ ] Perform a transaction (₹100 INR) to verify:
  - Allowance approval popup.
  - Payment execution signature.
  - On-chain event monitoring.
  - Backend settlement simulation logs.
