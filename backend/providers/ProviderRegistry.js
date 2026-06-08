const EmailNotificationProvider = require('./implementations/EmailNotificationProvider');
const TelegramNotificationProvider = require('./implementations/TelegramNotificationProvider');
const DiscordNotificationProvider = require('./implementations/DiscordNotificationProvider');
const WhatsAppNotificationProvider = require('./implementations/WhatsAppNotificationProvider');

class ProviderRegistry {
  constructor() {
    this.providers = [
      new EmailNotificationProvider(),
      new TelegramNotificationProvider(),
      new DiscordNotificationProvider(),
      new WhatsAppNotificationProvider()
    ];
  }

  /**
   * Distributes support event details to active communication adapters, falling back to mock logging for inactive stubs.
   */
  async dispatch(event, payload) {
    console.log(`[ProviderRegistry] Dispatching event: "${event}"`);
    const results = [];

    for (const provider of this.providers) {
      const name = provider.getChannelName();
      const available = provider.isAvailable();

      try {
        if (available) {
          console.log(`[ProviderRegistry] Dispatching to active channel: ${name}`);
          const ok = await provider.send(event, payload);
          results.push({ channel: name, status: ok ? 'dispatched' : 'failed' });
        } else {
          console.log(`[ProviderRegistry] Channel is stubbed/mocked: ${name}`);
          await provider.send(event, payload);
          results.push({ channel: name, status: 'stub_logged' });
        }
      } catch (err) {
        console.error(`[ProviderRegistry] Channel ${name} threw execution error:`, err.message);
        results.push({ channel: name, status: 'error', error: err.message });
      }
    }

    return results;
  }
}

module.exports = new ProviderRegistry();
