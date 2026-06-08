CREATE TABLE IF NOT EXISTS support_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  email       VARCHAR(254),
  telegram    VARCHAR(100),
  discord     VARCHAR(100),
  twitter     VARCHAR(100),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_ticket_id ON support_contacts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email     ON support_contacts(email);
