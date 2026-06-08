class EscalationProvider {
  async escalate(ticket, contact, aiAnalysis) {
    throw new Error('Method "escalate" must be implemented by subclass.');
  }

  async updateEscalation(ticketId, status) {
    throw new Error('Method "updateEscalation" must be implemented by subclass.');
  }

  async getEscalationStatus(ticketId) {
    throw new Error('Method "getEscalationStatus" must be implemented by subclass.');
  }

  getProviderName() {
    throw new Error('Method "getProviderName" must be implemented by subclass.');
  }
}

module.exports = EscalationProvider;
