-- Migration 016: Support Chat History System

CREATE TABLE IF NOT EXISTS support_chat_sessions (
  session_id      VARCHAR(50) PRIMARY KEY,
  wallet_address  VARCHAR(42) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      VARCHAR(50) NOT NULL REFERENCES support_chat_sessions(session_id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message         TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_session ON support_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_chat_messages_time ON support_chat_messages(timestamp ASC);
