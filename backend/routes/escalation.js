const express = require('express');
const router = express.Router();
const redis = require('../config/redis');
const EscalationEngine = require('../services/EscalationEngine');
const TicketManager = require('../services/TicketManager');

module.exports = (db) => {
  const ticketManager = new TicketManager(db);
  const escalationEngine = new EscalationEngine(db, ticketManager);

  // ─── POST /api/support/escalate ─────────────────────────────────────────
  router.post('/escalate', async (req, res) => {
    try {
      const { sessionId, wallet, email, telegram, discord, twitter, description, severity, confidence, ticketId, transactionHash } = req.body;
      // walletAddress falls back to wallet if not separately provided
      const walletAddress = req.body.walletAddress || wallet;

      // 1. Validations
      if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        return res.status(400).json({ success: false, error: 'Invalid wallet address format.' });
      }

      if (transactionHash && !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
        return res.status(400).json({ success: false, error: 'Invalid transaction hash format.' });
      }

      // Email RFC 5322 pattern check
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
      }

      if (!description || description.trim().length < 20 || description.trim().length > 2000) {
        return res.status(400).json({ success: false, error: 'Description must be between 20 and 2000 characters.' });
      }

      if (telegram && telegram.includes(' ')) {
        return res.status(400).json({ success: false, error: 'Telegram handle must not contain spaces.' });
      }

      // 2. Rate Limiting (3 escalations per wallet per 24 hours)
      const rateLimitKey = `support:ratelimit:escalate:${wallet.toLowerCase()}`;
      const currentLimit = await redis.incr(rateLimitKey);
      if (currentLimit === 1) {
        await redis.expire(rateLimitKey, 86400); // 24 hours
      }
      if (currentLimit > 3) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded: 3 ticket escalations per 24 hours. Please contact administration directly.',
          retryAfter: 86400
        });
      }

      // 3. Coordinate Escalation
      const result = await escalationEngine.createEscalation({
        sessionId,
        wallet,
        email,
        telegram,
        discord,
        twitter,
        description,
        severity,
        confidence,
        ticketId,
        walletAddress,
        transactionHash
      });

      res.status(201).json({
        success: true,
        ticketId: result.ticketId,
        estimatedResponseHours: result.estimatedResponseHours,
        message: result.message,
        supportEmail: 'support@pharospay.xyz',
        trackingUrl: `https://pharospay.xyz/support/tickets/${result.ticketId}`
      });

    } catch (err) {
      console.error('Escalation handler failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
