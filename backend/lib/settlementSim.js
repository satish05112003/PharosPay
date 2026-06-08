/**
 * Settlement Simulator | Simulates fiat merchant settlement.
 * 
 * In production, this would:
 *   1. Convert PROS → USD via DEX/liquidity pool
 *   2. Route USD → local fiat via payment rail API (UPI/PIX/SEPA/etc.)
 *   3. Deliver fiat to merchant's bank account
 *
 * For MVP demo, it logs the settlement and returns a simulated confirmation.
 */

const { v4: uuidv4 } = require('uuid');

// In-memory settlement log (for demo)
const settlements = [];

/**
 * Simulate a fiat settlement to a merchant
 * @param {Object} params
 * @param {string} params.paymentId - On-chain payment ID (bytes32 hex)
 * @param {string} params.txHash - On-chain transaction hash
 * @param {string} params.merchantId - Merchant identifier (UPI VPA, PIX key, etc.)
 * @param {string} params.merchantName - Human-readable merchant name
 * @param {number} params.amount - Fiat amount to settle
 * @param {string} params.currency - Fiat currency code
 * @param {string} params.paymentRail - Settlement rail (UPI, PIX, SEPA, etc.)
 * @param {string} params.country - Country code
 * @returns {Object} Settlement confirmation
 */
function simulateSettlement({
  paymentId,
  txHash,
  merchantId,
  merchantName = 'Merchant',
  amount,
  currency,
  paymentRail,
  country,
  payer,
  prosAmount,
  feeAmount
}) {
  const settlementId = uuidv4();
  const simulatedAt = new Date().toISOString();
  const utr = "UTR" + Math.floor(Math.random() * 900000000000 + 100000000000);

  // Simulate processing delay message
  const railMessages = {
    UPI: `₹${amount} credited to ${merchantId} via UPI NPCI. UTR: ${utr}. Speaker: "Received ₹${amount} from PharosPay"`,
    PIX: `R$${amount} credited to ${merchantId} via PIX Banco Central. UTR: ${utr}. Instant settlement.`,
    PayNow: `S$${amount} credited to ${merchantId} via PayNow MAS. UTR: ${utr}. Settlement confirmed.`,
    SEPA: `€${amount} credited to ${merchantId} via SEPA Instant Credit Transfer. UTR: ${utr}.`,
    ACH: `$${amount} credited to ${merchantId} via ACH RTP. UTR: ${utr}. Same-day settlement.`,
    FasterPayments: `£${amount} credited to ${merchantId} via UK Faster Payments. UTR: ${utr}.`,
    PromptPay: `฿${amount} credited to ${merchantId} via PromptPay BOT. UTR: ${utr}.`,
    QRIS: `Rp${amount} credited to ${merchantId} via QRIS BI-FAST. UTR: ${utr}.`,
    PayPay: `¥${amount} credited to ${merchantId} via PayPay Business API. UTR: ${utr}.`,
  };

  const settlement = {
    settlementId,
    paymentId,
    txHash,
    merchantId,
    merchantName,
    amount,
    currency,
    paymentRail,
    country,
    status: 'SETTLED',
    utr,
    simulatedAt,
    payer: payer || null,
    prosAmount: prosAmount || null,
    feeAmount: feeAmount || null,
    message: railMessages[paymentRail] || `${currency} ${amount} credited to ${merchantId} via ${paymentRail}. UTR: ${utr}`,
    disclaimer: 'SIMULATED | No real fiat transfer occurred. In production, this triggers actual bank settlement.',
  };

  settlements.push(settlement);
  
  console.log(`\n  💰 Settlement Simulated:`);
  console.log(`     ${settlement.message}`);
  console.log(`     Payment ID: ${paymentId}`);
  console.log(`     Tx Hash: ${txHash}\n`);

  return settlement;
}

/**
 * Get all simulated settlements (for demo dashboard)
 */
function getSettlements() {
  return settlements;
}

module.exports = { simulateSettlement, getSettlements };
