const { ethers } = require('ethers');

const ORACLE_ABI = [
  'function getPrice(string pair) view returns (uint256 price, uint256 updatedAt)',
];

class PriceService {
  constructor() {
    this.provider = null;
    this.oracle = null;
    this.wallet = null;
    this.oracleWritable = null;

    const rpcUrl = process.env.RPC_URL || 'https://atlantic.dplabs-internal.com';
    const oracleAddr = process.env.PRICE_ORACLE;
    const operatorKey = process.env.PHAROS_OPERATOR_PRIVATE_KEY;

    if (oracleAddr) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.oracle = new ethers.Contract(oracleAddr, ORACLE_ABI, this.provider);
        console.log('PriceService: Connected to on-chain oracle at', oracleAddr);

        if (operatorKey) {
          this.wallet = new ethers.Wallet(operatorKey, this.provider);
          this.oracleWritable = new ethers.Contract(oracleAddr, [
            'function setPrices(string[] calldata pairs, uint256[] calldata prices) external',
            'function setPrice(string calldata pair, uint256 price) external'
          ], this.wallet);
          console.log('PriceService: Initialized writable oracle contract using operator key');
        }
      } catch (e) {
        console.warn('PriceService: Failed to connect to oracle:', e.message);
      }
    }

    // Cache to hold last valid prices
    this.cache = {
      'PROS/USD': { price: 0.6360, updatedAt: Date.now(), source: 'Cached (Initial)', status: 'initial' },
      'USD/INR': { price: 83.58, updatedAt: Date.now(), source: 'Cached (Initial)', status: 'initial' },
      'USD/BRL': { price: 5.12, updatedAt: Date.now(), source: 'Cached (Initial)', status: 'initial' },
      'USD/SGD': { price: 1.34, updatedAt: Date.now(), source: 'Cached (Initial)', status: 'initial' },
      'USD/EUR': { price: 0.92, updatedAt: Date.now(), source: 'Cached (Initial)', status: 'initial' },
      'USD/GBP': { price: 0.79, updatedAt: Date.now(), source: 'Cached (Initial)', status: 'initial' },
      'USD/USD': { price: 1.0, updatedAt: Date.now(), source: 'Static', status: 'ok' },
    };
  }

  async syncOracle(pairs, prices) {
    if (!this.oracleWritable) {
      console.warn('PriceService: Writable oracle not configured.');
      return null;
    }
    try {
      console.log(`PriceService: Syncing oracle on-chain for pairs [${pairs.join(', ')}] with prices [${prices.join(', ')}]`);
      const oraclePrices = prices.map(p => Math.round(Number(p) * 1e8));
      const tx = await this.oracleWritable.setPrices(pairs, oraclePrices);
      console.log(`PriceService: Oracle update tx sent: ${tx.hash}`);
      return tx;
    } catch (err) {
      console.error('PriceService: Failed to sync oracle on-chain:', err.message);
      return null;
    }
  }

  async fetchProsUsdPrice() {
    // 1. Coinbase Exchange API (Primary source of truth for live price)
    try {
      const res = await fetch('https://api.exchange.coinbase.com/products/PROS-USD/ticker', {
        headers: {
          'User-Agent': 'PharosPay/1.0.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.price) {
          const priceNum = parseFloat(data.price);
          if (priceNum > 0) {
            return { price: priceNum, source: 'Coinbase', updatedAt: Date.now(), status: 'ok' };
          }
        }
      }
      throw new Error(`Coinbase ticker returned status: ${res.status}`);
    } catch (e) {
      console.warn('PriceService: Coinbase query failed, checking fallbacks:', e.message);
      
      // 2. Cache fallback
      const cached = this.cache['PROS/USD'];
      const cacheAgeMs = Date.now() - (cached ? cached.updatedAt : 0);
      const staleLimitMs = (parseInt(process.env.PRICE_STALE_LIMIT) || 300) * 1000;
      
      if (cached && cached.status === 'ok' && cacheAgeMs < staleLimitMs) {
        console.warn(`PriceService: Using cached price from ${Math.round(cacheAgeMs / 1000)}s ago`);
        return {
          price: cached.price,
          source: cached.source,
          updatedAt: cached.updatedAt,
          status: 'fallback'
        };
      }
      
      // 3. Oracle fallback (Last resort)
      if (this.oracle) {
        try {
          console.warn('PriceService: Attempting on-chain oracle fallback query for PROS/USD...');
          const [price, updatedAt] = await this.oracle.getPrice('PROS/USD');
          const priceNum = Number(price) / 1e8;
          if (priceNum > 0) {
            return { price: priceNum, source: 'PharosOracle', updatedAt: Number(updatedAt) * 1000, status: 'fallback' };
          }
        } catch (oracleErr) {
          console.error('PriceService: Oracle fallback query failed for PROS/USD:', oracleErr.message);
        }
      }
      
      throw new Error('Market data unavailable');
    }
  }

  async fetchUsdRate(currency) {
    const pair = `USD/${currency}`;

    // 1. ExchangeRate API (Primary source of truth for live price)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && typeof data.rates[currency] === 'number') {
          return { price: data.rates[currency], source: 'ExchangeRateAPI', updatedAt: Date.now(), status: 'ok' };
        }
      }
      throw new Error(`ExchangeRate API returned status: ${res.status}`);
    } catch (e) {
      console.warn(`PriceService: ExchangeRate API failed for ${pair}, checking fallbacks:`, e.message);

      // 2. Cache fallback
      const cached = this.cache[pair];
      const cacheAgeMs = Date.now() - (cached ? cached.updatedAt : 0);
      const staleLimitMs = (parseInt(process.env.PRICE_STALE_LIMIT) || 300) * 1000;

      if (cached && cached.status === 'ok' && cacheAgeMs < staleLimitMs) {
        return {
          price: cached.price,
          source: cached.source,
          updatedAt: cached.updatedAt,
          status: 'fallback'
        };
      }

      // 3. Oracle fallback (Last resort)
      if (this.oracle) {
        try {
          console.warn(`PriceService: Attempting on-chain oracle fallback query for ${pair}...`);
          const [price, updatedAt] = await this.oracle.getPrice(pair);
          const priceNum = Number(price) / 1e8;
          if (priceNum > 0) {
            return { price: priceNum, source: 'PharosOracle', updatedAt: Number(updatedAt) * 1000, status: 'fallback' };
          }
        } catch (oracleErr) {
          console.error(`PriceService: Oracle fallback query failed for ${pair}:`, oracleErr.message);
        }
      }

      throw new Error('Market data unavailable');
    }
  }

  async getProsUsdPrice() {
    const cached = this.cache['PROS/USD'];
    const cacheTtlMs = (parseInt(process.env.PRICE_CACHE_SECONDS) || 30) * 1000;

    if (cached && (Date.now() - cached.updatedAt < cacheTtlMs) && cached.status === 'ok') {
      return cached.price;
    }

    const fresh = await this.fetchProsUsdPrice();
    this.cache['PROS/USD'] = fresh;
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
    const cacheTtlMs = (parseInt(process.env.PRICE_CACHE_SECONDS) || 30) * 1000;

    if (cached && (Date.now() - cached.updatedAt < cacheTtlMs) && cached.status === 'ok') {
      return cached.price;
    }

    const fresh = await this.fetchUsdRate(currency);
    this.cache[pair] = fresh;
    return fresh.price;
  }

  async getRateDetails(pair) {
    if (pair === 'PROS/USD') {
      const cached = this.cache['PROS/USD'];
      const cacheTtlMs = (parseInt(process.env.PRICE_CACHE_SECONDS) || 30) * 1000;

      if (cached && (Date.now() - cached.updatedAt < cacheTtlMs) && cached.status === 'ok') {
        return cached;
      }
      const fresh = await this.fetchProsUsdPrice();
      this.cache['PROS/USD'] = fresh;
      return fresh;
    }

    const currency = pair.split('/')[1] || 'USD';
    if (currency === 'USD') {
      return { price: 1.0, source: 'Static', updatedAt: Date.now(), status: 'ok' };
    }

    const cached = this.cache[pair];
    const cacheTtlMs = (parseInt(process.env.PRICE_CACHE_SECONDS) || 30) * 1000;

    if (cached && (Date.now() - cached.updatedAt < cacheTtlMs) && cached.status === 'ok') {
      return cached;
    }
    const fresh = await this.fetchUsdRate(currency);
    this.cache[pair] = fresh;
    return fresh;
  }

  getDebugInfo() {
    const prosCache = this.cache['PROS/USD'] || {};
    const ageSeconds = Math.round((Date.now() - prosCache.updatedAt) / 1000);
    const ttl = parseInt(process.env.PRICE_CACHE_SECONDS) || 30;
    
    let coinbaseStatus = 'Online';
    if (ageSeconds > ttl) {
      coinbaseStatus = ageSeconds >= 300 ? 'Offline' : 'Degraded (Using Cache)';
    }

    return {
      price: prosCache.price,
      source: 'Coinbase',
      coinbaseStatus,
      ageSeconds,
      updatedAt: prosCache.updatedAt,
      staleLimitSeconds: parseInt(process.env.PRICE_STALE_LIMIT) || 300,
      cacheTtlSeconds: ttl
    };
  }
}

module.exports = new PriceService();
