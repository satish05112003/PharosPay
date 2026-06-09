const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // GET /api/payments/history
  router.get('/payments/history', async (req, res) => {
    try {
      const { payer } = req.query;
      let query = `
        SELECT p.*, s.utr, s.reference_number, s.status as settlement_status, s.settled_at
        FROM payments p
        LEFT JOIN payment_settlements s ON p.id = s.payment_id
      `;
      const params = [];
      if (payer) {
        query += ` WHERE LOWER(p.user_wallet) = LOWER($1)`;
        params.push(payer);
      }
      query += ` ORDER BY p.created_at DESC`;
      
      const result = await db.query(query, params);
      
      const history = result.rows.map(s => ({
        id: s.pharos_payment_id || s.id,
        paymentId: s.id,
        pharosPaymentId: s.pharos_payment_id,
        merchantId: s.merchant_identifier,
        merchantName: s.metadata?.merchantName || s.merchant_identifier,
        fiatCurrency: s.fiat_currency,
        fiatAmount: Number(s.fiat_amount),
        prosAmount: s.pros_amount_executed ? Number(s.pros_amount_executed) : Number(s.pros_amount),
        prosAmountExecuted: s.pros_amount_executed ? Number(s.pros_amount_executed) : Number(s.pros_amount),
        usdAmountAtExecution: s.usd_amount_at_execution ? Number(s.usd_amount_at_execution) : null,
        feeAmount: s.metadata?.feeAmount || '0.0000',
        paymentRail: s.payment_rail,
        country: s.country,
        timestamp: s.created_at,
        status: s.status,
        utr: s.utr,
        referenceNumber: s.reference_number,
        prosPriceAtExecution: s.pros_price_at_execution ? Number(s.pros_price_at_execution) : (s.pros_usd_rate ? Number(s.pros_usd_rate) : null),
        fxRateAtExecution: s.fx_rate_at_execution ? Number(s.fx_rate_at_execution) : (s.usd_fiat_rate ? Number(s.usd_fiat_rate) : null),
        priceSource: s.price_source || 'Coinbase',
        quoteTimestamp: s.quote_timestamp || s.created_at
      }));

      res.json({
        success: true,
        payments: history,
        count: history.length
      });
    } catch (err) {
      console.error('Failed to fetch payment history:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/payments/:paymentId
  router.get('/payments/:paymentId', async (req, res) => {
    try {
      const { paymentId } = req.params;
      
      // Try lookup by UUID (if valid format) or pharosPaymentId
      let payment = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
      if (isUuid) {
        payment = await db.payments.findById(paymentId);
      }
      if (!payment) {
        payment = await db.payments.findByPharosPaymentId(paymentId);
      }

      if (!payment) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      const settlement = await db.settlements.findByPaymentId(payment.id);

      res.json({
        success: true,
        payment: {
          id: payment.id,
          pharosPaymentId: payment.pharos_payment_id,
          userWallet: payment.user_wallet,
          merchantIdentifier: payment.merchant_identifier,
          country: payment.country,
          paymentRail: payment.payment_rail,
          fiatAmount: Number(payment.fiat_amount),
          fiatCurrency: payment.fiat_currency,
          prosAmount: payment.pros_amount_executed ? Number(payment.pros_amount_executed) : Number(payment.pros_amount),
          prosAmountExecuted: payment.pros_amount_executed ? Number(payment.pros_amount_executed) : Number(payment.pros_amount),
          usdAmountAtExecution: payment.usd_amount_at_execution ? Number(payment.usd_amount_at_execution) : null,
          status: payment.status,
          created_at: payment.created_at,
          utr: settlement ? settlement.utr : null,
          referenceNumber: settlement ? settlement.reference_number : null,
          settlementStatus: settlement ? settlement.status : null,
          prosPriceAtExecution: payment.pros_price_at_execution ? Number(payment.pros_price_at_execution) : (payment.pros_usd_rate ? Number(payment.pros_usd_rate) : null),
          fxRateAtExecution: payment.fx_rate_at_execution ? Number(payment.fx_rate_at_execution) : (payment.usd_fiat_rate ? Number(payment.usd_fiat_rate) : null),
          priceSource: payment.price_source || 'Coinbase',
          quoteTimestamp: payment.quote_timestamp || payment.created_at
        }
      });
    } catch (err) {
      console.error('Failed to fetch payment details:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/payments/:paymentId/debug
  router.get('/payments/:paymentId/debug', async (req, res) => {
    try {
      const { paymentId } = req.params;
      let payment = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
      if (isUuid) {
        payment = await db.payments.findById(paymentId);
      }
      if (!payment) {
        payment = await db.payments.findByPharosPaymentId(paymentId);
      }

      if (!payment) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      const fiatAmount = Number(payment.fiat_amount);
      const usdInrRate = payment.usd_inr_rate ? Number(payment.usd_inr_rate) : (payment.fx_rate_at_execution ? Number(payment.fx_rate_at_execution) : (payment.usd_fiat_rate ? Number(payment.usd_fiat_rate) : null));
      const prosUsdPrice = payment.pros_usd_price ? Number(payment.pros_usd_price) : (payment.pros_price_at_execution ? Number(payment.pros_price_at_execution) : (payment.pros_usd_rate ? Number(payment.pros_usd_rate) : null));
      const storedProsAmount = Number(payment.pros_amount_executed || payment.pros_amount);
      const feePercent = payment.fee_percent ? Number(payment.fee_percent) : 2.00;

      let expectedProsAmount = null;
      let differencePercent = null;

      if (usdInrRate && prosUsdPrice) {
        expectedProsAmount = Number((((fiatAmount / usdInrRate) / prosUsdPrice) * 1.02).toFixed(6));
        const diff = Math.abs(storedProsAmount - expectedProsAmount);
        differencePercent = Number(((diff / expectedProsAmount) * 100).toFixed(6));
      }

      res.json({
        fiatAmount,
        usdInrRate,
        prosUsdPrice,
        feePercent,
        storedProsAmount,
        expectedProsAmount,
        differencePercent
      });
    } catch (err) {
      console.error('Failed to get payment debug details:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
