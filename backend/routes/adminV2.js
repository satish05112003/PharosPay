const express = require('express');
const router = express.Router();
const TicketManager = require('../services/TicketManager');
const SeverityEngine = require('../services/SeverityEngine');
const AISupportService = require('../services/AISupportService');
const SupportAnalyticsService = require('../services/SupportAnalyticsService');
const HumanHandoffService = require('../services/HumanHandoffService');
const aiQueue = require('../queues/aiQueue');
const escalationQueue = require('../queues/escalationQueue');
const emailQueue = require('../queues/emailQueue');

module.exports = (db) => {
  const ticketManager = new TicketManager(db);
  const severityEngine = new SeverityEngine(db, ticketManager);
  const aiSupportService = new AISupportService(db);
  const analyticsService = new SupportAnalyticsService(db, { aiQueue, escalationQueue, emailQueue });
  const handoffService = new HumanHandoffService(db);

  // Set Socket.IO dynamically (referenced from server.js bootstrap)
  router.setSocketIO = (io) => {
    handoffService.setSocketIO(io);
  };

  // ─── POST /api/admin/support/tickets/:ticketId/reanalyze ───────────────
  router.post('/tickets/:ticketId/reanalyze', async (req, res) => {
    const { ticketId } = req.params;

    try {
      const ticket = await db.supportTickets.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      const messages = await db.supportTickets.getMessages(ticketId);
      const userText = messages.find(m => m.sender_type === 'user')?.message || ticket.description || '';
      
      const context = await aiSupportService.buildUserContext(ticket.user_wallet);
      const classification = await severityEngine.classify(userText, context);

      // Upsert analysis
      const existing = await db.query('SELECT id FROM ai_analyses WHERE ticket_id = $1', [ticketId]);
      
      let analysis;
      if (existing.rows.length > 0) {
        const updateRes = await db.query(
          `UPDATE ai_analyses
           SET severity = $1, category = $2, confidence = $3, needs_escalation = $4,
               escalation_reason = $5, root_cause = $6, suggested_actions = $7,
               estimated_resolution = $8, created_at = NOW()
           WHERE ticket_id = $9
           RETURNING *`,
          [
            classification.severity,
            classification.category,
            classification.confidence,
            classification.needsEscalation,
            classification.escalationReason,
            classification.rootCause,
            classification.suggestedActions,
            classification.estimatedResolutionTime,
            ticketId
          ]
        );
        analysis = updateRes.rows[0];
      } else {
        const insertRes = await db.query(
          `INSERT INTO ai_analyses (
             ticket_id, severity, category, confidence, needs_escalation,
             escalation_reason, root_cause, suggested_actions, estimated_resolution, model_used
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            ticketId,
            classification.severity,
            classification.category,
            classification.confidence,
            classification.needsEscalation,
            classification.escalationReason,
            classification.rootCause,
            classification.suggestedActions,
            classification.estimatedResolutionTime,
            'google/gemini-2.5-flash'
          ]
        );
        analysis = insertRes.rows[0];
      }

      res.json({ success: true, analysis });
    } catch (err) {
      console.error('Re-analysis failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/tickets/:ticketId/analysis ──────────────────
  router.get('/tickets/:ticketId/analysis', async (req, res) => {
    const { ticketId } = req.params;
    try {
      const result = await db.query(
        'SELECT * FROM ai_analyses WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1',
        [ticketId]
      );
      res.json({ success: true, analysis: result.rows[0] || null });
    } catch (err) {
      console.error('Failed to get ticket analysis:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/tickets/:ticketId/escalations ───────────────
  router.get('/tickets/:ticketId/escalations', async (req, res) => {
    const { ticketId } = req.params;
    try {
      const events = await db.query(
        'SELECT id, trigger_source as "triggerSource", severity, confidence, wallet_address as "walletAddress", session_id as "sessionId", email_sent_to as "emailSentTo", email_sent_at as "emailSentAt", occurred_at as "occurredAt" FROM escalation_events WHERE ticket_id = $1 ORDER BY occurred_at DESC',
        [ticketId]
      );
      const contacts = await db.query(
        'SELECT id, email, telegram, discord, twitter, notes, created_at as "createdAt" FROM support_contacts WHERE ticket_id = $1 ORDER BY created_at DESC',
        [ticketId]
      );
      res.json({ success: true, events: events.rows, contacts: contacts.rows });
    } catch (err) {
      console.error('Failed to get ticket escalations:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── PATCH /api/admin/support/tickets/:ticketId/assign ─────────────────
  router.patch('/tickets/:ticketId/assign', async (req, res) => {
    const { ticketId } = req.params;
    const { agentId } = req.body;

    try {
      const result = await db.query(
        `UPDATE support_tickets 
         SET assigned_merchant_id = $1, status = 'in_progress', updated_at = NOW() 
         WHERE id = $2
         RETURNING *`,
        [agentId || null, ticketId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      // Add assignment system message
      await ticketManager.addReply(
        ticketId,
        agentId ? `Ticket assigned to agent: ${agentId}` : 'Ticket unassigned.',
        'system',
        'PharosPay System'
      );

      res.json({ success: true, ticket: result.rows[0] });
    } catch (err) {
      console.error('Assignment failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── PATCH /api/admin/support/tickets/:ticketId/handoff ────────────────
  router.patch('/tickets/:ticketId/handoff', async (req, res) => {
    const { ticketId } = req.params;
    const { action, agentId } = req.body; // accept | release | transfer

    try {
      if (action === 'accept') {
        if (!agentId) {
          return res.status(400).json({ success: false, error: 'agentId is required to accept handoff.' });
        }
        // Find requested handoff
        const handoffRes = await db.query(
          `SELECT id FROM human_handoffs WHERE ticket_id = $1 AND status = 'REQUESTED' LIMIT 1`,
          [ticketId]
        );
        if (handoffRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'No active handoff request found.' });
        }
        const handoff = await handoffService.acceptHandoff(handoffRes.rows[0].id, agentId);
        // Also assign ticket to agent
        await db.query(
          `UPDATE support_tickets SET assigned_merchant_id = $1, status = 'in_progress' WHERE id = $2`,
          [agentId, ticketId]
        );
        return res.json({ success: true, handoff });

      } else if (action === 'release') {
        const handoff = await handoffService.releaseHandoff(ticketId);
        if (!handoff) {
          return res.status(404).json({ success: false, error: 'No active human session found to release.' });
        }
        return res.json({ success: true, handoff });

      } else if (action === 'transfer') {
        if (!agentId) {
          return res.status(400).json({ success: false, error: 'agentId is required for transfer.' });
        }
        // Update handoff agent
        await db.query(
          `UPDATE human_handoffs SET agent_id = $1 WHERE ticket_id = $2 AND status = 'ACTIVE'`,
          [agentId, ticketId]
        );
        await db.query(
          `UPDATE support_tickets SET assigned_merchant_id = $1 WHERE id = $2`,
          [agentId, ticketId]
        );
        return res.json({ success: true, message: `Chat transferred to agent ${agentId}` });
      }

      res.status(400).json({ success: false, error: 'Invalid handoff action. Valid actions: accept, release, transfer' });
    } catch (err) {
      console.error('Handoff action failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/analytics/overview ──────────────────────────
  router.get('/analytics/overview', async (req, res) => {
    try {
      const stats = await analyticsService.getOverviewStats();
      res.json({ success: true, stats });
    } catch (err) {
      console.error('Failed to get overview stats:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/analytics/daily ─────────────────────────────
  router.get('/analytics/daily', async (req, res) => {
    const days = req.query.days ? parseInt(req.query.days) : 90;
    try {
      const data = await analyticsService.getDailyTickets(days);
      res.json({ success: true, data });
    } catch (err) {
      console.error('Failed to get daily stats:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/analytics/categories ────────────────────────
  router.get('/analytics/categories', async (req, res) => {
    try {
      const categories = await analyticsService.getCategoryBreakdown();
      res.json({ success: true, categories });
    } catch (err) {
      console.error('Failed to get categories stats:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/export ──────────────────────────────────────
  router.get('/export', async (req, res) => {
    const { severity, status, category } = req.query;

    try {
      let query = 'SELECT ticket_number, user_wallet, category, priority, subject, status, created_at FROM support_tickets WHERE 1=1';
      const params = [];
      let idx = 1;

      if (severity && severity !== 'all') {
        query += ` AND priority = $${idx}`;
        params.push(severity.toLowerCase());
        idx++;
      }
      if (status && status !== 'all') {
        query += ` AND status = $${idx}`;
        params.push(status.toLowerCase());
        idx++;
      }
      if (category && category !== 'all') {
        query += ` AND category = $${idx}`;
        params.push(category.toLowerCase());
        idx++;
      }

      query += ' ORDER BY created_at DESC';
      const result = await db.query(query, params);

      let csv = 'Ticket Number,Wallet Address,Category,Priority,Subject,Status,Created At\n';
      result.rows.forEach(t => {
        csv += `"${t.ticket_number}","${t.user_wallet}","${t.category}","${t.priority}","${t.subject.replace(/"/g, '""')}","${t.status}","${t.created_at.toISOString()}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=support-tickets.csv');
      res.send(csv);

    } catch (err) {
      console.error('Failed to export tickets CSV:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/admin/support/queues ──────────────────────────────────────
  router.get('/queues', async (req, res) => {
    try {
      const getStats = async (queue) => {
        if (!queue) return { active: 0, waiting: 0, failed: 0 };
        return {
          active: await queue.getActiveCount(),
          waiting: await queue.getWaitingCount(),
          failed: await queue.getFailedCount()
        };
      };

      const aiStats = await getStats(aiQueue);
      const escalationStats = await getStats(escalationQueue);
      const emailStats = await getStats(emailQueue);

      res.json({
        success: true,
        queues: {
          aiQueue: aiStats,
          escalationQueue: escalationStats,
          emailQueue: emailStats
        }
      });
    } catch (err) {
      console.error('Queue analytics lookup failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
