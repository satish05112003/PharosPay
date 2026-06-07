const BaseProvider = require('./BaseProvider');
const { validatePixKey } = require('../validators/pixValidator');

class BrazilProvider extends BaseProvider {
  constructor(adapter) {
    super();
    this.adapter = adapter;
    this.name = `BrazilProvider(${adapter.name})`;
    this.isSimulation = adapter.isSimulation;
  }

  async initiateTransfer(params) {
    // Validate PIX Key first
    const check = validatePixKey(params.merchantIdentifier);
    if (!check.valid) {
      throw new Error(`Invalid PIX key: ${check.message}`);
    }
    return this.adapter.initiateTransfer({
      ...params,
      metadata: { ...params.metadata, pixKeyType: check.type }
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

module.exports = BrazilProvider;
