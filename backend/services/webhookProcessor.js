const RazorpayXAdapter = require('../providers/adapters/RazorpayXAdapter');
const CashfreeAdapter = require('../providers/adapters/CashfreeAdapter');
const SimulationAdapter = require('../providers/adapters/SimulationAdapter');

class WebhookProcessor {
  constructor(db, settlementEngine) {
    this.db = db;
    this.settlementEngine = settlementEngine;

    this.adapters = {
      razorpayx: new RazorpayXAdapter({
        keyId: process.env.RAZORPAYX_KEY_ID || '',
        keySecret: process.env.RAZORPAYX_KEY_SECRET || '',
        accountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER || ''
      }),
      cashfree: new CashfreeAdapter({
        clientId: process.env.CASHFREE_CLIENT_ID || '',
        clientSecret: process.env.CASHFREE_CLIENT_SECRET || '',
        mode: process.env.CASHFREE_MODE || 'TEST'
      }),
      simulation: new SimulationAdapter({ isSimulation: true })
    };
  }

  async processWebhook(providerName, rawPayload, headers) {
    const providerKey = providerName.toLowerCase();
    const adapter = this.adapters[providerKey];
    if (!adapter) {
      throw new Error(`Unsupported webhook provider: ${providerName}`);
    }

    // Convert rawPayload to object if it is a string/Buffer
    let payloadObj = rawPayload;
    if (typeof rawPayload === 'string' || Buffer.isBuffer(rawPayload)) {
      try {
        payloadObj = JSON.parse(rawPayload.toString());
      } catch (err) {
        throw new Error('Failed to parse webhook payload as JSON');
      }
    }

    const normalized = adapter.parseWebhook(payloadObj, headers);
    if (!normalized.providerReference) {
      throw new Error('Could not parse providerReference from webhook payload');
    }

    const settlement = await this.db.settlements.findByProviderReference(normalized.providerReference);
    if (!settlement) {
      throw new Error(`Settlement not found for provider reference: ${normalized.providerReference}`);
    }

    const secret = this.getWebhookSecret(providerKey);
    const signature = this.getSignatureFromHeaders(providerKey, headers);

    if (secret && signature) {
      // For signature verification we might need raw payload as string/Buffer
      const rawPayloadString = Buffer.isBuffer(rawPayload) 
        ? rawPayload.toString() 
        : (typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload));
      
      const isValid = adapter.verifyWebhookSignature(rawPayloadString, signature, secret);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    await this.settlementEngine.handleWebhookUpdate(settlement.id, normalized);
    return { success: true };
  }

  getWebhookSecret(providerName) {
    if (providerName === 'razorpayx') {
      return process.env.RAZORPAYX_WEBHOOK_SECRET;
    }
    if (providerName === 'cashfree') {
      return process.env.CASHFREE_WEBHOOK_SECRET;
    }
    return null;
  }

  getSignatureFromHeaders(providerName, headers) {
    if (providerName === 'razorpayx') {
      return headers['x-razorpay-signature'];
    }
    if (providerName === 'cashfree') {
      return headers['x-cashfree-signature'];
    }
    return null;
  }
}

module.exports = WebhookProcessor;
