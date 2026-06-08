CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      VARCHAR(50) NOT NULL,
  wallet_address  VARCHAR(42) NOT NULL,
  sender_type     VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'ai', 'agent', 'system')),
  sender_name     VARCHAR(100),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_session ON support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_wallet ON support_messages(wallet_address);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at DESC);
