/**
 * QR Code Parser — Extracts structured payment data from QR code strings.
 * 
 * Supported formats:
 *   1. UPI (India):     upi://pay?pa=merchant@bank&pn=Name&am=100&cu=INR
 *   2. PIX (Brazil):    pharospay://pay?to=pix:key&amount=50&currency=BRL
 *   3. PayNow (SG):     pharospay://pay?to=paynow:UEN&amount=10&currency=SGD
 *   4. Generic:         pharospay://pay?to=id&amount=X&currency=Y&rail=Z&name=N
 *   5. Plain JSON:      {"merchantId":"...","amount":100,"currency":"INR"}
 */

// Country/currency → payment rail mapping
const RAIL_MAP = {
  INR: { rail: 'UPI', country: 'IN', flag: '🇮🇳', fiatPair: 'USD/INR' },
  BRL: { rail: 'PIX', country: 'BR', flag: '🇧🇷', fiatPair: 'USD/BRL' },
  SGD: { rail: 'PayNow', country: 'SG', flag: '🇸🇬', fiatPair: 'USD/SGD' },
  USD: { rail: 'ACH', country: 'US', flag: '🇺🇸', fiatPair: 'USD/USD' },
  GBP: { rail: 'FasterPayments', country: 'GB', flag: '🇬🇧', fiatPair: 'USD/GBP' },
  EUR: { rail: 'SEPA', country: 'EU', flag: '🇪🇺', fiatPair: 'USD/EUR' },
  THB: { rail: 'PromptPay', country: 'TH', flag: '🇹🇭', fiatPair: 'USD/THB' },
  IDR: { rail: 'QRIS', country: 'ID', flag: '🇮🇩', fiatPair: 'USD/IDR' },
  JPY: { rail: 'PayPay', country: 'JP', flag: '🇯🇵', fiatPair: 'USD/JPY' },
};

function parseQR(qrData) {
  if (!qrData || typeof qrData !== 'string') {
    throw new Error('Invalid QR data');
  }

  const trimmed = qrData.trim();

  // 1. UPI format: upi://pay?pa=...
  if (trimmed.toLowerCase().startsWith('upi://')) {
    return parseUPI(trimmed);
  }

  // 2. PharosPay custom format: pharospay://pay?...
  if (trimmed.toLowerCase().startsWith('pharospay://')) {
    return parsePharosPay(trimmed);
  }

  // 3. JSON format
  if (trimmed.startsWith('{')) {
    try {
      return parseJSON(trimmed);
    } catch (e) {
      throw new Error('Invalid JSON QR data');
    }
  }

  // 4. Fallback: try as URL params
  if (trimmed.includes('=')) {
    return parseGenericParams(trimmed);
  }

  throw new Error(`Unrecognized QR format: ${trimmed.substring(0, 50)}...`);
}

function parseUPI(data) {
  const url = new URL(data);
  const params = url.searchParams;

  const merchantId = params.get('pa') || '';
  const merchantName = decodeURIComponent(params.get('pn') || 'Unknown Merchant');
  const amount = parseFloat(params.get('am') || '0');
  const currency = (params.get('cu') || 'INR').toUpperCase();

  if (!merchantId) throw new Error('UPI QR missing pa (payee address)');

  const railInfo = RAIL_MAP[currency] || RAIL_MAP.INR;

  return {
    merchantId,
    merchantName,
    amount: amount || null,
    currency,
    country: railInfo.country,
    countryFlag: railInfo.flag,
    paymentRail: railInfo.rail,
    fiatPair: railInfo.fiatPair,
    rawFormat: 'UPI',
  };
}

function parsePharosPay(data) {
  const url = new URL(data);
  const params = url.searchParams;

  const merchantId = params.get('to') || '';
  const merchantName = decodeURIComponent(params.get('name') || 'Merchant');
  const amount = parseFloat(params.get('amount') || '0');
  const currency = (params.get('currency') || 'USD').toUpperCase();
  const rail = params.get('rail') || '';

  if (!merchantId) throw new Error('PharosPay QR missing "to" parameter');

  const railInfo = RAIL_MAP[currency] || RAIL_MAP.USD;

  return {
    merchantId,
    merchantName,
    amount: amount || null,
    currency,
    country: railInfo.country,
    countryFlag: railInfo.flag,
    paymentRail: rail || railInfo.rail,
    fiatPair: railInfo.fiatPair,
    rawFormat: 'PharosPay',
  };
}

function parseJSON(data) {
  const obj = JSON.parse(data);
  const country = (obj.country || '').toUpperCase();
  const rail = (obj.paymentRail || obj.rail || '').toUpperCase();
  
  // Resolve currency by country code or payment rail
  let currency = (obj.currency || '').toUpperCase();
  if (!currency) {
    if (country === 'IN' || rail === 'UPI') currency = 'INR';
    else if (country === 'BR' || rail === 'PIX') currency = 'BRL';
    else if (country === 'SG' || rail === 'PAYNOW') currency = 'SGD';
    else if (country === 'US' || rail === 'ACH') currency = 'USD';
    else if (country === 'TH' || rail === 'PROMPTPAY') currency = 'THB';
    else if (country === 'ID' || rail === 'QRIS') currency = 'IDR';
    else if (country === 'JP' || rail === 'PAYPAY') currency = 'JPY';
    else if (country === 'GB' || rail === 'FASTERPAYMENTS') currency = 'GBP';
    else if (country === 'EU' || rail === 'SEPA') currency = 'EUR';
    else currency = 'USD';
  }

  const railInfo = RAIL_MAP[currency] || RAIL_MAP.USD;

  return {
    merchantId: obj.merchantId || obj.to || '',
    merchantName: obj.merchantName || obj.name || 'Merchant',
    amount: obj.amount || null,
    currency,
    country: country || railInfo.country,
    countryFlag: railInfo.flag,
    paymentRail: obj.paymentRail || obj.rail || railInfo.rail,
    fiatPair: railInfo.fiatPair,
    rawFormat: 'JSON',
    beneficiaryId: obj.beneficiaryId || null,
  };
}

function parseGenericParams(data) {
  const params = new URLSearchParams(data);
  const currency = (params.get('currency') || params.get('cu') || 'USD').toUpperCase();
  const railInfo = RAIL_MAP[currency] || RAIL_MAP.USD;

  return {
    merchantId: params.get('to') || params.get('pa') || params.get('merchantId') || '',
    merchantName: params.get('name') || params.get('pn') || 'Merchant',
    amount: parseFloat(params.get('amount') || params.get('am') || '0') || null,
    currency,
    country: railInfo.country,
    countryFlag: railInfo.flag,
    paymentRail: params.get('rail') || railInfo.rail,
    fiatPair: railInfo.fiatPair,
    rawFormat: 'Generic',
  };
}

module.exports = { parseQR, RAIL_MAP };
