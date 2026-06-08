/**
 * SupportTicket Model
 * Handles CRUD operations for support tickets and threaded messages
 */
class SupportTicket {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate a unique ticket number in format TKT-XXXXX
   */
  async generateTicketNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let number;
    let exists = true;
    while (exists) {
      number = 'TKT-';
      for (let i = 0; i < 5; i++) {
        number += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const check = await this.db.query(
        'SELECT id FROM support_tickets WHERE ticket_number = $1',
        [number]
      );
      exists = check.rows.length > 0;
    }
    return number;
  }

  /**
   * Create a new support ticket
   */
  async create({ userWallet, paymentId, category, priority, subject, description, assignedMerchantId }) {
    const ticketNumber = await this.generateTicketNumber();
    const result = await this.db.query(
      `INSERT INTO support_tickets 
        (ticket_number, user_wallet, payment_id, category, priority, subject, description, status, assigned_merchant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
       RETURNING *`,
      [ticketNumber, userWallet, paymentId || null, category || 'general', priority || 'medium', subject, description || '', assignedMerchantId || null]
    );
    return result.rows[0];
  }

  /**
   * Find a ticket by its UUID
   */
  async findById(id) {
    const result = await this.db.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Find a ticket by its human-readable ticket number
   */
  async findByTicketNumber(ticketNumber) {
    const result = await this.db.query('SELECT * FROM support_tickets WHERE ticket_number = $1', [ticketNumber]);
    return result.rows[0] || null;
  }

  /**
   * Find all tickets for a specific wallet
   */
  async findByWallet(wallet, { status, category, limit, offset } = {}) {
    let query = 'SELECT * FROM support_tickets WHERE LOWER(user_wallet) = LOWER($1)';
    const params = [wallet];
    let paramIdx = 2;

    if (status && status !== 'all') {
      query += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (category && category !== 'all') {
      query += ` AND category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(limit);
      paramIdx++;
    }
    if (offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(offset);
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get all tickets with optional filters (for admin view)
   */
  async getAll({ status, category, priority, limit, offset } = {}) {
    let query = 'SELECT * FROM support_tickets WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status && status !== 'all') {
      query += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (category && category !== 'all') {
      query += ` AND category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }
    if (priority && priority !== 'all') {
      query += ` AND priority = $${paramIdx}`;
      params.push(priority);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(limit);
      paramIdx++;
    }
    if (offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(offset);
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Update ticket status
   */
  async updateStatus(id, status) {
    const updates = { status, updated_at: new Date() };
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = new Date();
    }

    const result = await this.db.query(
      `UPDATE support_tickets 
       SET status = $1, updated_at = $2, resolved_at = $3
       WHERE id = $4
       RETURNING *`,
      [updates.status, updates.updated_at, updates.resolved_at || null, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Add a message to the ticket thread
   */
  async addMessage(ticketId, { senderType, senderName, message }) {
    const result = await this.db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, senderType || 'user', senderName || 'User', message]
    );

    // Update the ticket's updated_at timestamp
    await this.db.query(
      'UPDATE support_tickets SET updated_at = NOW() WHERE id = $1',
      [ticketId]
    );

    return result.rows[0];
  }

  /**
   * Get all messages for a ticket, ordered chronologically
   */
  async getMessages(ticketId) {
    const result = await this.db.query(
      'SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );
    return result.rows;
  }

  /**
   * Get aggregate stats for support dashboard
   */
  async getStats() {
    const result = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
        COUNT(*) AS total_count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) 
          FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
        COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at::date = CURRENT_DATE) AS resolved_today
      FROM support_tickets
    `);

    const stats = result.rows[0];

    // Category breakdown
    const catResult = await this.db.query(`
      SELECT category, COUNT(*) as count
      FROM support_tickets
      GROUP BY category
      ORDER BY count DESC
    `);

    return {
      open: parseInt(stats.open_count) || 0,
      inProgress: parseInt(stats.in_progress_count) || 0,
      resolved: parseInt(stats.resolved_count) || 0,
      closed: parseInt(stats.closed_count) || 0,
      total: parseInt(stats.total_count) || 0,
      avgResolutionHours: stats.avg_resolution_hours ? parseFloat(stats.avg_resolution_hours).toFixed(1) : null,
      resolvedToday: parseInt(stats.resolved_today) || 0,
      categories: catResult.rows.map(r => ({ category: r.category, count: parseInt(r.count) }))
    };
  }
}

module.exports = SupportTicket;
