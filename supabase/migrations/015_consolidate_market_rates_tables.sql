-- Migration: Consolidate daily_snapshot_market_rates into market_rates

-- Step 1: Remove single row constraint to allow multiple rows
ALTER TABLE market_rates DROP CONSTRAINT IF EXISTS single_row_constraint;

-- Step 2: Make timestamp columns nullable for migrated historical data
ALTER TABLE market_rates ALTER COLUMN timestamp_metal DROP NOT NULL;
ALTER TABLE market_rates ALTER COLUMN timestamp_currency DROP NOT NULL;

-- Step 3: Remove the existing primary key
ALTER TABLE market_rates DROP CONSTRAINT IF EXISTS market_rates_pkey;

-- Step 4: Create a sequence for the new auto-incrementing id
CREATE SEQUENCE IF NOT EXISTS market_rates_id_seq;

-- Step 5: Alter the id column to use the sequence and bigint type
ALTER TABLE market_rates 
  ALTER COLUMN id TYPE bigint USING id::bigint,
  ALTER COLUMN id SET DEFAULT nextval('market_rates_id_seq');

-- Set the sequence to start after current max id
SELECT setval('market_rates_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM market_rates), 1));

-- Step 6: Add back the primary key
ALTER TABLE market_rates ADD PRIMARY KEY (id);

-- Step 7: Migrate data from daily_snapshot_market_rates to market_rates
INSERT INTO market_rates (
  created_at, updated_at,
  gold_egp_per_gram, silver_egp_per_gram, platinum_egp_per_gram, palladium_egp_per_gram,
  usd_egp, eur_egp, gbp_egp, aed_egp, aud_egp, bhd_egp, btc_egp, cad_egp, chf_egp,
  cnh_egp, cny_egp, dkk_egp, dzd_egp, hkd_egp, inr_egp, iqd_egp, isk_egp, jod_egp,
  jpy_egp, kpw_egp, krw_egp, kwd_egp, lyd_egp, mad_egp, myr_egp, nok_egp, nzd_egp,
  omr_egp, qar_egp, rub_egp, sar_egp, sek_egp, sgd_egp, tnd_egp, try_egp, zar_egp
)
SELECT 
  (snapshot_date::date + TIME '21:00:00') AT TIME ZONE 'UTC' as created_at,
  (snapshot_date::date + TIME '21:00:00') AT TIME ZONE 'UTC' as updated_at,
  gold_egp_per_gram, silver_egp_per_gram, platinum_egp_per_gram, palladium_egp_per_gram,
  usd_egp, eur_egp, gbp_egp, aed_egp, aud_egp, bhd_egp, btc_egp, cad_egp, chf_egp,
  cnh_egp, cny_egp, dkk_egp, dzd_egp, hkd_egp, inr_egp, iqd_egp, isk_egp, jod_egp,
  jpy_egp, kpw_egp, krw_egp, kwd_egp, lyd_egp, mad_egp, myr_egp, nok_egp, nzd_egp,
  omr_egp, qar_egp, rub_egp, sar_egp, sek_egp, sgd_egp, tnd_egp, try_egp, zar_egp
FROM daily_snapshot_market_rates
ORDER BY snapshot_date;

-- Step 8: Drop the daily_snapshot_market_rates table
DROP TABLE IF EXISTS daily_snapshot_market_rates;

-- Step 9: Drop the snapshot function if it exists
DROP FUNCTION IF EXISTS create_daily_market_rate_snapshot();

-- Step 10: Add index for efficient historical lookups
CREATE INDEX IF NOT EXISTS idx_market_rates_created_at ON market_rates(created_at DESC);
