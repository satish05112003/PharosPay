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
    durationMs = null
  }) {
    const res = await this.db.query(
      `INSERT INTO provider_transactions (
        settlement_id, provider_name, request_payload, response_payload,
        http_status_code, error_message, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        settlementId, providerName, JSON.stringify(requestPayload),
        responsePayload ? JSON.stringify(responsePayload) : null,
        httpStatusCode, errorMessage, durationMs
      ]
    );
    return res.rows[0];
  }
}

module.exports = ProviderTransaction;
