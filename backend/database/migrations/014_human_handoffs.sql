CREATE TABLE IF NOT EXISTS human_handoffs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  session_id        VARCHAR(50) NOT NULL,
  requested_by      VARCHAR(42) NOT NULL,   -- wallet address
  request_reason    TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
                    CHECK (status IN ('REQUESTED','ACTIVE','RELEASED','TIMED_OUT')),
  agent_id          VARCHAR(100),            -- admin user ID
  accepted_at       TIMESTAMPTZ,
  released_at       TIMESTAMPTZ,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_ticket_id ON human_handoffs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_session   ON human_handoffs(session_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_status    ON human_handoffs(status);
