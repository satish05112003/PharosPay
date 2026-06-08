const NotificationProvider = require('../NotificationProvider');
const emailService = require('../../services/EmailService');

class EmailNotificationProvider extends NotificationProvider {
  isAvailable() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  }

  getChannelName() {
    return 'email';
  }

  async send(event, payload) {
    if (!this.isAvailable()) {
      console.log(`[EmailNotificationProvider] SMTP offline. Mocking dispatch for event: ${event}`);
      return false;
    }

    try {
      switch (event) {
        case 'ticket_created':
          await emailService.sendTicketConfirmation(payload.email, payload.ticket);
          break;
        case 'ticket_escalated':
          await emailService.sendAdminAlert(payload.adminEmail, payload.ticket, payload.contactInfo, payload.aiAnalysis);
          break;
        case 'ticket_resolved':
          await emailService.sendTicketResolved(payload.email, payload.ticket, payload.resolution);
          break;
        default:
          console.warn(`[EmailNotificationProvider] Event "${event}" not handled.`);
      }
      return true;
    } catch (err) {
      console.error('[EmailNotificationProvider] Send failure:', err.message);
      return false;
    }
  }

  async sendBulk(events) {
    let success = true;
    for (const evt of events) {
      const ok = await this.send(evt.event, evt.payload);
      if (!ok) success = false;
    }
    return success;
  }
}

module.exports = EmailNotificationProvider;
