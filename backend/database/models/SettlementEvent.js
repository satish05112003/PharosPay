class SettlementEvent {
  constructor(db) {
    this.db = db;
  }

  async create({
    paymentId,
    eventType,
    fromStatus = null,
    toStatus = null,
    actor,
    metadata = {}
  }) {
    const res = await this.db.query(
      `INSERT INTO settlement_events (
        payment_id, event_type, from_status, to_status, actor, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [paymentId, eventType, fromStatus, toStatus, actor, JSON.stringify(metadata)]
    );
    return res.rows[0];
  }
}

module.exports = SettlementEvent;
