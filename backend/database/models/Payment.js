class Payment {
  constructor(db) {
    this.db = db;
  }

  async findByPharosPaymentId(pharosPaymentId) {
    const res = await this.db.query(
      'SELECT * FROM payments WHERE pharos_payment_id = $1',
      [pharosPaymentId]
    );
    return res.rows[0];
  }

  async findById(id) {
    const res = await this.db.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );
    return res.rows[0];
  }

  async create({
    pharosPaymentId,
    userWallet,
    merchantId = null,
    merchantIdentifier,
    country,
    paymentRail,
    fiatAmount,
    fiatCurrency,
    prosAmount,
    prosUsdRate = null,
    usdFiatRate = null,
    pharosLockTx = null,
    pharosConfirmTx = null,
    status = 'INITIATED',
    idempotencyKey,
    metadata = {},
    prosPriceAtExecution = null,
    fxRateAtExecution = null,
    quoteTimestamp = null,
    priceSource = null
  }) {
    const res = await this.db.query(
      `INSERT INTO payments (
        pharos_payment_id, user_wallet, merchant_id, merchant_identifier,
        country, payment_rail, fiat_amount, fiat_currency, pros_amount,
        pros_usd_rate, usd_fiat_rate, pharos_lock_tx, pharos_confirm_tx,
        status, idempotency_key, metadata,
        pros_price_at_execution, fx_rate_at_execution, quote_timestamp, price_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        pharosPaymentId, userWallet, merchantId, merchantIdentifier,
        country, paymentRail, fiatAmount, fiatCurrency, prosAmount,
        prosUsdRate, usdFiatRate, pharosLockTx, pharosConfirmTx,
        status, idempotencyKey, JSON.stringify(metadata),
        prosPriceAtExecution, fxRateAtExecution, quoteTimestamp, priceSource
      ]
    );
    return res.rows[0];
  }

  async updateStatus(id, status, extraFields = {}) {
    const keys = Object.keys(extraFields);
    let query = 'UPDATE payments SET status = $1, updated_at = NOW()';
    const params = [status, id];
    
    keys.forEach((key, idx) => {
      query += `, ${key} = $${idx + 3}`;
      params.push(extraFields[key]);
    });

    query += ' WHERE id = $2 RETURNING *';
    
    const res = await this.db.query(query, params);
    return res.rows[0];
  }

  async updateStatusByPharosId(pharosPaymentId, status, extraFields = {}) {
    const keys = Object.keys(extraFields);
    let query = 'UPDATE payments SET status = $1, updated_at = NOW()';
    const params = [status, pharosPaymentId];
    
    keys.forEach((key, idx) => {
      query += `, ${key} = $${idx + 3}`;
      params.push(extraFields[key]);
    });

    query += ' WHERE pharos_payment_id = $2 RETURNING *';
    
    const res = await this.db.query(query, params);
    return res.rows[0];
  }
}

module.exports = Payment;
