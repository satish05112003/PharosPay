/**
 * PharosPay Frontend Configuration
 * Contract addresses, ABIs, and network config.
 * 
 * ⚠️ UPDATE CONTRACT ADDRESSES after deployment!
 */

// ─── Network Config ──────────────────────────────────────────────────────
export const PHAROS_CHAIN = {
  chainId: '0xA8351', // 688689
  chainIdDecimal: 688689,
  chainName: 'Pharos Atlantic Testnet',
  nativeCurrency: { name: 'PHRS', symbol: 'PHRS', decimals: 18 },
  rpcUrls: ['https://atlantic.dplabs-internal.com'],
  blockExplorerUrls: ['https://atlantic.pharosscan.xyz'],
};

// ─── Contract Addresses ──────────────────────────────────────────────────
export const CONTRACTS = {
  MockPROS: '0x3E29AF7126051dC75B003fA10c4a9A315f2200C4',
  PriceOracle: '0xe2eD0C7c82195BC462A976dB198d973d395D9805',
  FeeVault: '0x22F9D0109f43BB00b784147852fc0EA06bF5af82',
  PharosPayRouter: '0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0',
};

// ─── App Level Configurations ─────────────────────────────────────────────
export const APP_CONFIG = {
  tokenSymbol: 'PROS'
};

// ─── API ──────────────────────────────────────────────────────────────────
export const API_BASE = 'http://localhost:3001/api';

export async function initializeConfig() {
  try {
    const res = await fetch(API_BASE + '/config/network');
    const data = await res.json();
    if (data.success && data.network) {
      PHAROS_CHAIN.chainIdDecimal = Number(data.network.chainId);
      PHAROS_CHAIN.chainId = '0x' + PHAROS_CHAIN.chainIdDecimal.toString(16);
      PHAROS_CHAIN.chainName = data.network.name;
      PHAROS_CHAIN.nativeCurrency.symbol = data.network.tokenSymbol;
      PHAROS_CHAIN.nativeCurrency.name = data.network.tokenName;
      PHAROS_CHAIN.rpcUrls = [data.network.rpcUrl];
      PHAROS_CHAIN.blockExplorerUrls = [data.network.explorerUrl];
      
      if (data.payment) {
        CONTRACTS.MockPROS = data.payment.tokenAddress;
        APP_CONFIG.tokenSymbol = data.payment.tokenSymbol;
      }
    }
  } catch (err) {
    console.error('Failed to initialize dynamic network configuration', err);
  }
}



// ─── ABIs (minimal | only functions used by frontend) ─────────────────────
export const ABI = {
  MockPROS: [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function mint(address to, uint256 amount)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
  ],
  PriceOracle: [
    'function getPrice(string pair) view returns (uint256 price, uint256 updatedAt)',
    'function quotePROS(uint256 fiatAmount, string fiatPair) view returns (uint256 prosAmount)',
  ],
  FeeVault: [
    'function totalFeesCollected() view returns (uint256)',
    'function getBalance() view returns (uint256)',
    'function depositCount() view returns (uint256)',
  ],
  PharosPayRouter: [
    'function pay(string merchantId, string merchantName, string fiatCurrency, uint256 fiatAmount, string fiatPair, string paymentRail, string country) returns (bytes32 paymentId)',
    'function getQuote(uint256 fiatAmount, string fiatPair) view returns (uint256 merchantPros, uint256 feeAmount, uint256 totalPros, uint256 feeRateBpsUsed)',
    'function getPayment(bytes32 paymentId) view returns (tuple(bytes32 id, address payer, string merchantId, string merchantName, string fiatCurrency, uint256 fiatAmount, uint256 prosAmount, uint256 feeAmount, uint256 merchantPros, string paymentRail, string country, uint256 timestamp, uint8 status))',
    'function getUserPayments(address user) view returns (bytes32[])',
    'function getUserPaymentCount(address user) view returns (uint256)',
    'function paymentCount() view returns (uint256)',
    'function totalVolumeProcessed() view returns (uint256)',
    'function feeRateBps() view returns (uint256)',
    'event PaymentInitiated(bytes32 indexed paymentId, address indexed payer, string merchantId, string merchantName, string fiatCurrency, uint256 fiatAmount, uint256 prosAmount, uint256 feeAmount, string paymentRail, string country)',
    'event SettlementSimulated(bytes32 indexed paymentId, string merchantId, string fiatCurrency, uint256 fiatAmount, string paymentRail, string country, uint256 timestamp)',
  ],
};

// ─── Currency Config ──────────────────────────────────────────────────────
export const CURRENCIES = {
  INR: { symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee', fiatPair: 'USD/INR', rail: 'UPI', country: 'IN' },
  BRL: { symbol: 'R$', flag: '🇧🇷', name: 'Brazilian Real', fiatPair: 'USD/BRL', rail: 'PIX', country: 'BR' },
  SGD: { symbol: 'S$', flag: '🇸🇬', name: 'Singapore Dollar', fiatPair: 'USD/SGD', rail: 'PayNow', country: 'SG' },
  USD: { symbol: '$', flag: '🇺🇸', name: 'US Dollar', fiatPair: 'USD/USD', rail: 'ACH', country: 'US' },
  GBP: { symbol: '£', flag: '🇬🇧', name: 'British Pound', fiatPair: 'USD/GBP', rail: 'FasterPayments', country: 'GB' },
  EUR: { symbol: '€', flag: '🇪🇺', name: 'Euro', fiatPair: 'USD/EUR', rail: 'SEPA', country: 'EU' },
  THB: { symbol: '฿', flag: '🇹🇭', name: 'Thai Baht', fiatPair: 'USD/THB', rail: 'PromptPay', country: 'TH' },
  JPY: { symbol: '¥', flag: '🇯🇵', name: 'Japanese Yen', fiatPair: 'USD/JPY', rail: 'PayPay', country: 'JP' },
};
