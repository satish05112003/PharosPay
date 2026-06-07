# PharosPay Demo Walkthrough

## Pre-Demo Setup

1. Deploy contracts to Pharos Atlantic Testnet
2. Set oracle prices via `SetPrices.s.sol`
3. Mint test PROS to demo wallet
4. Update contract addresses in `frontend/src/config.js`
5. Start backend: `cd backend && node server.js`
6. Start frontend: `cd frontend && npm run dev`
7. Open MetaMask with Pharos Atlantic Testnet configured

## Demo Script (2 minutes)

### Scene 1: Landing (0:00 – 0:10)
- Open `http://localhost:5173`
- Show the PharosPay landing page
- Point out: "Pay Anyone, Anywhere with $PROS"

### Scene 2: Connect Wallet (0:10 – 0:20)
- Click "Connect MetaMask"
- MetaMask popup → approve
- Show PROS balance, network badge "Pharos Testnet"

### Scene 3: Scan QR (0:20 – 0:40)
- Click "Scan & Pay"
- Click the demo button "🇮🇳 UPI — Chai Wala"
- Show extracted merchant info: Chai Wala, chaiwala@ybl, UPI badge

### Scene 4: Enter Amount (0:40 – 0:55)
- Amount pre-filled: ₹100
- Click "Get Quote"
- Show breakdown: 5.59 PROS + 0.11 PROS fee (2%) = 5.71 PROS total

### Scene 5: Confirm Payment (0:55 – 1:15)
- Click "Confirm & Pay 5.71 PROS"
- MetaMask popup 1: Approve PROS spending → confirm
- MetaMask popup 2: Execute payment → confirm
- Show "Waiting for block confirmation..."

### Scene 6: Success (1:15 – 1:30)
- ✓ "Payment Successful!"
- Settlement banner: "₹100 → Chai Wala via UPI 🇮🇳"
- "Settlement Simulated" tag
- Transaction hash link

### Scene 7: Verify On-Chain (1:30 – 1:45)
- Click "View on Explorer"
- Show PharosScan transaction page
- Point out: PaymentInitiated event, SettlementSimulated event, FeeDeposited event

### Scene 8: History (1:45 – 2:00)
- Navigate to History tab
- Show payment record with merchant, amount, rail, PROS paid
- Show Agent Centre skill: "This is also a Pharos Agent Centre skill"

## Key Talking Points

1. **Zero merchant change** — Merchant's UPI QR code is unmodified
2. **Transparent fees** — 2% fee visible before payment, recorded on-chain
3. **Real on-chain settlement** — PROS tokens actually move, fee actually deposited
4. **Simulated fiat** — In production, merchant receives real ₹100 via UPI
5. **Multi-country** — Same flow works for PIX, PayNow, SEPA, ACH
6. **Agent Centre native** — Full natural language interface for payments
