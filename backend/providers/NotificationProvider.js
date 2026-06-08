class NotificationProvider {
  async send(event, payload) {
    throw new Error('Method "send" must be implemented by subclass.');
  }

  async sendBulk(events) {
    throw new Error('Method "sendBulk" must be implemented by subclass.');
  }

  isAvailable() {
    return false;
  }

  getChannelName() {
    throw new Error('Method "getChannelName" must be implemented by subclass.');
  }
}

module.exports = NotificationProvider;
