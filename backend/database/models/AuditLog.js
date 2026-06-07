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
    metadata = {}
  }) {
    const res = await this.db.query(
      `INSERT INTO audit_logs (
        entity_type, entity_id, action, actor, ip_address, user_agent,
        before_state, after_state, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        entityType, entityId, action, actor, ipAddress, userAgent,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        JSON.stringify(metadata)
      ]
    );
    return res.rows[0];
  }
}

module.exports = AuditLog;
