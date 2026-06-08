const express = require('express');
const router = express.Router();

module.exports = (ticketManager, db) => {
  // ─── POST /api/support/tickets ─────────────────────────────────────────
  // Create a new support ticket
  router.post('/tickets', async (req, res) => {
    try {
      const { wallet, paymentId, subject, description, category, priority } = req.body;

      if (!wallet || !subject) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: wallet, subject'
        });
      }

      const ticket = await ticketManager.createTicket({
        userWallet: wallet,
        paymentId: paymentId || null,
        subject,
        description: description || '',
        category: category || null,
        priority: priority || null
      });

      res.status(201).json({
        success: true,
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticket_number,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          subject: ticket.subject,
          createdAt: ticket.created_at
        }
      });
    } catch (err) {
      console.error('Failed to create support ticket:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/support/tickets ──────────────────────────────────────────
  // List tickets for a wallet (query: ?wallet=0x...)
  router.get('/tickets', async (req, res) => {
    try {
      const { wallet, status, category, limit, offset } = req.query;

      let tickets;
      if (wallet) {
        tickets = await db.supportTickets.findByWallet(wallet, {
          status,
          category,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined
        });
      } else {
        // Admin: list all tickets
        tickets = await db.supportTickets.getAll({
          status,
          category,
          limit: limit ? parseInt(limit) : 50,
          offset: offset ? parseInt(offset) : undefined
        });
      }

      const formatted = tickets.map(t => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        userWallet: t.user_wallet,
        paymentId: t.payment_id,
        category: t.category,
        priority: t.priority,
        subject: t.subject,
        status: t.status,
        assignedMerchantId: t.assigned_merchant_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        resolvedAt: t.resolved_at
      }));

      res.json({
        success: true,
        tickets: formatted,
        count: formatted.length
      });
    } catch (err) {
      console.error('Failed to list support tickets:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/support/tickets/:ticketId ────────────────────────────────
  // Get ticket detail with message thread
  router.get('/tickets/:ticketId', async (req, res) => {
    try {
      const { ticketId } = req.params;

      const detail = await ticketManager.getTicketDetail(ticketId);
      if (!detail) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      res.json({
        success: true,
        ticket: {
          id: detail.id,
          ticketNumber: detail.ticket_number,
          userWallet: detail.user_wallet,
          paymentId: detail.payment_id,
          category: detail.category,
          priority: detail.priority,
          subject: detail.subject,
          description: detail.description,
          status: detail.status,
          assignedMerchantId: detail.assigned_merchant_id,
          createdAt: detail.created_at,
          updatedAt: detail.updated_at,
          resolvedAt: detail.resolved_at,
          messages: detail.messages.map(m => ({
            id: m.id,
            senderType: m.sender_type,
            senderName: m.sender_name,
            message: m.message,
            createdAt: m.created_at
          })),
          linkedPayment: detail.linkedPayment ? {
            id: detail.linkedPayment.id,
            fiatAmount: detail.linkedPayment.fiat_amount,
            fiatCurrency: detail.linkedPayment.fiat_currency,
            status: detail.linkedPayment.status,
            merchantId: detail.linkedPayment.merchant_identifier
          } : null
        }
      });
    } catch (err) {
      console.error('Failed to get ticket detail:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── POST /api/support/tickets/:ticketId/messages ──────────────────────
  // Add reply to ticket thread
  router.post('/tickets/:ticketId/messages', async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { message, senderType, senderName } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const msg = await ticketManager.addReply(
        ticketId,
        message,
        senderType || 'user',
        senderName
      );

      // If sender is user, generate AI reply!
      if (!senderType || senderType === 'user') {
        try {
          const ticket = await ticketManager.db.supportTickets.findById(ticketId);
          if (ticket) {
            const wallet = ticket.user_wallet;
            const AISupportService = require('../services/AISupportService');
            const aiSupportService = new AISupportService(db);
            
            const rawContext = await aiSupportService.buildUserContext(wallet);
            const contextText = aiSupportService.contextToText(rawContext);
            
            // Use ticket_${ticketId} as the sessionId
            const aiResponse = await aiSupportService.getCompletion(
              `ticket_${ticketId}`,
              wallet,
              message,
              contextText
            );
            
            // Save the AI response into ticket_messages
            await ticketManager.addReply(
              ticketId,
              aiResponse.answer,
              'ai',
              'Pharos'
            );
          }
        } catch (aiErr) {
          console.error('[Ticket AI Auto-Reply] Failed to generate AI reply:', aiErr.message);
        }
      }

      res.status(201).json({
        success: true,
        message: {
          id: msg.id,
          senderType: msg.sender_type,
          senderName: msg.sender_name,
          message: msg.message,
          createdAt: msg.created_at
        }
      });
    } catch (err) {
      console.error('Failed to add ticket reply:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── PATCH /api/support/tickets/:ticketId/status ───────────────────────
  // Update ticket status (open, in_progress, resolved, closed)
  router.patch('/tickets/:ticketId/status', async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status, resolution } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, error: 'Status is required' });
      }

      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Valid values: ${validStatuses.join(', ')}`
        });
      }

      let ticket;
      if (status === 'resolved') {
        ticket = await ticketManager.resolveTicket(ticketId, resolution);
      } else if (status === 'closed') {
        ticket = await ticketManager.closeTicket(ticketId);
      } else {
        ticket = await db.supportTickets.updateStatus(ticketId, status);
      }

      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      res.json({
        success: true,
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticket_number,
          status: ticket.status,
          updatedAt: ticket.updated_at,
          resolvedAt: ticket.resolved_at
        }
      });
    } catch (err) {
      console.error('Failed to update ticket status:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── GET /api/support/stats ────────────────────────────────────────────
  // Get support metrics for admin dashboard
  router.get('/stats', async (req, res) => {
    try {
      const stats = await ticketManager.getStats();
      res.json({ success: true, stats });
    } catch (err) {
      console.error('Failed to get support stats:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
