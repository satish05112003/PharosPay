const express = require('express');
const router = express.Router();
const redis = require('../config/redis');
const ReceiptVerificationService = require('../services/ReceiptVerificationService');
const ReceiptGenerator = require('../services/receiptGenerator');
const TicketManager = require('../services/TicketManager');

module.exports = (db) => {
  const receiptGenerator = new ReceiptGenerator(db);
  const verifyService = new ReceiptVerificationService(db, receiptGenerator);
  const ticketManager = new TicketManager(db);

  // ─── GET /api/receipts/verify ───────────────────────────────────────────
  router.get('/verify', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const query = req.query.q;

    try {
      // 1. Rate Limiting (20 requests per IP per minute)
      const rateLimitKey = `support:ratelimit:verify:${ip}`;
      const currentLimit = await redis.incr(rateLimitKey);
      if (currentLimit === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute
      }
      if (currentLimit > 20) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded: 20 verification requests per minute.',
          retryAfter: 60
        });
      }

      if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
      }

      // 2. Perform verification search
      const result = await verifyService.search(query);

      if (result.type === 'wallet_list') {
        return res.json({
          success: true,
          type: 'wallet_list',
          payments: result.payments
        });
      }

      if (!result.verified) {
        return res.json({
          success: true,
          verified: false,
          reason: result.reason || 'receipt_not_found',
          antiTamperMessage: 'This receipt could not be verified. The data may have been modified or does not exist. Do not accept this as proof of payment.'
        });
      }

      // Add dynamic view count from Redis
      const viewCount = await redis.get(`support:receipt:${result.receipt.payment.paymentId}:views`) || 0;
      result.receipt.meta.viewCount = parseInt(viewCount);

      res.json({
        success: true,
        verified: true,
        receiptSummary: result.receipt,
        paymentDetails: result.payment,
        antiTamperMessage: 'This receipt is cryptographically signed by PharosPay and has not been modified since issuance.'
      });

    } catch (err) {
      console.error('Receipt verify router failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/receipts/verify/:paymentId/full ───────────────────────────
  router.get('/verify/:paymentId/full', async (req, res) => {
    const { paymentId } = req.params;

    try {
      const receipt = await receiptGenerator.generateJsonReceipt(paymentId);
      
      // Increment view count in Redis
      const viewCount = await redis.incr(`support:receipt:${paymentId}:views`);
      receipt.viewCount = viewCount;

      res.json({
        success: true,
        receipt
      });
    } catch (err) {
      console.error('Failed to get full receipt details:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── POST /api/receipts/verify/report ───────────────────────────────────
  router.post('/verify/report', async (req, res) => {
    const { query, reporterEmail, description } = req.body;

    if (!query || !description) {
      return res.status(400).json({ success: false, error: 'Query and description are required fields.' });
    }

    try {
      const subject = `Suspicious Receipt Report: ${query.substring(0, 15)}`;
      const reportDesc = `User reported suspicious receipt.
Query Term: ${query}
Reporter Email: ${reporterEmail || 'Anonymous'}
Reporter Description: "${description}"`;

      // Auto-create ticket
      const ticket = await ticketManager.createTicket({
        userWallet: '0x0000000000000000000000000000000000000000', // System wallet
        subject,
        description: reportDesc,
        category: 'receipt_issue',
        priority: 'high'
      });

      res.status(201).json({
        success: true,
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number
      });
    } catch (err) {
      console.error('Suspicious receipt report submission failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
