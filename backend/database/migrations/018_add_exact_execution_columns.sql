ALTER TABLE payments ADD COLUMN IF NOT EXISTS usd_inr_rate NUMERIC(18,8);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pros_usd_price NUMERIC(18,8);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee_percent NUMERIC(5,2) DEFAULT 2.00;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;

-- Backfill existing rows with matching execution values or fallback values
UPDATE payments 
SET usd_inr_rate = COALESCE(fx_rate_at_execution, usd_fiat_rate, 95.18080000),
    pros_usd_price = COALESCE(pros_price_at_execution, pros_usd_rate, 0.61440000),
    fee_percent = 2.00,
    timestamp = created_at
WHERE usd_inr_rate IS NULL;
