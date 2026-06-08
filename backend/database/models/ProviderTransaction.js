class ProviderTransaction {
  constructor(db) {
    this.db = db;
  }

  async create({
    settlementId,
    providerName,
    requestPayload,
    responsePayload = null,
    httpStatusCode = null,
    errorMessage = null,
    durationMs = null,
    prosPriceAtExecution = null,
    fxRateAtExecution = null,
    quoteTimestamp = null,
    priceSource = null
  }) {
    const res = await this.db.query(
      `INSERT INTO provider_transactions (
        settlement_id, provider_name, request_payload, response_payload,
        http_status_code, error_message, duration_ms,
        pros_price_at_execution, fx_rate_at_execution, quote_timestamp, price_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        settlementId, providerName, JSON.stringify(requestPayload),
        responsePayload ? JSON.stringify(responsePayload) : null,
        httpStatusCode, errorMessage, durationMs,
        prosPriceAtExecution, fxRateAtExecution, quoteTimestamp, priceSource
      ]
    );
    return res.rows[0];
  }
}

module.exports = ProviderTransaction;
