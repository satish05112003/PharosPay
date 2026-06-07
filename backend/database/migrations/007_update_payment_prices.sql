ALTER TABLE payments ADD COLUMN IF NOT EXISTS pros_price_at_execution NUMERIC(18,8);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fx_rate_at_execution NUMERIC(18,8);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quote_timestamp TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS price_source VARCHAR(100);

ALTER TABLE payment_settlements ADD COLUMN IF NOT EXISTS pros_price_at_execution NUMERIC(18,8);
ALTER TABLE payment_settlements ADD COLUMN IF NOT EXISTS fx_rate_at_execution NUMERIC(18,8);
ALTER TABLE payment_settlements ADD COLUMN IF NOT EXISTS quote_timestamp TIMESTAMPTZ;
ALTER TABLE payment_settlements ADD COLUMN IF NOT EXISTS price_source VARCHAR(100);
