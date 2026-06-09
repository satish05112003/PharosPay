ALTER TABLE payments ADD COLUMN IF NOT EXISTS pros_amount_executed NUMERIC(18,6);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS usd_amount_at_execution NUMERIC(18,6);

-- Populate existing values
UPDATE payments 
SET pros_amount_executed = pros_amount,
    usd_amount_at_execution = CASE 
      WHEN usd_fiat_rate > 0 THEN fiat_amount / usd_fiat_rate 
      ELSE fiat_amount 
    END
WHERE pros_amount_executed IS NULL;
