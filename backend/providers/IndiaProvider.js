const BaseProvider = require('./BaseProvider');

class IndiaProvider extends BaseProvider {
  constructor(adapter) {
    super();
    this.adapter = adapter;
    this.name = `IndiaProvider(${adapter.name})`;
    this.isSimulation = adapter.isSimulation;
  }

  selectRail(amount, identifier) {
    const isVpa = identifier.includes('@');
    if (amount < 200000 && isVpa) {
      return 'UPI';
    }
    if (amount < 200000 && !isVpa) {
      return 'IMPS';
    }
    if (amount >= 200000 && amount < 1000000) {
      return 'NEFT';
    }
    return 'RTGS';
  }

  async initiateTransfer(params) {
    // Dynamically resolve optimal rails
    const rail = this.selectRail(params.amount, params.merchantIdentifier);
    return this.adapter.initiateTransfer({
      ...params,
      rail
    });
  }

  async getTransferStatus(providerReference) {
    return this.adapter.getTransferStatus(providerReference);
  }

  async verifyBeneficiary(identifier, rail) {
    return this.adapter.verifyBeneficiary(identifier, rail);
  }

  async cancelTransfer(providerReference) {
    return this.adapter.cancelTransfer(providerReference);
  }

  parseWebhook(rawPayload, headers) {
    return this.adapter.parseWebhook(rawPayload, headers);
  }

  verifyWebhookSignature(payload, signature, secret) {
    return this.adapter.verifyWebhookSignature(payload, signature, secret);
  }
}

module.exports = IndiaProvider;
