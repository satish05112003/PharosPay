class AuditLog {
  constructor(db) {
    this.db = db;
  }

  async create({
    entityType,
    entityId,
    action,
    actor,
    ipAddress = null,
    userAgent = null,
    beforeState = null,
    afterState = null,
    metadata = {},
    prosPriceAtExecution = null,
    fxRateAtExecution = null,
    quoteTimestamp = null,
    priceSource = null
  }) {
    const res = await this.db.query(
      `INSERT INTO audit_logs (
        entity_type, entity_id, action, actor, ip_address, user_agent,
        before_state, after_state, metadata,
        pros_price_at_execution, fx_rate_at_execution, quote_timestamp, price_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        entityType, entityId, action, actor, ipAddress, userAgent,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        JSON.stringify(metadata),
        prosPriceAtExecution, fxRateAtExecution, quoteTimestamp, priceSource
      ]
    );
    return res.rows[0];
  }
}

module.exports = AuditLog;
