const BaseProvider = require('../BaseProvider');
const { v4: uuidv4 } = require('uuid');

// In-memory registry to track simulation timeline status
const activeSimTransfers = new Map();

class SimulationAdapter extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'simulation';
    this.isSimulation = true;
  }

  async initiateTransfer(params) {
    // 1. Wait 1500ms to simulate network call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const refCounter = String(Math.floor(Math.random() * 100000)).padStart(6, '0');
    const providerReference = 'SIM_' + uuidv4();

    // Store in-memory with timestamp
    activeSimTransfers.set(providerReference, {
      initiatedAt: Date.now(),
      params
    });

    return {
      providerReference,
      status: 'PROCESSING',
      utr: null,
      estimatedSettlementTime: 8,
      rawResponse: { 
        simulated: true, 
        generatedAt: new Date().toISOString(),
        refCounter
      }
    };
  }

  async getTransferStatus(providerReference) {
    const tx = activeSimTransfers.get(providerReference);
    if (!tx) {
      return {
        status: 'FAILED',
        utr: null,
        referenceNumber: null,
        beneficiaryName: null,
        bank: null,
        failureReason: 'Transaction not found in simulator memory',
        settledAt: null,
        metadata: {}
      };
    }

    // After 5+ seconds from initiation, return success
    const elapsed = Date.now() - tx.initiatedAt;
    if (elapsed > 5000) {
      const year = new Date().getFullYear();
      const utrSuffix = String(Math.floor(Math.random() * 900) + 100);
      const utr = 'SIM-UPI-174928371' + utrSuffix;
      const counter = String(Math.floor(Math.random() * 10000)).padStart(6, '0');
      const referenceNumber = `PHAROS-${year}-${counter}`;

      return {
        status: 'SUCCESS',
        utr,
        referenceNumber,
        beneficiaryName: tx.params.merchantName || 'Demo Merchant',
        bank: 'DEMO BANK',
        failureReason: null,
        settledAt: new Date(),
        metadata: { elapsedMs: elapsed }
      };
    }

    return {
      status: 'PROCESSING',
      utr: null,
      referenceNumber: null,
      beneficiaryName: tx.params.merchantName || 'Demo Merchant',
      bank: 'DEMO BANK',
      failureReason: null,
      settledAt: null,
      metadata: { elapsedMs: elapsed }
    };
  }

  async verifyBeneficiary(identifier, rail) {
    return {
      valid: true,
      beneficiaryName: 'Demo Merchant',
      bank: 'DEMO BANK',
      accountType: 'Savings',
      message: 'Simulated beneficiary verified'
    };
  }

  async cancelTransfer(providerReference) {
    activeSimTransfers.delete(providerReference);
    return { cancelled: true, reason: 'Simulated cancel' };
  }

  parseWebhook(rawPayload, headers) {
    const { paymentId, status, utr, referenceNumber, failureReason } = rawPayload;
    return {
      paymentId,
      providerReference: rawPayload.providerReference || 'SIM_WEBHOOK_' + uuidv4(),
      status: status || 'SUCCESS',
      utr: utr || 'SIM-UPI-' + Date.now().toString().slice(-12),
      referenceNumber: referenceNumber || 'PHAROS-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 100000)).padStart(6, '0'),
      failureReason: failureReason || null,
      rawPayload
    };
  }

  verifyWebhookSignature(payload, signature, secret) {
    return true;
  }
}

module.exports = SimulationAdapter;
