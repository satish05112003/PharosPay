CREATE TABLE IF NOT EXISTS provider_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id       UUID NOT NULL REFERENCES payment_settlements(id),
  provider_name       VARCHAR(50) NOT NULL,
  request_payload     JSONB NOT NULL,
  response_payload    JSONB,
  http_status_code    INTEGER,
  error_message       TEXT,
  duration_ms         INTEGER,
  called_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_tx_settlement ON provider_transactions(settlement_id);
