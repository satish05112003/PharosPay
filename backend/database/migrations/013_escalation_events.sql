CREATE TABLE IF NOT EXISTS escalation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  trigger_source  VARCHAR(30) NOT NULL
                  CHECK (trigger_source IN (
                    'AI_AUTO','USER_REQUEST','ADMIN_MANUAL','REPEAT_ESCALATION','TIMEOUT'
                  )),
  severity        VARCHAR(10) NOT NULL,
  confidence      NUMERIC(4,3),
  wallet_address  VARCHAR(42) NOT NULL,
  session_id      VARCHAR(50),
  email_sent_to   VARCHAR(254),
  email_sent_at   TIMESTAMPTZ,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_ticket_id ON escalation_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_escalation_wallet    ON escalation_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_escalation_occurred  ON escalation_events(occurred_at DESC);
