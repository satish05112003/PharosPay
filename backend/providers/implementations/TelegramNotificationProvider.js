const NotificationProvider = require('../NotificationProvider');

class TelegramNotificationProvider extends NotificationProvider {
  isAvailable() {
    return false; // Stub
  }

  getChannelName() {
    return 'telegram';
  }

  async send(event, payload) {
    console.log(`[TelegramNotificationProvider Stub] Event: ${event} Logged Summary:`, payload.summary || payload.ticket?.ticketNumber || 'No payload data');
    return true;
  }

  async sendBulk(events) {
    for (const evt of events) {
      await this.send(evt.event, evt.payload);
    }
    return true;
  }
}

module.exports = TelegramNotificationProvider;
