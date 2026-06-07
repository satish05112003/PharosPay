CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS beneficiaries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country             CHAR(2) NOT NULL,
  payment_rail        VARCHAR(20) NOT NULL,
  identifier          VARCHAR(200) NOT NULL,
  identifier_type     VARCHAR(30) NOT NULL,   -- UPI_VPA / ACCOUNT_IFSC / PIX_CPF / PIX_EVP etc
  verified_name       VARCHAR(200),
  verified_bank       VARCHAR(200),
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  verification_source VARCHAR(50),            -- razorpayx / cashfree / simulation
  last_verified_at    TIMESTAMPTZ,
  fraud_score         NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  is_blocked          BOOLEAN NOT NULL DEFAULT false,
  block_reason        TEXT,
  total_received      NUMERIC(18,4) NOT NULL DEFAULT 0,
  transaction_count   INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_beneficiaries_identifier
  ON beneficiaries(country, payment_rail, identifier);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_country ON beneficiaries(country);

CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharos_payment_id VARCHAR(66) NOT NULL UNIQUE,  -- on-chain paymentId (bytes32 hex)
  user_wallet       VARCHAR(42) NOT NULL,
  merchant_id       UUID REFERENCES beneficiaries(id),
  merchant_identifier VARCHAR(200) NOT NULL,
  country           CHAR(2) NOT NULL,
  payment_rail      VARCHAR(20) NOT NULL,
  fiat_amount       NUMERIC(18,4) NOT NULL,
  fiat_currency     CHAR(3) NOT NULL,
  pros_amount       NUMERIC(18,6) NOT NULL,
  pros_usd_rate     NUMERIC(18,8) NOT NULL,
  usd_fiat_rate     NUMERIC(18,8) NOT NULL,
  pharos_lock_tx    VARCHAR(66),
  pharos_confirm_tx VARCHAR(66),
  status            VARCHAR(30) NOT NULL DEFAULT 'INITIATED'
                    CHECK (status IN (
                      'INITIATED','PROS_LOCKED','SETTLEMENT_STARTED',
                      'SETTLEMENT_PROCESSING','SETTLEMENT_COMPLETE',
                      'SETTLEMENT_FAILED','REFUNDING','REFUNDED','DISPUTED'
                    )),
  idempotency_key   UUID UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_payments_wallet   ON payments(user_wallet);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created  ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_pharos   ON payments(pharos_payment_id);
