const { ethers } = require('ethers');

const ORACLE_ABI = [
  'function getPrice(string pair) view returns (uint256 price, uint256 updatedAt)',
];

class PriceService {
  constructor() {
    this.provider = null;
    this.oracle = null;

    const rpcUrl = process.env.RPC_URL || 'https://atlantic.dplabs-internal.com';
    const oracleAddr = process.env.PRICE_ORACLE;

    if (oracleAddr) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.oracle = new ethers.Contract(oracleAddr, ORACLE_ABI, this.provider);
        console.log('PriceService: Connected to on-chain oracle at', oracleAddr);
      } catch (e) {
        console.warn('PriceService: Failed to connect to oracle:', e.message);
      }
    } else {
      console.log('PriceService: No PRICE_ORACLE env var configured');
    }

    // Cache to hold last valid prices
    this.cache = {
      'PROS/USD': { price: 0.636, updatedAt: Date.now(), source: 'Cached (Initial)' },
      'USD/INR': { price: 83.58, updatedAt: Date.now(), source: 'Cached (Initial)' },
      'USD/BRL': { price: 5.12, updatedAt: Date.now(), source: 'Cached (Initial)' },
      'USD/SGD': { price: 1.34, updatedAt: Date.now(), source: 'Cached (Initial)' },
      'USD/EUR': { price: 0.92, updatedAt: Date.now(), source: 'Cached (Initial)' },
      'USD/GBP': { price: 0.79, updatedAt: Date.now(), source: 'Cached (Initial)' },
      'USD/USD': { price: 1.0, updatedAt: Date.now(), source: 'Static' },
    };

    // Cache TTL: 30 seconds
    this.CACHE_TTL = 30 * 1000;
  }

  async fetchProsUsdPrice() {
    // 1. Try Pharos Oracle
    if (this.oracle) {
      try {
        const [price, updatedAt] = await this.oracle.getPrice('PROS/USD');
        const priceNum = Number(price) / 1e8;
        if (priceNum > 0) {
          return { price: priceNum, source: 'PharosOracle', updatedAt: Number(updatedAt) * 1000 };
        }
      } catch (e) {
        console.warn('PriceService: Pharos Oracle failed for PROS/USD:', e.message);
      }
    }

    // 2. Try CoinGecko API
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=prosper&vs_currencies=usd');
      if (res.ok) {
        const data = await res.json();
        if (data && data.prosper && typeof data.prosper.usd === 'number') {
          return { price: data.prosper.usd, source: 'CoinGecko', updatedAt: Date.now() };
        }
      }
    } catch (e) {
      console.warn('PriceService: CoinGecko failed for PROS/USD:', e.message);
    }

    // 3. Try DexScreener API
    try {
      const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xbb5A18C1D61e89f8164D85702213795b5E2D0C7c');
      if (res.ok) {
        const data = await res.json();
        if (data && data.pairs && data.pairs[0] && data.pairs[0].priceUsd) {
          const priceNum = parseFloat(data.pairs[0].priceUsd);
          if (priceNum > 0) {
            return { price: priceNum, source: 'DexScreener', updatedAt: Date.now() };
          }
        }
      }
    } catch (e) {
      console.warn('PriceService: DexScreener failed for PROS/USD:', e.message);
    }

    // 4. Cache fallback
    console.warn('PriceService: All PROS/USD pricing sources failed. Falling back to cached price.');
    return {
      price: this.cache['PROS/USD'].price,
      source: this.cache['PROS/USD'].source,
      updatedAt: this.cache['PROS/USD'].updatedAt,
      stale: true
    };
  }

  async fetchUsdRate(currency) {
    const pair = `USD/${currency}`;

    // 1. Try Pharos Oracle
    if (this.oracle) {
      try {
        const [price, updatedAt] = await this.oracle.getPrice(pair);
        const priceNum = Number(price) / 1e8;
        if (priceNum > 0) {
          return { price: priceNum, source: 'PharosOracle', updatedAt: Number(updatedAt) * 1000 };
        }
      } catch (e) {
        console.warn(`PriceService: Pharos Oracle failed for ${pair}:`, e.message);
      }
    }

    // 2. Try ExchangeRate API
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && typeof data.rates[currency] === 'number') {
          return { price: data.rates[currency], source: 'ExchangeRateAPI', updatedAt: Date.now() };
        }
      }
    } catch (e) {
      console.warn(`PriceService: ExchangeRate API failed for ${pair}:`, e.message);
    }

    // 3. Cache fallback
    console.warn(`PriceService: All pricing sources failed for ${pair}. Falling back to cached price.`);
    return {
      price: this.cache[pair] ? this.cache[pair].price : 1.0,
      source: this.cache[pair] ? this.cache[pair].source : 'Fallback',
      updatedAt: this.cache[pair] ? this.cache[pair].updatedAt : Date.now(),
      stale: true
    };
  }

  async getProsUsdPrice() {
    const cached = this.cache['PROS/USD'];
    if (Date.now() - cached.updatedAt < this.CACHE_TTL && cached.source !== 'Cached (Initial)') {
      return cached.price;
    }
    const fresh = await this.fetchProsUsdPrice();
    if (!fresh.stale) {
      this.cache['PROS/USD'] = fresh;
    }
    return fresh.price;
  }

  async getUsdInrRate() {
    return this.getRateValue('INR');
  }

  async getUsdBrlRate() {
    return this.getRateValue('BRL');
  }

  async getUsdSgdRate() {
    return this.getRateValue('SGD');
  }

  async getUsdEurRate() {
    return this.getRateValue('EUR');
  }

  async getUsdGbpRate() {
    return this.getRateValue('GBP');
  }

  async getRateValue(currency) {
    if (currency === 'USD') return 1.0;
    const pair = `USD/${currency}`;
    const cached = this.cache[pair];
    if (cached && (Date.now() - cached.updatedAt < this.CACHE_TTL) && cached.source !== 'Cached (Initial)') {
      return cached.price;
    }
    const fresh = await this.fetchUsdRate(currency);
    if (!fresh.stale) {
      this.cache[pair] = fresh;
    }
    return fresh.price;
  }

  // Get full price details (price, source, updatedAt)
  async getRateDetails(pair) {
    if (pair === 'PROS/USD') {
      const cached = this.cache['PROS/USD'];
      if (Date.now() - cached.updatedAt < this.CACHE_TTL && cached.source !== 'Cached (Initial)') {
        return cached;
      }
      const fresh = await this.fetchProsUsdPrice();
      if (!fresh.stale) {
        this.cache['PROS/USD'] = fresh;
      }
      return this.cache['PROS/USD'];
    }

    const currency = pair.split('/')[1] || 'USD';
    if (currency === 'USD') {
      return { price: 1.0, source: 'Static', updatedAt: Date.now() };
    }

    const cached = this.cache[pair];
    if (cached && (Date.now() - cached.updatedAt < this.CACHE_TTL) && cached.source !== 'Cached (Initial)') {
      return cached;
    }
    const fresh = await this.fetchUsdRate(currency);
    if (!fresh.stale) {
      this.cache[pair] = fresh;
    }
    return this.cache[pair];
  }
}

module.exports = new PriceService();
