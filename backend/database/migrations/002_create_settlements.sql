CREATE TABLE IF NOT EXISTS payment_settlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          UUID NOT NULL REFERENCES payments(id),
  provider_name       VARCHAR(50) NOT NULL,    -- razorpayx / cashfree / simulation
  provider_reference  VARCHAR(200),            -- provider's transaction ID
  utr                 VARCHAR(100),            -- UTR for India / EndToEndId for PIX
  reference_number    VARCHAR(100),            -- PharosPay ref (PHAROS-2026-0001)
  status              VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN (
                        'PENDING','PROCESSING','SUCCESS','FAILED','REVERSED','CANCELLED'
                      )),
  beneficiary_name    VARCHAR(200),
  bank                VARCHAR(200),
  failure_reason      TEXT,
  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at          TIMESTAMPTZ,
  provider_response   JSONB,                   -- full raw provider response
  webhook_received_at TIMESTAMPTZ,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  is_simulation       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_settlements_payment_id ON payment_settlements(payment_id);
CREATE INDEX IF NOT EXISTS idx_settlements_utr        ON payment_settlements(utr);
CREATE INDEX IF NOT EXISTS idx_settlements_status     ON payment_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_provider   ON payment_settlements(provider_reference);
