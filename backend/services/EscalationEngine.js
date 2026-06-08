const emailQueue = require('../queues/emailQueue');

const SLA_MAP = {
  'CRITICAL': 1,
  'HIGH': 4,
  'MEDIUM': 12,
  'LOW': 24
};

class EscalationEngine {
  constructor(db, ticketManager) {
    this.db = db;
    this.ticketManager = ticketManager;
  }

  /**
   * Main escalation coordinator creating contacts, events, analysis, and queueing notification jobs
   */
  async createEscalation({ sessionId, wallet, email, telegram, discord, twitter, description, severity, confidence, ticketId, walletAddress, transactionHash }) {
    const resolvedSeverity = (severity || 'MEDIUM').toUpperCase();
    const slaHours = SLA_MAP[resolvedSeverity] || 12;
    const resolvedConfidence = confidence !== undefined ? parseFloat(confidence) : 0.85;

    const formattedDescription = `[USER ESCALATION DETAILS]
Wallet Address: ${walletAddress || wallet}
Transaction Hash: ${transactionHash || 'N/A'}
Issue Description: ${description || 'No description provided.'}`;

    let ticket;
    let isAutoCreated = false;

    if (ticketId) {
      // Retrieve already auto-created ticket
      const checkRes = await this.db.query(
        'SELECT * FROM support_tickets WHERE id = $1',
        [ticketId]
      );
      if (checkRes.rows.length > 0) {
        ticket = checkRes.rows[0];
        isAutoCreated = true;
        // Optionally update the description with user-added context
        await this.db.query(
          'UPDATE support_tickets SET description = $1, updated_at = NOW() WHERE id = $2',
          [`${ticket.description}\n\n${formattedDescription}`, ticketId]
        );
      }
    }

    if (!ticket) {
      // Create new ticket using the ticket manager
      ticket = await this.ticketManager.createTicket({
        userWallet: wallet,
        subject: `ESCALATED support request (${resolvedSeverity})`,
        description: formattedDescription,
        category: 'general',
        priority: resolvedSeverity.toLowerCase() === 'critical' ? 'urgent' : resolvedSeverity.toLowerCase()
      });
    }

    // Update status to open or in_progress if needed
    if (ticket.status !== 'open') {
      await this.db.query(
        "UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = $1",
        [ticket.id]
      );
    }

    // 1. Create support_contact entry
    await this.db.query(
      `INSERT INTO support_contacts (ticket_id, email, telegram, discord, twitter, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        ticket.id, 
        email, 
        telegram || null, 
        discord || null, 
        twitter || null, 
        `Wallet Address: ${walletAddress || wallet}\nTx Hash: ${transactionHash || 'N/A'}`
      ]
    );

    // 2. Check if ai_analyses already exists for this ticket, if not create it
    const analysisCheck = await this.db.query(
      'SELECT id FROM ai_analyses WHERE ticket_id = $1',
      [ticket.id]
    );
    let aiAnalysis;
    if (analysisCheck.rows.length === 0) {
      const suggestedActions = ['Review recent transaction status', 'Examine recipient wallet address'];
      const rootCause = 'User initiated manual escalation flow';
      const estimatedResolution = `${slaHours} hours`;

      const insertAnalysis = await this.db.query(
        `INSERT INTO ai_analyses 
          (ticket_id, severity, category, confidence, needs_escalation, root_cause, suggested_actions, estimated_resolution, model_used, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [ticket.id, resolvedSeverity, 'general_question', resolvedConfidence, true, rootCause, suggestedActions, estimatedResolution, 'rule-fallback']
      );
      aiAnalysis = insertAnalysis.rows[0];
    } else {
      aiAnalysis = analysisCheck.rows[0];
    }

    // 3. Create escalation_event entry
    const triggerSource = isAutoCreated ? 'AI_AUTO' : 'USER_REQUEST';
    await this.db.query(
      `INSERT INTO escalation_events (ticket_id, trigger_source, severity, confidence, wallet_address, session_id, email_sent_to, email_sent_at, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [ticket.id, triggerSource, resolvedSeverity, resolvedConfidence, wallet, sessionId || null, email]
    );

    // 4. Update session ticket association if session exists
    if (sessionId) {
      await this.db.query(
        `UPDATE support_sessions
         SET ticket_id = $1, status = 'HANDOFF', last_message_at = NOW()
         WHERE session_id = $2`,
        [ticket.id, sessionId]
      );
    }

    // 5. Enqueue email notification jobs in emailQueue
    const ADMIN_EMAIL = process.env.ADMIN_SUPPORT_EMAIL || 'support@pharospay.xyz';
    
    // User confirmation email job
    await emailQueue.add('ticket_confirm', {
      email,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        slaHours
      }
    });

    // Admin alert email job
    await emailQueue.add('escalation_admin', {
      adminEmail: ADMIN_EMAIL,
      ticket: {
        ticketNumber: ticket.ticket_number,
        userWallet: ticket.user_wallet,
        priority: ticket.priority,
        category: ticket.category,
        description: description || ticket.description
      },
      contactInfo: {
        email,
        telegram,
        discord
      },
      aiAnalysis: {
        confidence: resolvedConfidence,
        rootCause: aiAnalysis.root_cause || 'User manual request',
        estimatedResolution: aiAnalysis.estimated_resolution || `${slaHours} hours`
      }
    });

    // Construct reply message
    const confirmMessage = `Your issue has been escalated. Here are your details:

Ticket ID: ${ticket.ticket_number}
Severity: ${resolvedSeverity}
Expected response: within ${slaHours} hour(s)

A detailed report with your conversation history, payment data, and AI analysis has been sent to support@pharospay.xyz.

You can track your ticket at: pharospay.xyz/support/tickets/${ticket.id}

Is there anything else you'd like to add before our team reviews your case?`;

    // Add confirmation message to ticket replies
    await this.ticketManager.addReply(ticket.id, confirmMessage, 'system', 'PharosPay System');

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      estimatedResponseHours: slaHours,
      message: confirmMessage
    };
  }
}

module.exports = EscalationEngine;
