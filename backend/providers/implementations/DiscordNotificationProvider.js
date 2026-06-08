const NotificationProvider = require('../NotificationProvider');

class DiscordNotificationProvider extends NotificationProvider {
  isAvailable() {
    return false; // Stub
  }

  getChannelName() {
    return 'discord';
  }

  async send(event, payload) {
    console.log(`[DiscordNotificationProvider Stub] Event: ${event} Logged Summary:`, payload.summary || payload.ticket?.ticketNumber || 'No payload data');
    return true;
  }

  async sendBulk(events) {
    for (const evt of events) {
      await this.send(evt.event, evt.payload);
    }
    return true;
  }
}

module.exports = DiscordNotificationProvider;
