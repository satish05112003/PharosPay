CREATE TABLE IF NOT EXISTS support_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      VARCHAR(50) UNIQUE NOT NULL,
  wallet_address  VARCHAR(42) NOT NULL,
  ticket_id       UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','CLOSED','HANDOFF','EXPIRED')),
  message_count   INTEGER NOT NULL DEFAULT 0,
  context_hash    VARCHAR(64),                   -- hash of context at session start
  is_human_active BOOLEAN NOT NULL DEFAULT false,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_wallet    ON support_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sessions_status    ON support_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started   ON support_sessions(started_at DESC);
