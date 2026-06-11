class NetworkConfigService {
  constructor() {
    this.isTestnet = process.env.TESTNET_MODE === 'true';

    this.testnetConfig = {
      networkName: 'Pharos Atlantic Testnet',
      chainId: parseInt(process.env.TESTNET_CHAIN_ID || '688689', 10),
      tokenSymbol: process.env.TESTNET_TOKEN_SYMBOL || 'PHRS',
      tokenName: process.env.TESTNET_TOKEN_NAME || 'Pharos Atlantic Testnet Token',
      explorerUrl: process.env.TESTNET_EXPLORER || 'https://atlantic.pharosscan.xyz',
      rpcUrl: process.env.TESTNET_RPC || 'https://atlantic.dplabs-internal.com',
      contracts: {
        router: process.env.TESTNET_ROUTER || process.env.PHAROSPAY_ROUTER,
        oracle: process.env.TESTNET_ORACLE || process.env.PRICE_ORACLE,
        feeVault: process.env.TESTNET_FEE_VAULT,
      }
    };

    this.mainnetConfig = {
      networkName: 'Pharos Mainnet',
      chainId: parseInt(process.env.MAINNET_CHAIN_ID || '1672', 10),
      tokenSymbol: process.env.MAINNET_TOKEN_SYMBOL || 'PROS',
      tokenName: process.env.MAINNET_TOKEN_NAME || 'Pharos Token',
      explorerUrl: process.env.MAINNET_EXPLORER || 'https://pharosscan.xyz',
      rpcUrl: process.env.MAINNET_RPC || 'https://rpc.pharos.xyz',
      contracts: {
        router: process.env.MAINNET_ROUTER || process.env.PHAROSPAY_ROUTER,
        oracle: process.env.MAINNET_ORACLE || process.env.PRICE_ORACLE,
        feeVault: process.env.MAINNET_FEE_VAULT,
      }
    };
  }

  getActiveConfig() {
    return this.isTestnet ? this.testnetConfig : this.mainnetConfig;
  }

  // Which token is explicitly used for payments? By default it's the native token.
  getPaymentToken() {
    const config = this.getActiveConfig();
    return {
      symbol: process.env.PAYMENT_TOKEN_SYMBOL || config.tokenSymbol,
      address: process.env.PAYMENT_TOKEN_ADDRESS || 'native'
    };
  }
}

module.exports = new NetworkConfigService();
