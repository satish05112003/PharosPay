const SimulationAdapter = require('../providers/adapters/SimulationAdapter');
const RazorpayXAdapter = require('../providers/adapters/RazorpayXAdapter');
const CashfreeAdapter = require('../providers/adapters/CashfreeAdapter');

const IndiaProvider = require('../providers/IndiaProvider');
const BrazilProvider = require('../providers/BrazilProvider');
const SingaporeProvider = require('../providers/SingaporeProvider');
const USProvider = require('../providers/USProvider');

class ProviderFactory {
  constructor() {
    this.providers = {};
    
    // Build and cache providers
    const indiaProv = this.buildIndiaProvider();
    const brazilProv = this.buildBrazilProvider();
    const singaporeProv = this.buildSingaporeProvider();
    const usProv = this.buildUSProvider();

    // Register handlers per country + rail
    this.register('IN', 'UPI', indiaProv);
    this.register('IN', 'IMPS', indiaProv);
    this.register('IN', 'NEFT', indiaProv);
    this.register('IN', 'RTGS', indiaProv);

    this.register('BR', 'PIX', brazilProv);

    this.register('SG', 'PayNow', singaporeProv);
    this.register('SG', 'PAYNOW', singaporeProv);
    this.register('SG', 'FAST', singaporeProv);

    this.register('US', 'ACH', usProv);
    this.register('US', 'WIRE', usProv);
  }

  register(country, rail, provider) {
    // Standardize uppercase keys
    this.providers[`${country.toUpperCase()}_${rail.toUpperCase()}`] = provider;
  }

  getProvider(country, rail) {
    const key = `${country.toUpperCase()}_${rail.toUpperCase()}`;
    const provider = this.providers[key];
    if (!provider) {
      console.warn(`No provider registered for ${key}. Falling back to default SimulationAdapter.`);
      return new SimulationAdapter({ isSimulation: true });
    }
    return provider;
  }

  buildIndiaProvider() {
    const demoMode = process.env.DEMO_MODE === 'true';
    const hasRazorpay = process.env.RAZORPAYX_KEY_ID && process.env.RAZORPAYX_KEY_SECRET;
    const hasCashfree = process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET;

    if (demoMode) {
      return new IndiaProvider(new SimulationAdapter({ isSimulation: true }));
    }
    if (hasRazorpay) {
      return new IndiaProvider(new RazorpayXAdapter({
        keyId: process.env.RAZORPAYX_KEY_ID,
        keySecret: process.env.RAZORPAYX_KEY_SECRET,
        accountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER
      }));
    }
    if (hasCashfree) {
      return new IndiaProvider(new CashfreeAdapter({
        clientId: process.env.CASHFREE_CLIENT_ID,
        clientSecret: process.env.CASHFREE_CLIENT_SECRET,
        mode: process.env.CASHFREE_MODE || 'TEST'
      }));
    }
    
    console.warn('No India payout provider credentials found. Using simulation.');
    return new IndiaProvider(new SimulationAdapter({ isSimulation: true }));
  }

  buildBrazilProvider() {
    const demoMode = process.env.DEMO_MODE === 'true';
    if (demoMode || process.env.BRAZIL_PROVIDER === 'simulation') {
      return new BrazilProvider(new SimulationAdapter({ isSimulation: true }));
    }
    // Expand to other API adapters as needed, fallback to simulation
    return new BrazilProvider(new SimulationAdapter({ isSimulation: true }));
  }

  buildSingaporeProvider() {
    const demoMode = process.env.DEMO_MODE === 'true';
    if (demoMode || process.env.SINGAPORE_PROVIDER === 'simulation') {
      return new SingaporeProvider(new SimulationAdapter({ isSimulation: true }));
    }
    return new SingaporeProvider(new SimulationAdapter({ isSimulation: true }));
  }

  buildUSProvider() {
    const demoMode = process.env.DEMO_MODE === 'true';
    if (demoMode || process.env.USA_PROVIDER === 'simulation') {
      return new USProvider(new SimulationAdapter({ isSimulation: true }));
    }
    return new USProvider(new SimulationAdapter({ isSimulation: true }));
  }
}

module.exports = new ProviderFactory();
