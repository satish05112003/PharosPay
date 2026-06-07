CREATE TABLE IF NOT EXISTS settlement_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID NOT NULL REFERENCES payments(id),
  event_type  VARCHAR(50) NOT NULL,
  from_status VARCHAR(30),
  to_status   VARCHAR(30),
  actor       VARCHAR(50) NOT NULL,  -- system / webhook / user / admin
  metadata    JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_payment_id ON settlement_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_events_type       ON settlement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_occurred   ON settlement_events(occurred_at DESC);
