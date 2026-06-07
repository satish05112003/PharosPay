const BaseProvider = require('./BaseProvider');
const { detectPayNowIdType } = require('../validators/paynowValidator');

class SingaporeProvider extends BaseProvider {
  constructor(adapter) {
    super();
    this.adapter = adapter;
    this.name = `SingaporeProvider(${adapter.name})`;
    this.isSimulation = adapter.isSimulation;
  }

  async initiateTransfer(params) {
    // If identifier starts with bank account number style, default to FAST
    const isPayNow = detectPayNowIdType(params.merchantIdentifier) !== null;
    return this.adapter.initiateTransfer({
      ...params,
      rail: isPayNow ? 'PAYNOW' : 'FAST'
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

module.exports = SingaporeProvider;
