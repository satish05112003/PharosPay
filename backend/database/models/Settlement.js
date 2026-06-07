class Settlement {
  constructor(db) {
    this.db = db;
  }

  async findById(id) {
    const res = await this.db.query(
      'SELECT * FROM payment_settlements WHERE id = $1',
      [id]
    );
    return res.rows[0];
  }

  async findByPaymentId(paymentId) {
    const res = await this.db.query(
      'SELECT * FROM payment_settlements WHERE payment_id = $1 ORDER BY initiated_at DESC LIMIT 1',
      [paymentId]
    );
    return res.rows[0];
  }

  async findByProviderReference(providerReference) {
    const res = await this.db.query(
      'SELECT * FROM payment_settlements WHERE provider_reference = $1',
      [providerReference]
    );
    return res.rows[0];
  }

  async create({
    paymentId,
    providerName,
    providerReference = null,
    utr = null,
    referenceNumber = null,
    status = 'PENDING',
    beneficiaryName = null,
    bank = null,
    failureReason = null,
    providerResponse = {},
    isSimulation = false,
    prosPriceAtExecution = null,
    fxRateAtExecution = null,
    quoteTimestamp = null,
    priceSource = null
  }) {
    const res = await this.db.query(
      `INSERT INTO payment_settlements (
        payment_id, provider_name, provider_reference, utr, reference_number,
        status, beneficiary_name, bank, failure_reason, provider_response,
        is_simulation,
        pros_price_at_execution, fx_rate_at_execution, quote_timestamp, price_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        paymentId, providerName, providerReference, utr, referenceNumber,
        status, beneficiaryName, bank, failureReason, JSON.stringify(providerResponse),
        isSimulation,
        prosPriceAtExecution, fxRateAtExecution, quoteTimestamp, priceSource
      ]
    );
    return res.rows[0];
  }

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    let query = 'UPDATE payment_settlements SET';
    const params = [id];

    keys.forEach((key, idx) => {
      const dbCol = this.toSnakeCase(key);
      query += ` ${idx === 0 ? '' : ','} ${dbCol} = $${idx + 2}`;
      
      const val = typeof fields[key] === 'object' && fields[key] !== null ? JSON.stringify(fields[key]) : fields[key];
      params.push(val);
    });

    query += ' WHERE id = $1 RETURNING *';
    
    const res = await this.db.query(query, params);
    return res.rows[0];
  }

  async countSuccessfulToday() {
    const res = await this.db.query(
      `SELECT count(*) FROM payment_settlements 
       WHERE status = 'SUCCESS' AND initiated_at >= CURRENT_DATE`
    );
    return parseInt(res.rows[0].count, 10);
  }

  toSnakeCase(str) {
    if (str === 'webhookReceivedAt') return 'webhook_received_at';
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

module.exports = Settlement;
