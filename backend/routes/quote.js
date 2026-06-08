const express = require('express');
const router = express.Router();
const priceService = require('../services/PriceService');
const { RAIL_MAP } = require('../lib/qrParser');

/**
 * GET /api/quote
 * Get a PROS conversion quote for a fiat amount.
 * 
 * Query: ?amount=100&currency=INR&feeRate=200
 * Response: { success: true, quote: { fiatAmount, totalPros, feeAmount, ... } }
 */
router.get('/quote', async (req, res) => {
  try {
    const amount = parseFloat(req.query.amount);
    const currency = (req.query.currency || 'INR').toUpperCase();
    const feeRate = parseInt(req.query.feeRate || '200');

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number.',
      });
    }

    if (feeRate < 100 || feeRate > 500) {
      return res.status(400).json({
        success: false,
        error: 'feeRate must be between 100 (1%) and 500 (5%) basis points.',
      });
    }

    const railInfo = RAIL_MAP[currency];
    if (!railInfo) {
      return res.status(400).json({
        success: false,
        error: `Unsupported currency: ${currency}. Supported: ${Object.keys(RAIL_MAP).join(', ')}`,
      });
    }

    const prosDetails = await priceService.getRateDetails('PROS/USD');
    const fiatDetails = await priceService.getRateDetails(railInfo.fiatPair);

    const liveProsPrice = prosDetails.price;
    const liveFxRate = fiatDetails.price;

    const usdAmount = amount / liveFxRate;
    const prosAmount = usdAmount / liveProsPrice;
    const feeAmount = prosAmount * (feeRate / 10000);
    const totalPros = prosAmount + feeAmount;

    const quote = {
      fiatAmount: amount,
      fiatCurrency: currency,
      usdAmount: parseFloat(usdAmount.toFixed(6)),
      prosPrice: liveProsPrice,
      source: prosDetails.source,
      fxRate: liveFxRate,
      prosAmount: parseFloat(prosAmount.toFixed(6)),
      feeAmount: parseFloat(feeAmount.toFixed(6)),
      feePercent: feeRate / 100,
      totalPros: parseFloat(totalPros.toFixed(6)),
      updatedAt: prosDetails.updatedAt,
      lastUpdated: prosDetails.updatedAt // keep for backwards compatibility
    };

    res.json({
      success: true,
      quote,
      ...quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message === 'Market data unavailable' ? 'Market data unavailable' : error.message,
    });
  }
});

/**
 * GET /api/rates
 * Get current exchange rates for all supported pairs.
 */
router.get('/rates', async (req, res) => {
  try {
    const pairs = ['PROS/USD', 'USD/INR', 'USD/BRL', 'USD/SGD', 'USD/USD', 'USD/EUR', 'USD/GBP'];
    const rates = {};

    for (const pair of pairs) {
      rates[pair] = await priceService.getRateDetails(pair);
    }

    res.json({ success: true, rates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rates/debug
 * Get dynamic cache info and Coinbase status for dev panel.
 */
router.get('/rates/debug', async (req, res) => {
  try {
    const debugInfo = priceService.getDebugInfo();
    res.json({ success: true, debug: debugInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
