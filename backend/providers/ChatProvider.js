class ChatProvider {
  async receiveMessage(chatId, message, metadata) {
    throw new Error('Method "receiveMessage" must be implemented by subclass.');
  }

  async sendMessage(chatId, text) {
    throw new Error('Method "sendMessage" must be implemented by subclass.');
  }

  async sendTypingIndicator(chatId) {
    throw new Error('Method "sendTypingIndicator" must be implemented by subclass.');
  }

  getProviderName() {
    throw new Error('Method "getProviderName" must be implemented by subclass.');
  }
}

module.exports = ChatProvider;
