const NotificationProvider = require('../NotificationProvider');

class WhatsAppNotificationProvider extends NotificationProvider {
  isAvailable() {
    return false; // Stub
  }

  getChannelName() {
    return 'whatsapp';
  }

  async send(event, payload) {
    console.log(`[WhatsAppNotificationProvider Stub] Event: ${event} Logged Summary:`, payload.summary || payload.ticket?.ticketNumber || 'No payload data');
    return true;
  }

  async sendBulk(events) {
    for (const evt of events) {
      await this.send(evt.event, evt.payload);
    }
    return true;
  }
}

module.exports = WhatsAppNotificationProvider;
