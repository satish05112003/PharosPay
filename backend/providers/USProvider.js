const BaseProvider = require('./BaseProvider');
const { isValidRoutingNumber, isValidAccountNumber } = require('../validators/achValidator');

class USProvider extends BaseProvider {
  constructor(adapter) {
    super();
    this.adapter = adapter;
    this.name = `USProvider(${adapter.name})`;
    this.isSimulation = adapter.isSimulation;
  }

  async initiateTransfer(params) {
    // Expected identifier format account:routing or similar
    const parts = params.merchantIdentifier.split(/[\/:]/);
    if (parts.length === 2) {
      const [acc, routing] = parts;
      const validAcc = isValidAccountNumber(acc);
      const validRoute = isValidRoutingNumber(routing);
      if (!validAcc.valid || !validRoute.valid) {
        throw new Error(`ABA validation failure: ${validAcc.message}. ${validRoute.message}`);
      }
    }
    // High amount transfers (>= $10,000 USD = 1000000 cents) default to WIRE, else ACH
    const rail = params.amount >= 1000000 ? 'WIRE' : 'ACH';
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

module.exports = USProvider;
