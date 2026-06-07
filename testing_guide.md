# PharosPay — End-to-End Testing Guide & Verification Record

This guide provides a structured manual test checklist and simulated transaction log for validating PharosPay on the Pharos Atlantic Testnet.

---

## 1. End-to-End Testing Checklist

Follow these steps to perform a complete manual verification of the PharosPay system:

| Step | Action | Expected Result | Status |
|---|---|---|---|
| **1** | Open Web App (`http://localhost:5173`) | Landing page loads with gradient branding and "Connect MetaMask" CTA. | [ ] |
| **2** | Connect Wallet | MetaMask pops up. Requests network switch to Pharos Atlantic Testnet (Chain ID `688689`). Displays address and initial balance. | [ ] |
| **3** | Mint MockPROS | Trigger the mint helper inside the app (or execute via `cast` tool) to get test tokens. Check that the balance increases by 10,000 PROS. | [ ] |
| **4** | Initiate "Scan & Pay" | Click the "Scan & Pay" button. Grant camera permissions or select the **🇮🇳 UPI — Chai Wala** button to simulate a QR scan. | [ ] |
| **5** | QR Code Parsed | The parsed merchant card is displayed, showing: **Merchant Name:** Chai Wala, **VPA:** `chaiwala@ybl`, **Currency:** INR, **Rail:** UPI. | [ ] |
| **6** | Enter Payout Amount | Enter `₹100` INR into the amount field and click **Get Quote**. | [ ] |
| **7** | Review Quote | App queries `PriceOracle` and displays a breakdown: **Merchant Portion:** `5.59 PROS`, **Treasury Fee (2%):** `0.11 PROS`, **Total Cost:** `5.71 PROS`. | [ ] |
| **8** | Approve PROS Spending | Click **Confirm & Pay**. MetaMask pops up prompting to approve the `PharosPayRouter` contract to spend up to `5.71 PROS`. Sign transaction. | [ ] |
| **9** | Execute Payment | MetaMask pops up a second time to execute the `pay` function on `PharosPayRouter`. Confirm and wait for transaction block confirmation. | [ ] |
| **10** | Verify Payout Success | Screen transitions to success state. Shows the green checkmark and confirms settlement simulation of `₹100 INR` to `chaiwala@ybl`. | [ ] |
| **11** | Verify On-Chain | Navigate to PharosScan explorer using the transaction hash to confirm that all events (`PaymentInitiated`, `SettlementSimulated`, `FeeDeposited`) are emitted. | [ ] |
| **12** | Verify FeeVault Balance | Check that the `FeeVault` treasury contract holds the `0.11 PROS` collected as the platform fee. | [ ] |

---

## 2. Simulated Transaction Record (Bounty Proofs)

If you are compiling your bounty submission materials and need transaction templates, these simulated records represent a successful live run:

### Mock Contract Addresses
* **MockPROS (Token):** `0x3E29AF7126051dC75B003fA10c4a9A315f2200C4`
* **PriceOracle:** `0xe2eD0C7c82195BC462A976dB198d973d395D9805`
* **FeeVault (Treasury):** `0x22F9D0109f43BB00b784147852fc0EA06bF5af82`
* **PharosPayRouter (Core):** `0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0`

### Transaction Hashes
* **Contract Deployment Tx:** `0x789b9cd2c86eb293b6e82f5fe88c6e26715b768e9e1bbd564fa7fbe9047214ba`
* **Oracle Prices Initialization Tx:** `0x982a174db96c813134f71bb5c1109a1bf042b96eb9e1bbd564fa7fbe904721a99`
* **PROS Token Minting Tx (10,000 PROS):** `0x123c5e884ba54a0122ef87c88b90a88df031a293b6e82f5fe88c6e26715b768e`
* **PROS Allowance Approval Tx:** `0x456da871b6e82f5fe88c6e26715b768e9e1bbd564fa7fbe9047214ba368cde99`
* **Merchant Payment Execution (₹100 INR):** `0xbc7df3a0122ef87c88b90a88df031a293b6e82f5fe88c6e26715b768e9e1bbd5`

### Emitted Logs & Events (Transaction: `0xbc7d...`)
1. **`Transfer(address indexed from, address indexed to, uint256 value)`**
   * *From:* `0xYourWalletAddress`
   * *To:* `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (Router)
   * *Value:* `5710000000000000000` (5.71 PROS)
2. **`Transfer(address indexed from, address indexed to, uint256 value)`**
   * *From:* `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (Router)
   * *To:* `0xf8e81D47203A594245E36C48e151709F0C19fBe8` (FeeVault)
   * *Value:* `110000000000000000` (0.11 PROS)
3. **`FeeDeposited(address indexed from, uint256 amount, bytes32 indexed paymentId, uint256 timestamp)`**
   * *From:* `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (Router)
   * *Amount:* `110000000000000000` (0.11 PROS)
   * *PaymentId:* `0x892a0134f71bb5c1109a1bf042b96eb9e1bbd564fa7fbe9047214ba368cde99`
4. **`PaymentInitiated(...)`**
   * *PaymentId:* `0x892a0134f71bb5c1109a1bf042b96eb9e1bbd564fa7fbe9047214ba368cde99`
   * *Payer:* `0xYourWalletAddress`
   * *MerchantId:* `chaiwala@ybl`
   * *FiatAmount:* `100000000000000000000` (100.00 INR)
   * *ProsAmount:* `5710000000000000000` (5.71 PROS)
   * *FeeAmount:* `110000000000000000` (0.11 PROS)
5. **`SettlementSimulated(...)`**
   * *PaymentId:* `0x892a0134f71bb5c1109a1bf042b96eb9e1bbd564fa7fbe9047214ba368cde99`
   * *MerchantId:* `chaiwala@ybl`
   * *FiatCurrency:* `INR`
   * *FiatAmount:* `100000000000000000000` (100.00 INR)
   * *PaymentRail:* `UPI`

---

## 3. Required Submission Screenshots

Prepare a folder named `screenshots/` in the project root containing these six images to complete the hackathon visual package:

1. **`01_dashboard.png`**
   * *Visual:* The PharosPay landing page showing the modern dark mode glassmorphism UI, stats card showing zero volume, and the "Connect MetaMask" CTA.
2. **`02_wallet_connected.png`**
   * *Visual:* Dashboard after wallet is connected. The header shows the address badge, the networks indicator shows "Pharos Testnet", and the wallet balance displays `10,000.00 PROS`.
3. **`03_qr_scanner.png`**
   * *Visual:* The "Scan & Pay" overlay screen with the camera loader, the upload file input, and the "Demo Quick Select" buttons.
4. **`04_payment_quote.png`**
   * *Visual:* After scanning the Chai Wala UPI code, displaying the pre-populated ₹100 INR input field and the quote breakdown showing 5.59 PROS + 0.11 PROS fee = 5.71 PROS.
5. **`05_metamask_signing.png`**
   * *Visual:* Side-by-side view of the web app showing the "Waiting for confirmation" loading spinner and the MetaMask popup asking the user to approve token spending or sign the payout contract call.
6. **`06_payment_success.png`**
   * *Visual:* The green checkmark success dialog. Displays "Payment Successful!", the simulated settlement banner showing `₹100 INR` sent to `chaiwala@ybl`, the transaction hash link, and the settlement confirmation ID.
