class HumanHandoffService {
  constructor(db) {
    this.db = db;
    this.io = null;
    this.timeouts = new Map(); // Keep track of handoff timeouts
  }

  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Triggers a request for human intervention
   */
  async requestHandoff(sessionId, ticketId, reason, wallet) {
    let resolvedTicketId = ticketId;

    if (!resolvedTicketId) {
      // Find open ticket for this session/wallet or create one
      const openTicketRes = await this.db.query(
        `SELECT id FROM support_tickets WHERE LOWER(user_wallet) = LOWER($1) AND status = 'open' LIMIT 1`,
        [wallet]
      );
      if (openTicketRes.rows.length > 0) {
        resolvedTicketId = openTicketRes.rows[0].id;
      } else {
        // Create fallback ticket
        const ticketRes = await this.db.query(
          `INSERT INTO support_tickets (ticket_number, user_wallet, category, priority, subject, description, status)
           VALUES ($1, $2, 'general', 'medium', 'Handoff Request', $3, 'open')
           RETURNING id`,
          ['TKT-' + Math.random().toString(36).substring(2, 7).toUpperCase(), wallet, reason || 'User requested human agent.']
        );
        resolvedTicketId = ticketRes.rows[0].id;
      }
    }

    // Check if handoff record already exists in active/requested state
    const checkHandoff = await this.db.query(
      `SELECT * FROM human_handoffs WHERE session_id = $1 AND status IN ('REQUESTED', 'ACTIVE')`,
      [sessionId]
    );

    if (checkHandoff.rows.length > 0) {
      return checkHandoff.rows[0];
    }

    const insertRes = await this.db.query(
      `INSERT INTO human_handoffs (ticket_id, session_id, requested_by, request_reason, status, requested_at)
       VALUES ($1, $2, $3, $4, 'REQUESTED', NOW())
       RETURNING *`,
      [resolvedTicketId, sessionId, wallet, reason]
    );

    const handoff = insertRes.rows[0];

    // Update support session status in DB
    await this.db.query(
      `UPDATE support_sessions 
       SET status = 'HANDOFF', is_human_active = false, last_message_at = NOW() 
       WHERE session_id = $1`,
      [sessionId]
    );

    // Emit Socket.IO event to admin namespace/room
    if (this.io) {
      this.io.to('admin_room').emit('admin:handoff_requested', {
        handoffId: handoff.id,
        ticketId: resolvedTicketId,
        sessionId,
        wallet,
        summary: reason || 'Live chat request'
      });
    }

    // Set 10-minute timeout for agent to join
    const timeout = setTimeout(async () => {
      await this.handleTimeout(sessionId, handoff.id);
    }, 10 * 60 * 1000); // 10 minutes

    this.timeouts.set(handoff.id, timeout);

    return handoff;
  }

  /**
   * Action when agent accepts the chat handoff request
   */
  async acceptHandoff(handoffId, agentId) {
    const res = await this.db.query(
      `UPDATE human_handoffs
       SET status = 'ACTIVE', agent_id = $1, accepted_at = NOW()
       WHERE id = $2 AND status = 'REQUESTED'
       RETURNING *`,
      [agentId, handoffId]
    );

    if (res.rows.length === 0) {
      throw new Error('Handoff request not found or already processed.');
    }

    const handoff = res.rows[0];

    // Clear timeout if exists
    if (this.timeouts.has(handoffId)) {
      clearTimeout(this.timeouts.get(handoffId));
      this.timeouts.delete(handoffId);
    }

    // Update session
    await this.db.query(
      `UPDATE support_sessions 
       SET is_human_active = true, last_message_at = NOW() 
       WHERE session_id = $1`,
      [handoff.session_id]
    );

    // Notify user client via socket
    if (this.io) {
      this.io.to(`session:${handoff.session_id}`).emit('support:handoff_status', {
        status: 'ACTIVE',
        agentId,
        message: 'You are now speaking with a PharosPay agent'
      });
    }

    return handoff;
  }

  /**
   * Action when agent releases session back to AI
   */
  async releaseHandoff(ticketId) {
    const res = await this.db.query(
      `UPDATE human_handoffs
       SET status = 'RELEASED', released_at = NOW()
       WHERE ticket_id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [ticketId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const handoff = res.rows[0];

    // Update session
    await this.db.query(
      `UPDATE support_sessions 
       SET is_human_active = false, status = 'ACTIVE', last_message_at = NOW() 
       WHERE session_id = $1`,
      [handoff.session_id]
    );

    // Notify user client via socket
    if (this.io) {
      this.io.to(`session:${handoff.session_id}`).emit('support:handoff_status', {
        status: 'RELEASED',
        message: 'Agent has left. AI Assistant is now active.'
      });
    }

    return handoff;
  }

  /**
   * Timeouts handler if no agents join the chat
   */
  async handleTimeout(sessionId, handoffId) {
    this.timeouts.delete(handoffId);

    const res = await this.db.query(
      `UPDATE human_handoffs
       SET status = 'TIMED_OUT', released_at = NOW()
       WHERE id = $1 AND status = 'REQUESTED'
       RETURNING *`,
      [handoffId]
    );

    if (res.rows.length > 0) {
      const handoff = res.rows[0];

      // Revert session back to active AI state
      await this.db.query(
        `UPDATE support_sessions 
         SET is_human_active = false, status = 'ACTIVE', last_message_at = NOW() 
         WHERE session_id = $1`,
        [sessionId]
      );

      // Notify user via socket
      if (this.io) {
        this.io.to(`session:${sessionId}`).emit('support:handoff_status', {
          status: 'TIMED_OUT',
          message: 'No agents are currently available. Returning you to the AI Assistant.'
        });
      }
    }
  }
}

module.exports = HumanHandoffService;
