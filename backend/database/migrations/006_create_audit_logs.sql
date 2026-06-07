CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50) NOT NULL,  -- payment / settlement / webhook
  entity_id     UUID NOT NULL,
  action        VARCHAR(100) NOT NULL,
  actor         VARCHAR(100) NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  before_state  JSONB,
  after_state   JSONB,
  metadata      JSONB DEFAULT '{}',
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logged  ON audit_logs(logged_at DESC);
