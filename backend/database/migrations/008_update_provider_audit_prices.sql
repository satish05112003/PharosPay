ALTER TABLE provider_transactions ADD COLUMN IF NOT EXISTS pros_price_at_execution NUMERIC(18,8);
ALTER TABLE provider_transactions ADD COLUMN IF NOT EXISTS fx_rate_at_execution NUMERIC(18,8);
ALTER TABLE provider_transactions ADD COLUMN IF NOT EXISTS quote_timestamp TIMESTAMPTZ;
ALTER TABLE provider_transactions ADD COLUMN IF NOT EXISTS price_source VARCHAR(100);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS pros_price_at_execution NUMERIC(18,8);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS fx_rate_at_execution NUMERIC(18,8);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS quote_timestamp TIMESTAMPTZ;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS price_source VARCHAR(100);
