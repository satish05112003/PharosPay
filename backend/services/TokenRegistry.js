class TokenRegistry {
  constructor(networkConfig) {
    this.networkConfig = networkConfig;
    
    // Future multi-token support architecture
    this.tokens = {
      'PHRS': {
        symbol: 'PHRS',
        name: 'Pharos Atlantic Testnet Token',
        decimals: 18,
        isNative: true,
        address: 'native',
        activeOn: [688689]
      },
      'PROS': {
        symbol: 'PROS',
        name: 'Pharos Token',
        decimals: 18,
        isNative: true,
        address: 'native',
        activeOn: [1672] // mainnet
      },
      'USDC': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false,
        address: null, // to be populated
        activeOn: []
      },
      'USDT': {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        isNative: false,
        address: null, // to be populated
        activeOn: []
      }
    };
  }

  getSupportedTokens() {
    const config = this.networkConfig.getActiveConfig();
    const chainId = config.chainId;
    
    // Return only tokens active on the current network
    return Object.values(this.tokens).filter(t => t.activeOn.includes(chainId));
  }
}

module.exports = TokenRegistry;
