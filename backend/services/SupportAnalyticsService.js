const redis = require('../config/redis');

class SupportAnalyticsService {
  constructor(db, queues = {}) {
    this.db = db;
    this.queues = queues;
  }

  /**
   * Helper to retrieve or run query with Redis cache
   */
  async _withCache(key, ttlSeconds, queryFn) {
    const cached = await redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        // Fall through
      }
    }
    const fresh = await queryFn();
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
    return fresh;
  }

  /**
   * Retrieves overall support system health metrics
   */
  async getOverviewStats() {
    return this._withCache('support:analytics:overview', 300, async () => {
      // Basic ticket counts
      const countsRes = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE priority = 'urgent' AND status != 'resolved' AND status != 'closed') as critical_open,
          COUNT(*) FILTER (WHERE priority = 'high' AND status != 'resolved' AND status != 'closed') as high_open,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE status = 'resolved') as avg_resolution_hours
        FROM support_tickets
      `);

      const c = countsRes.rows[0];

      // AI Analysis aggregates
      const aiRes = await this.db.query(`
        SELECT 
          AVG(confidence) as avg_confidence,
          COUNT(*) FILTER (WHERE injection_detected = true) as injections
        FROM ai_analyses
      `);
      const ai = aiRes.rows[0];

      // Auto-escalated tickets count
      const autoEscRes = await this.db.query(
        "SELECT COUNT(*) as count FROM escalation_events WHERE trigger_source = 'AI_AUTO'"
      );

      // Ticket counts by period
      const periodRes = await this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as week
        FROM support_tickets
      `);
      const periods = periodRes.rows[0];

      // Active handoffs
      const handoffsRes = await this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'REQUESTED') as requested,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as active
        FROM human_handoffs
      `);
      const handoffs = handoffsRes.rows[0];

      // Top categories
      const categoriesRes = await this.db.query(`
        SELECT category, COUNT(*) as count
        FROM support_tickets
        GROUP BY category
        ORDER BY count DESC
        LIMIT 5
      `);

      // SLA Breaches
      const breaches = await this.getSLABreaches();

      // Queue Health stats
      const queueHealth = {
        aiQueue: await this._getQueueStats(this.queues.aiQueue),
        emailQueue: await this._getQueueStats(this.queues.emailQueue),
        escalationQueue: await this._getQueueStats(this.queues.escalationQueue)
      };

      return {
        totalTickets: parseInt(c.total || '0'),
        openTickets: parseInt(c.open || '0'),
        inProgressTickets: parseInt(c.in_progress || '0'),
        resolvedTickets: parseInt(c.resolved || '0'),
        criticalOpenTickets: parseInt(c.critical_open || '0'),
        highOpenTickets: parseInt(c.high_open || '0'),
        avgResolutionHours: c.avg_resolution_hours ? parseFloat(Number(c.avg_resolution_hours).toFixed(1)) : 0,
        avgConfidenceScore: ai.avg_confidence ? parseFloat(Number(ai.avg_confidence).toFixed(2)) : 0,
        autoEscalatedCount: parseInt(autoEscRes.rows[0]?.count || '0'),
        injectionAttemptsCount: parseInt(ai.injections || '0'),
        ticketsToday: parseInt(periods.today || '0'),
        ticketsThisWeek: parseInt(periods.week || '0'),
        pendingHandoffs: parseInt(handoffs.requested || '0'),
        activeHandoffs: parseInt(handoffs.active || '0'),
        topCategories: categoriesRes.rows.map(r => ({ category: r.category, count: parseInt(r.count) })),
        slaBreachCount: breaches.length,
        queueHealth
      };
    });
  }

  /**
   * Retrieves daily ticket volumes grouped by severity
   */
  async getDailyTickets(days = 90) {
    const cacheKey = `support:analytics:daily:${days}`;
    return this._withCache(cacheKey, 3600, async () => {
      const res = await this.db.query(`
        SELECT 
          created_at::date as date,
          COUNT(*) FILTER (WHERE priority = 'low') as low,
          COUNT(*) FILTER (WHERE priority = 'medium') as medium,
          COUNT(*) FILTER (WHERE priority = 'high') as high,
          COUNT(*) FILTER (WHERE priority = 'urgent') as critical,
          COUNT(*) as total
        FROM support_tickets
        WHERE created_at >= NOW() - $1 * INTERVAL '1 day'
        GROUP BY created_at::date
        ORDER BY date ASC
      `, [days]);

      return res.rows.map(r => ({
        date: r.date.toISOString().split('T')[0],
        LOW: parseInt(r.low || '0'),
        MEDIUM: parseInt(r.medium || '0'),
        HIGH: parseInt(r.high || '0'),
        CRITICAL: parseInt(r.critical || '0'),
        total: parseInt(r.total || '0')
      }));
    });
  }

  /**
   * Groups tickets by category with metrics
   */
  async getCategoryBreakdown() {
    return this._withCache('support:analytics:categories', 3600, async () => {
      const res = await this.db.query(`
        SELECT 
          t.category,
          COUNT(t.id) as count,
          AVG(a.confidence) as avg_confidence,
          AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) FILTER (WHERE t.status = 'resolved') as avg_resolution_hours
        FROM support_tickets t
        LEFT JOIN ai_analyses a ON t.id = a.ticket_id
        GROUP BY t.category
        ORDER BY count DESC
      `);

      return res.rows.map(r => ({
        category: r.category,
        count: parseInt(r.count || '0'),
        avgConfidence: r.avg_confidence ? parseFloat(Number(r.avg_confidence).toFixed(2)) : 0,
        avgResolutionHours: r.avg_resolution_hours ? parseFloat(Number(r.avg_resolution_hours).toFixed(1)) : 0
      }));
    });
  }

  /**
   * Retrieves all tickets currently breaching SLA rules
   */
  async getSLABreaches() {
    // Overdue tickets where NOW() > created_at + SLA interval
    // SLA Maps: urgent/critical: 1h, high: 4h, medium: 12h, low: 24h
    const query = `
      SELECT t.id, t.ticket_number, t.priority, t.created_at,
        EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as hours_overdue
      FROM support_tickets t
      WHERE t.status IN ('open', 'in_progress')
        AND (
          (t.priority = 'urgent' AND t.created_at < NOW() - INTERVAL '1 hour') OR
          (t.priority = 'high' AND t.created_at < NOW() - INTERVAL '4 hours') OR
          (t.priority = 'medium' AND t.created_at < NOW() - INTERVAL '12 hours') OR
          (t.priority = 'low' AND t.created_at < NOW() - INTERVAL '24 hours')
        )
        AND NOT EXISTS (
          SELECT 1 FROM ticket_messages m 
          WHERE m.ticket_id = t.id AND m.sender_type = 'agent'
        )
      ORDER BY hours_overdue DESC
    `;
    const res = await this.db.query(query);
    return res.rows.map(r => ({
      ticketId: r.id,
      ticketNumber: r.ticket_number,
      priority: r.priority,
      createdAt: r.created_at,
      hoursOverdue: parseFloat(Number(r.hours_overdue).toFixed(1))
    }));
  }

  /**
   * Helper to retrieve job details from BullMQ Queue
   */
  async _getQueueStats(queue) {
    if (!queue) return { active: 0, waiting: 0, failed: 0 };
    try {
      const [active, waiting, failed] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getFailedCount()
      ]);
      return { active, waiting, failed };
    } catch (err) {
      return { active: 0, waiting: 0, failed: 0 };
    }
  }
}

module.exports = SupportAnalyticsService;
