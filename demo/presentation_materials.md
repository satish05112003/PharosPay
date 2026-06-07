# PharosPay — Demo & Presentation Materials

This file contains the complete set of presentation resources, scripts, and pitches for the PharosPay MVP bounty submission.

---

## 1. 60-Second Judge Pitch (Elevator Pitch)
*Goal: Capture attention, explain the problem/solution, and highlight the value proposition instantly.*

> **[0:00 - 0:15] The Hook**
> "Every day, millions of travelers and crypto-native users struggle to spend their digital assets in the real world. Merchants don't accept crypto because of volatility, high gas fees, and complex settlement processes. They want local fiat, and they want it instantly."
>
> **[0:15 - 0:35] The Solution**
> "Introducing **PharosPay** — a seamless, global crypto-to-fiat payment protocol built on the ultra-fast Pharos Network. PharosPay connects on-chain liquidity directly to legacy payment rails like India's UPI or Brazil's PIX. As a user, you scan any standard merchant QR code and pay with your $PROS tokens. In the background, the PharosPay router queries our on-chain price oracle, processes the payment, secures a transparent 2% fee for our treasury, and simulations settle local fiat directly to the merchant's bank account."
>
> **[0:35 - 0:50] Tech Highlights**
> "Built with custom Solidity routers, an admin-controlled price oracle feed, and integrated with the Pharos Agent Centre, PharosPay operates both as an immersive web application and a natural language AI skill. Users can execute payments simply by chatting: *'Pay ₹150 to merchant@upi'*."
>
> **[0:50 - 1:00] The Ask**
> "PharosPay bridges the final mile of web3 utility, turning crypto from an investment asset into daily spending power. Thank you."

---

## 2. 2-Minute Demo Script & Screen Recording Voiceover
*Designed as a word-for-word voiceover script for a 2-minute product walkthrough video.*

| Time | Visual on Screen | Voiceover Script |
|---|---|---|
| **0:00 - 0:15** | Open the PharosPay web dashboard (`http://localhost:5173`). Mouse hovers over the header showing "Pay anyone, anywhere with $PROS". | "Welcome to PharosPay. In this video, we're going to demonstrate how anyone can spend their $PROS tokens at any traditional merchant using legacy payment networks, without the merchant needing to understand or accept cryptocurrency." |
| **0:15 - 0:30** | Click the **Connect Wallet** button in the top right. MetaMask opens, the user approves, and the page updates to display the connected address, network name ('Pharos Atlantic Testnet'), and $PROS balance. | "First, we connect our MetaMask wallet. PharosPay automatically checks our network and prompts us to switch to the Pharos Atlantic Testnet. With our wallet connected, we can see our balance of 10,000 $PROS ready for transaction." |
| **0:30 - 0:50** | Click "Scan & Pay". The camera view container appears. Underneath, click the demo quick-select button labeled **🇮🇳 UPI — Chai Wala**. | "Next, we tap 'Scan & Pay'. In a mobile environment, this launches the native camera scanner. For this demo, we'll select our pre-configured Indian UPI merchant: Chai Wala. PharosPay parses the standard UPI QR code and instantly extracts the merchant's VPA, name, and currency format." |
| **0:50 - 1:10** | Enter `100` into the fiat amount input (labeled ₹ INR). Click **Get Quote**. The breakdown displays: `5.59 PROS` (Merchant), `0.11 PROS` (2% Fee), and `5.71 PROS` (Total). | "We enter ₹100 INR. Clicking 'Get Quote' queries our on-chain PriceOracle. We get a real-time conversion breakdown: the merchant receives the equivalent of 5.59 PROS, a transparent 2% platform fee is sent to our FeeVault, and the total cost is 5.71 PROS." |
| **1:10 - 1:35** | Click **Confirm & Pay 5.71 PROS**. MetaMask pops up to approve the contract allowance (confirm it). The second MetaMask popup appears to send the `pay` transaction (confirm it). The screen transitions to a loading state with a spinner. | "We click 'Confirm Payment'. MetaMask prompts us to approve the PROS token spending allowance, followed by the transaction execution on Pharos Atlantic. Transactions finalize on Pharos in under two seconds." |
| **1:35 - 1:50** | The screen turns green with a checkmark: "Payment Successful!". Displays "Simulated Settlement: ₹100 settled to chaiwala@ybl". Click "View on Explorer" which navigates to PharosScan. | "Success! The payment is confirmed. The merchant receives a simulated credit of ₹100 INR via UPI, and the receipt lists the transaction details. Let's look on PharosScan explorer: we see our transaction has emitted the PaymentInitiated and FeeDeposited events, proving on-chain finality." |
| **1:50 - 2:00** | Navigate to the **History** tab to show the recorded transaction, and point out the Agent Centre skill instructions in `SKILL.md`. | "Finally, we can review our history of transactions. The PharosPay MVP is fully ready, tested, and integrated as an AI Agent Centre skill, making crypto payments as simple as scanning a code or sending a text. Thanks for watching." |

---

## 3. 5-Minute Deep-Dive Presentation Script
*Structure for a longer live presentation or video pitch for judges.*

### I. Intro & The Problem (1:00)
- **Slide 1**: Title - PharosPay (Crypto-to-Fiat Payment Infrastructure on Pharos Network)
- **Key Points**:
  - The payment barrier: Crypto cards exist, but they are expensive, require heavy KYC, and aren't supported everywhere.
  - Legacy rails (UPI, PIX) dominate emerging markets but are totally siloed from smart contract platforms.
  - Merchant friction: Merchants will not install crypto wallets; they require local currency to pay suppliers.

### II. The Solution & Architecture (1:30)
- **Slide 2**: How PharosPay Works
- **Key Points**:
  - The user scans standard UPI/PIX QR codes.
  - The browser reads the QR code data and sends it to the PharosPay API.
  - The API parses the merchant details and identifies the payment rail.
  - The smart contracts pull `$PROS` from the user, calculate conversion rates using the `PriceOracle` feed, deposit platform fees into the `FeeVault` treasury, and record the payment ID on-chain.
  - The backend listens to these events and initiates simulated settlement to the merchant's local bank account.

### III. Live Demo walkthrough (1:30)
- **Demonstration**:
  - Connect MetaMask to Pharos Atlantic Testnet.
  - Scan UPI QR code using the simulator or files.
  - Complete the two-step MetaMask signature (approve + execute).
  - Show live event emissions on-chain via explorer.
  - Show the History page.

### IV. Pharos Integration & AI Agent Capability (0:45)
- **Slide 3**: Under the Hood: Pharos Network & Agent Centre
- **Key Points**:
  - Why Pharos? Transaction finality in seconds and fraction-of-a-cent fees make micro-payments viable.
  - AI Agent Centre Integration: Because all smart contracts are modular, our custom `SKILL.md` allows LLM-powered agents to parse natural language requests (e.g. "Send $10 USD to cafe@pix") and prepare transactions for users.

### V. Roadmap & Future Scope (0:15)
- **Slide 4**: Roadmap
- **Key Points**:
  - Phase 1: Real-time DEX routing for PROS-fiat token swaps.
  - Phase 2: Live settlement API integrations via payment aggregators.
  - Phase 3: Off-chain gas sponsorship (paymaster) so users don't need native gas tokens to pay.
