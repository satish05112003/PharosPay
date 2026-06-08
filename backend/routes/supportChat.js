const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');
const AIProvider = require('../services/AIProvider');
const aiQueue = require('../queues/aiQueue');
const PromptInjectionGuard = require('../services/PromptInjectionGuard');
const AISupportService = require('../services/AISupportService');

module.exports = (db) => {
  const aiSupportService = new AISupportService(db);

  // ─── POST /api/support/chat ─────────────────────────────────────────────
  router.post('/chat', async (req, res) => {
    try {
      const { wallet, message, sessionId: clientSessionId } = req.body;

      // 1. Validation
      if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        return res.status(400).json({ success: false, error: 'Invalid wallet address format.' });
      }

      if (!message || message.trim().length === 0 || message.trim().length > 2000) {
        return res.status(400).json({ success: false, error: 'Message must be between 1 and 2000 characters.' });
      }

      // 2. Prompt Injection Guard
      const guardResult = PromptInjectionGuard.sanitize(message, wallet);
      const sanitizedMessage = guardResult.sanitized;

      // 3. Resolve Session
      let sessionId = clientSessionId;
      if (sessionId) {
        // Confirm session belongs to wallet
        const sessionRes = await db.query(
          'SELECT wallet_address FROM support_sessions WHERE session_id = $1',
          [sessionId]
        );
        if (sessionRes.rows.length > 0) {
          const sessionWallet = sessionRes.rows[0].wallet_address;
          if (sessionWallet.toLowerCase() !== wallet.toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Unauthorized session access.' });
          }
        } else {
          // If not in DB, insert it
          await db.query(
            `INSERT INTO support_sessions (session_id, wallet_address, status, started_at, last_message_at)
             VALUES ($1, $2, 'ACTIVE', NOW(), NOW())`,
            [sessionId, wallet]
          );
        }
      } else {
        sessionId = uuidv4();
        await db.query(
          `INSERT INTO support_sessions (session_id, wallet_address, status, started_at, last_message_at)
           VALUES ($1, $2, 'ACTIVE', NOW(), NOW())`,
          [sessionId, wallet]
        );
      }

      // Also resolve session in support_chat_sessions table
      await db.query(
        `INSERT INTO support_chat_sessions (session_id, wallet_address, status, created_at, updated_at)
         VALUES ($1, $2, 'ACTIVE', NOW(), NOW())
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, wallet]
      );

      // 4. Rate Limiting (30 messages per wallet per hour)
      const isRedisReady = redis.status === 'ready';
      let currentLimit = 0;
      const rateLimitKey = `support:ratelimit:chat:${wallet.toLowerCase()}`;
      
      if (isRedisReady) {
        try {
          currentLimit = await redis.incr(rateLimitKey);
          if (currentLimit === 1) {
            await redis.expire(rateLimitKey, 3600); // 1 hour TTL
          }
        } catch (rErr) {
          console.warn('[Redis Client] Rate limit incr failed:', rErr.message);
        }
      } else {
        console.warn('[Redis Client] Redis is offline. Skipping rate limiting check.');
      }

      if (currentLimit > 30) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded: 30 messages per hour. Please try again later.',
          retryAfter: 3600
        });
      }

      // 5. Context Refresh & Caching Logic
      const refreshPhrases = ['just paid', 'just made', 'just sent', 'just transferred', 'status changed', 'just updated', 'just tried'];
      const triggerRefresh = refreshPhrases.some(phrase => message.toLowerCase().includes(phrase));

      const contextKey = `support:session:${sessionId}:context`;
      const contextRawKey = `support:session:${sessionId}:context:raw`;

      if (triggerRefresh && isRedisReady) {
        try {
          await redis.del(contextKey);
          await redis.del(contextRawKey);
        } catch (rErr) {
          console.warn('[Redis Client] Cache invalidate failed:', rErr.message);
        }
      }

      let contextText = null;
      if (isRedisReady) {
        try {
          contextText = await redis.get(contextKey);
        } catch (rErr) {
          console.warn('[Redis Client] Cache read failed:', rErr.message);
        }
      }

      if (!contextText) {
        const rawContext = await aiSupportService.buildUserContext(wallet);
        contextText = aiSupportService.contextToText(rawContext);
        if (isRedisReady) {
          try {
            await redis.set(contextKey, contextText, 'EX', 7200); // 2 hours
            await redis.set(contextRawKey, JSON.stringify(rawContext), 'EX', 7200);
          } catch (rErr) {
            console.warn('[Redis Client] Cache write failed:', rErr.message);
          }
        }
      }

      // 5.5 Write User Message to Database
      const userChatMsgRes = await db.query(
        `INSERT INTO support_chat_messages (session_id, role, message, timestamp)
         VALUES ($1, 'user', $2, NOW())
         RETURNING id`,
        [sessionId, sanitizedMessage]
      );
      const userMessageId = userChatMsgRes.rows[0]?.id;

      // Legacy user message write
      await db.query(
        `INSERT INTO support_messages (id, session_id, wallet_address, sender_type, sender_name, content, created_at)
         VALUES ($1, $2, $3, 'user', $3, $4, NOW())`,
        [userMessageId, sessionId, wallet, sanitizedMessage]
      );

      // 6. Enqueue BullMQ AI Job if Redis is ready
      let job = null;

      if (isRedisReady) {
        try {
          job = await aiQueue.add('process_chat', {
            sessionId,
            wallet,
            message: sanitizedMessage,
            contextText,
            userMessageId
          });

          return res.json({
            success: true,
            sessionId,
            status: 'processing',
            messageId: job.id
          });
        } catch (queueErr) {
          console.warn('[Queue System] Redis/BullMQ connection failed. Falling back to synchronous processing:', queueErr.message);
        }
      }

      // 7. Synchronous Fallback Execution (if Redis is offline or queue enqueuing failed)
      if (!job) {
        const rawContext = await aiSupportService.buildUserContext(wallet);
        const aiResponse = await aiSupportService.getCompletion(sessionId, wallet, sanitizedMessage, contextText);

        const SeverityEngine = require('../services/SeverityEngine');
        const TicketManager = require('../services/TicketManager');
        const ticketManager = new TicketManager(db);
        const severityEngine = new SeverityEngine(db, ticketManager);
        const classification = await severityEngine.classify(sanitizedMessage, rawContext);

        // Save AI message to support_chat_messages (new table)
        const aiChatMsgRes = await db.query(
          `INSERT INTO support_chat_messages (session_id, role, message, timestamp)
           VALUES ($1, 'assistant', $2, NOW())
           RETURNING id`,
          [sessionId, aiResponse.answer]
        );
        const aiMessageId = aiChatMsgRes.rows[0]?.id;

        // Legacy AI message write
        await db.query(
          `INSERT INTO support_messages (id, session_id, wallet_address, sender_type, sender_name, content, created_at)
           VALUES ($1, $2, $3, 'ai', 'Pharos', $4, NOW())`,
          [aiMessageId, sessionId, wallet, aiResponse.answer]
        );

        // Save AI analysis details
        await db.query(
          `INSERT INTO ai_analyses (
            message_id, severity, category, confidence, needs_escalation, 
            escalation_reason, root_cause, suggested_actions, estimated_resolution, 
            model_used, processing_ms
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            userMessageId,
            classification.severity,
            classification.category,
            classification.confidence,
            classification.needsEscalation,
            classification.escalationReason,
            classification.rootCause,
            classification.suggestedActions,
            classification.estimatedResolutionTime,
            aiResponse.modelUsed || 'google/gemini-2.5-flash',
            aiResponse.processingMs || 0
          ]
        );

        // Update session counts and last message times
        await db.query(
          `UPDATE support_sessions 
           SET message_count = message_count + 2, last_message_at = NOW()
           WHERE session_id = $1`,
          [sessionId]
        );

        await db.query(
          `UPDATE support_chat_sessions
           SET updated_at = NOW()
           WHERE session_id = $1`,
          [sessionId]
        );

        let ticketId = null;
        if (classification.severity === 'CRITICAL' && classification.confidence > 0.80) {
          const autoTicket = await severityEngine.handleAutoTicket(wallet, classification, sanitizedMessage);
          if (autoTicket) {
            ticketId = autoTicket.id;
            await db.query(
              `UPDATE support_sessions SET ticket_id = $1, status = 'HANDOFF' WHERE session_id = $2`,
              [ticketId, sessionId]
            );
            await db.query(
              `UPDATE support_chat_sessions SET ticket_id = $1, status = 'HANDOFF', updated_at = NOW() WHERE session_id = $2`,
              [ticketId, sessionId]
            );
          }
        }

        const payload = {
          messageId: aiMessageId,
          sessionId,
          answer: aiResponse.answer,
          severity: classification.severity,
          category: classification.category,
          confidence: classification.confidence,
          needsEscalation: classification.needsEscalation,
          escalationReason: classification.escalationReason,
          suggestedActions: classification.suggestedActions,
          relatedPayments: rawContext.recentPayments.slice(0, 2),
          modelUsed: aiResponse.modelUsed,
          processingMs: aiResponse.processingMs,
          ticketId
        };

        return res.json({
          success: true,
          sessionId,
          status: 'completed',
          data: payload
        });
      }

    } catch (err) {
      console.error('Support chat handler failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/support/chat/:messageId/result ────────────────────────────
  router.get('/chat/:messageId/result', async (req, res) => {
    const { messageId } = req.params;

    try {
      const job = await aiQueue.getJob(messageId);
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      // Long polling up to 30 seconds
      let state = await job.getState();
      let pollCount = 0;

      while ((state === 'active' || state === 'waiting' || state === 'delayed') && pollCount < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        state = await job.getState();
        pollCount++;
      }

      if (state === 'completed') {
        return res.json({ success: true, status: 'completed', data: job.returnvalue });
      } else if (state === 'failed') {
        return res.status(500).json({ success: false, status: 'failed', error: job.failedReason });
      } else {
        // Return fallback keywords response if timeout exceeded
        const jobData = job.data;
        const fallback = aiSupportService.keywordFallback(jobData.message || '');
        return res.json({
          success: true,
          status: 'timeout_fallback',
          data: {
            ...fallback,
            sessionId: jobData.sessionId,
            messageId
          }
        });
      }

    } catch (err) {
      console.error('Failed to get chat result:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });  // ─── GET /api/support/session/:sessionId/messages ──────────────────────
  router.get('/session/:sessionId/messages', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await db.query(
        `SELECT id, 
                CASE role 
                  WHEN 'user' THEN 'user' 
                  WHEN 'assistant' THEN 'ai' 
                  ELSE 'system' 
                END as "senderType",
                CASE role 
                  WHEN 'user' THEN 'User' 
                  WHEN 'assistant' THEN 'Pharos' 
                  ELSE 'System' 
                END as "senderName",
                message as "content", 
                timestamp as "createdAt"
         FROM support_chat_messages 
         WHERE session_id = $1 
         ORDER BY timestamp ASC`,
        [sessionId]
      );
      res.json({ success: true, messages: result.rows });
    } catch (err) {
      console.error('Failed to get session messages:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/support/sessions/wallet/:wallet ──────────────────────────
  router.get('/sessions/wallet/:wallet', async (req, res) => {
    try {
      const { wallet } = req.params;
      const result = await db.query(
        `SELECT s.session_id as "sessionId", s.status, s.created_at as "startedAt", s.updated_at as "lastMessageAt",
                COALESCE((SELECT COUNT(*) FROM support_chat_messages m WHERE m.session_id = s.session_id), 0) as "messageCount"
         FROM support_chat_sessions s
         WHERE LOWER(s.wallet_address) = LOWER($1)
         ORDER BY s.updated_at DESC LIMIT 20`,
        [wallet]
      );
      res.json({ success: true, sessions: result.rows });
    } catch (err) {
      console.error('Failed to get wallet sessions:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // GET /api/support/status
  router.get('/status', (req, res) => {
    try {
      const status = AIProvider.getStatus();
      if (status.enabled) {
        return res.json({
          enabled: true,
          provider: status.provider,
          model: status.model
        });
      } else {
        return res.json({
          enabled: false,
          reason: status.reason
        });
      }
    } catch (err) {
      console.error('Failed to get support status:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
