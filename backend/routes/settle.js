const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

module.exports = (settlementEngine, db) => {
  /**
   * POST /api/settle
   * Manually trigger settlement or simulate transaction lock event.
   */
  router.post('/settle', async (req, res) => {
    try {
      const { paymentId, txHash, merchantId, merchantName, amount, currency, paymentRail, country, payer, prosAmount } = req.body;

      if (!paymentId || !merchantId || !amount || !currency || !paymentRail) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: paymentId, merchantId, amount, currency, paymentRail',
        });
      }

      console.log(`Routes Settle: Manually triggering settlement engine for payment ${paymentId}`);

      // We handle payment initiation through database and job queue
      await settlementEngine.handlePaymentInitiated({
        paymentId,
        payer: payer || '0x0000000000000000000000000000000000000000',
        merchantIdentifier: merchantId,
        fiatCurrency: currency,
        fiatAmountX6: String(Math.round(Number(amount) * 1e6)),
        prosAmount: prosAmount ? ethers.parseEther(prosAmount.toString()).toString() : '0',
        paymentRail,
        country: country || 'US',
        timestamp: Math.floor(Date.now() / 1000),
        pharosLockTx: txHash || null
      });

      // Get the payment record that was created
      const payment = await db.payments.findByPharosPaymentId(paymentId);
      const settlement = payment ? await db.settlements.findByPaymentId(payment.id) : null;

      res.json({
        success: true,
        settlement: {
          id: payment ? payment.id : null,
          paymentId: payment ? payment.id : null,
          pharosPaymentId: paymentId,
          settlementId: settlement ? settlement.id : 'simulated_ref',
          status: payment ? payment.status : 'SETTLEMENT_STARTED',
          message: 'Settlement initiated successfully',
          txHash,
          utr: settlement ? settlement.utr : null,
          referenceNumber: settlement ? settlement.reference_number : null
        },
      });
    } catch (error) {
      console.error('Routes Settle Error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/payments/history
   * Get payment history (compatibility endpoint).
   */
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
        quoteTimestamp: s.quote_timestamp || s.created_at,
        priceSource: s.price_source || 'Coinbase'
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

  /**
   * GET /api/settlements
   * Get all database settlements.
   */
  router.get('/settlements', async (_, res) => {
    try {
      const result = await db.query(`
        SELECT s.*, p.pharos_payment_id, p.fiat_amount, p.fiat_currency, p.payment_rail, p.country, p.user_wallet
        FROM payment_settlements s
        JOIN payments p ON s.payment_id = p.id
        ORDER BY s.initiated_at DESC
      `);
      res.json({
        success: true,
        settlements: result.rows,
        count: result.rows.length,
      });
    } catch (err) {
      console.error('Failed to fetch settlements:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
