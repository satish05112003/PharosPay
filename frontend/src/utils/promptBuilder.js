import { APP_CONFIG } from '../config';

/**
 * Utility to construct client-side support query templates
 */
export const buildPromptTemplate = (type, data = {}) => {
  switch (type) {
    case 'failed_payment':
      return `My payment of ${data.amount || 'funds'} to merchant ${data.merchant || 'recipient'} failed on ${data.date || 'today'}. The transaction hash is ${data.txHash || '0x...'}. Can you help me check if it was refunded?`;
    case 'delayed_settlement':
      return `I made a payment of ${data.amount || 'funds'} to ${data.merchant || 'recipient'} but the merchant states they have not received it yet. The payment status shows pending. UTR: ${data.utr || 'N/A'}.`;
    case 'missing_utr':
      return `My payment to ${data.merchant || 'merchant'} went through successfully, but the UTR number is missing from the receipt. Can you fetch it for me? Payment ID: ${data.paymentId || 'N/A'}.`;
    case 'compromised_wallet':
      return `URGENT: I believe my wallet connection is compromised. I noticed an unauthorized transaction in my payment history. Please suspend payouts associated with wallet ${data.wallet || '0x...'}.`;
    default:
      return '';
  }
};

export const getQuickPrompts = (walletState = {}) => {
  const prompts = [
    { label: 'Check pending settlement status', value: 'Why is my recent settlement pending?' },
    { label: 'Find my payment UTR reference', value: 'How do I locate the UTR reference number for my last payment?' }
  ];

  if (walletState.hasFailedPayments) {
    prompts.unshift({ label: 'Report failed payment refund issue', value: `My payment failed, how do I get my PROS tokens refunded?` });
  }

  return prompts;
};
