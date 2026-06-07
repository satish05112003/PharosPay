class BaseProvider {

  constructor(config) {
    this.config = config;
    this.name = 'BaseProvider';
    this.isSimulation = false;
  }

  // Initiate a fiat transfer to the merchant
  // Returns: { providerReference, status, estimatedSettlementTime }
  async initiateTransfer(params) {
    throw new Error('initiateTransfer() must be implemented');
  }

  // Get current status of a transfer
  // Returns: { status, utr, referenceNumber, failureReason, metadata }
  async getTransferStatus(providerReference) {
    throw new Error('getTransferStatus() must be implemented');
  }

  // Validate that the beneficiary identifier is reachable before transfer
  // Returns: { valid, beneficiaryName, bank, accountType }
  async verifyBeneficiary(identifier, rail) {
    throw new Error('verifyBeneficiary() must be implemented');
  }

  // Cancel a pending transfer (only possible before settlement)
  // Returns: { cancelled, reason }
  async cancelTransfer(providerReference) {
    throw new Error('cancelTransfer() must be implemented');
  }

  // Parse webhook payload from this provider into normalized format
  // Returns normalized SettlementWebhookEvent object
  parseWebhook(rawPayload, headers) {
    throw new Error('parseWebhook() must be implemented');
  }

  // Verify webhook signature to prevent spoofed callbacks
  verifyWebhookSignature(payload, signature, secret) {
    throw new Error('verifyWebhookSignature() must be implemented');
  }

}

module.exports = BaseProvider;
