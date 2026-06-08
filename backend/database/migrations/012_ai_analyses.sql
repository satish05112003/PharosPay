CREATE TABLE IF NOT EXISTS ai_analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  message_id            UUID REFERENCES support_messages(id) ON DELETE SET NULL,
  severity              VARCHAR(10) NOT NULL,
  category              VARCHAR(50) NOT NULL,
  confidence            NUMERIC(4,3) NOT NULL,         -- 0.000 to 1.000
  needs_escalation      BOOLEAN NOT NULL DEFAULT false,
  escalation_reason     TEXT,
  root_cause            TEXT,
  suggested_actions     TEXT[],
  estimated_resolution  VARCHAR(50),
  model_used            VARCHAR(100) NOT NULL,
  processing_ms         INTEGER,
  context_token_count   INTEGER,
  rule_based_severity   VARCHAR(10),
  injection_detected    BOOLEAN NOT NULL DEFAULT false,
  raw_classification    JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_ticket_id ON ai_analyses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_severity  ON ai_analyses(severity);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_created   ON ai_analyses(created_at DESC);
