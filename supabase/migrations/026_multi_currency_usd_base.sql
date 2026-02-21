-- =============================================================================
-- Migration 026: Multi-Currency USD Base
-- Description: Convert from EGP-based to USD-based architecture:
--   1. Truncate all data tables (pre-production, safe to discard test data)
--   2. Drop CNH column (offshore yuan removed, CNY covers China)
--   3. Rename all _egp columns to _usd in market_rates
--   4. Rename snapshot table columns from _egp to _usd
--   5. Recreate snapshot functions to aggregate to USD
--
-- Note: daily_snapshot_market_rates was dropped in migration 015.
--       Market rate history is stored in the market_rates table directly.
-- =============================================================================

-- =============================================================================
-- SECTION 1: Truncate all data tables (CASCADE handles FK references)
-- Order: dependent tables first, then parent tables
-- =============================================================================

TRUNCATE TABLE public.daily_snapshot_net_worth CASCADE;
TRUNCATE TABLE public.daily_snapshot_assets CASCADE;
TRUNCATE TABLE public.daily_snapshot_balance CASCADE;
TRUNCATE TABLE public.market_rates CASCADE;
TRUNCATE TABLE public.asset_metals CASCADE;
TRUNCATE TABLE public.assets CASCADE;
TRUNCATE TABLE public.recurring_payments CASCADE;
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.accounts CASCADE;

-- =============================================================================
-- SECTION 2: Drop CNH column from market_rates
-- =============================================================================

ALTER TABLE public.market_rates
  DROP COLUMN IF EXISTS cnh_egp;

-- =============================================================================
-- SECTION 3: Rename market_rates currency columns from _egp to _usd
-- =============================================================================

-- Currency exchange rate columns (36 currencies, excluding CNH which was dropped)
ALTER TABLE public.market_rates RENAME COLUMN aed_egp TO aed_usd;
ALTER TABLE public.market_rates RENAME COLUMN aud_egp TO aud_usd;
ALTER TABLE public.market_rates RENAME COLUMN bhd_egp TO bhd_usd;
ALTER TABLE public.market_rates RENAME COLUMN btc_egp TO btc_usd;
ALTER TABLE public.market_rates RENAME COLUMN cad_egp TO cad_usd;
ALTER TABLE public.market_rates RENAME COLUMN chf_egp TO chf_usd;
ALTER TABLE public.market_rates RENAME COLUMN cny_egp TO cny_usd;
ALTER TABLE public.market_rates RENAME COLUMN dkk_egp TO dkk_usd;
ALTER TABLE public.market_rates RENAME COLUMN dzd_egp TO dzd_usd;
ALTER TABLE public.market_rates RENAME COLUMN eur_egp TO eur_usd;
ALTER TABLE public.market_rates RENAME COLUMN gbp_egp TO gbp_usd;
ALTER TABLE public.market_rates RENAME COLUMN hkd_egp TO hkd_usd;
ALTER TABLE public.market_rates RENAME COLUMN inr_egp TO inr_usd;
ALTER TABLE public.market_rates RENAME COLUMN iqd_egp TO iqd_usd;
ALTER TABLE public.market_rates RENAME COLUMN isk_egp TO isk_usd;
ALTER TABLE public.market_rates RENAME COLUMN jod_egp TO jod_usd;
ALTER TABLE public.market_rates RENAME COLUMN jpy_egp TO jpy_usd;
ALTER TABLE public.market_rates RENAME COLUMN kpw_egp TO kpw_usd;
ALTER TABLE public.market_rates RENAME COLUMN krw_egp TO krw_usd;
ALTER TABLE public.market_rates RENAME COLUMN kwd_egp TO kwd_usd;
ALTER TABLE public.market_rates RENAME COLUMN lyd_egp TO lyd_usd;
ALTER TABLE public.market_rates RENAME COLUMN mad_egp TO mad_usd;
ALTER TABLE public.market_rates RENAME COLUMN myr_egp TO myr_usd;
ALTER TABLE public.market_rates RENAME COLUMN nok_egp TO nok_usd;
ALTER TABLE public.market_rates RENAME COLUMN nzd_egp TO nzd_usd;
ALTER TABLE public.market_rates RENAME COLUMN omr_egp TO omr_usd;
ALTER TABLE public.market_rates RENAME COLUMN qar_egp TO qar_usd;
ALTER TABLE public.market_rates RENAME COLUMN rub_egp TO rub_usd;
ALTER TABLE public.market_rates RENAME COLUMN sar_egp TO sar_usd;
ALTER TABLE public.market_rates RENAME COLUMN sek_egp TO sek_usd;
ALTER TABLE public.market_rates RENAME COLUMN sgd_egp TO sgd_usd;
ALTER TABLE public.market_rates RENAME COLUMN tnd_egp TO tnd_usd;
ALTER TABLE public.market_rates RENAME COLUMN try_egp TO try_usd;
ALTER TABLE public.market_rates RENAME COLUMN usd_egp TO egp_usd;
ALTER TABLE public.market_rates RENAME COLUMN zar_egp TO zar_usd;

-- Metal price columns (4 metals)
ALTER TABLE public.market_rates RENAME COLUMN gold_egp_per_gram TO gold_usd_per_gram;
ALTER TABLE public.market_rates RENAME COLUMN silver_egp_per_gram TO silver_usd_per_gram;
ALTER TABLE public.market_rates RENAME COLUMN platinum_egp_per_gram TO platinum_usd_per_gram;
ALTER TABLE public.market_rates RENAME COLUMN palladium_egp_per_gram TO palladium_usd_per_gram;

-- =============================================================================
-- SECTION 4: Rename daily_snapshot_balance column
-- =============================================================================

ALTER TABLE public.daily_snapshot_balance
  RENAME COLUMN total_accounts_egp TO total_accounts_usd;

-- =============================================================================
-- SECTION 5: Rename daily_snapshot_assets column
-- =============================================================================

ALTER TABLE public.daily_snapshot_assets
  RENAME COLUMN total_assets_egp TO total_assets_usd;

-- =============================================================================
-- SECTION 6: Recreate recalculate_daily_snapshot_balance (USD-based)
-- Converts all account balances to USD using rate_X (value of 1 unit X in USD)
-- Formula: balance * rate_X = balance in USD
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_balance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  rates_exist BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.market_rates) INTO rates_exist;

  IF NOT rates_exist THEN
    RAISE NOTICE 'Skipping balance snapshot: no market rates available';
    RETURN;
  END IF;

  DELETE FROM public.daily_snapshot_balance
  WHERE snapshot_date = today;

  -- Each currency rate represents "value of 1 unit of currency X in USD"
  -- So: balance_in_currency * rate = balance_in_USD
  -- USD itself has an implicit rate of 1 (not stored)
  INSERT INTO public.daily_snapshot_balance (user_id, total_accounts_usd, snapshot_date, created_at)
  SELECT
    a.user_id,
    SUM(
      CASE a.currency
        WHEN 'USD' THEN a.balance
        WHEN 'EGP' THEN a.balance * r.egp_usd
        WHEN 'EUR' THEN a.balance * r.eur_usd
        WHEN 'GBP' THEN a.balance * r.gbp_usd
        WHEN 'AED' THEN a.balance * r.aed_usd
        WHEN 'AUD' THEN a.balance * r.aud_usd
        WHEN 'BHD' THEN a.balance * r.bhd_usd
        WHEN 'BTC' THEN a.balance * r.btc_usd
        WHEN 'CAD' THEN a.balance * r.cad_usd
        WHEN 'CHF' THEN a.balance * r.chf_usd
        WHEN 'CNY' THEN a.balance * r.cny_usd
        WHEN 'DKK' THEN a.balance * r.dkk_usd
        WHEN 'DZD' THEN a.balance * r.dzd_usd
        WHEN 'HKD' THEN a.balance * r.hkd_usd
        WHEN 'INR' THEN a.balance * r.inr_usd
        WHEN 'IQD' THEN a.balance * r.iqd_usd
        WHEN 'ISK' THEN a.balance * r.isk_usd
        WHEN 'JOD' THEN a.balance * r.jod_usd
        WHEN 'JPY' THEN a.balance * r.jpy_usd
        WHEN 'KPW' THEN a.balance * r.kpw_usd
        WHEN 'KRW' THEN a.balance * r.krw_usd
        WHEN 'KWD' THEN a.balance * r.kwd_usd
        WHEN 'LYD' THEN a.balance * r.lyd_usd
        WHEN 'MAD' THEN a.balance * r.mad_usd
        WHEN 'MYR' THEN a.balance * r.myr_usd
        WHEN 'NOK' THEN a.balance * r.nok_usd
        WHEN 'NZD' THEN a.balance * r.nzd_usd
        WHEN 'OMR' THEN a.balance * r.omr_usd
        WHEN 'QAR' THEN a.balance * r.qar_usd
        WHEN 'RUB' THEN a.balance * r.rub_usd
        WHEN 'SAR' THEN a.balance * r.sar_usd
        WHEN 'SEK' THEN a.balance * r.sek_usd
        WHEN 'SGD' THEN a.balance * r.sgd_usd
        WHEN 'TND' THEN a.balance * r.tnd_usd
        WHEN 'TRY' THEN a.balance * r.try_usd
        WHEN 'ZAR' THEN a.balance * r.zar_usd
        ELSE a.balance -- Fallback: assume value is already in USD
      END
    )::DECIMAL(15, 2),
    today,
    NOW()
  FROM public.accounts a
  CROSS JOIN (SELECT * FROM public.market_rates ORDER BY created_at DESC LIMIT 1) r
  WHERE a.deleted = false
  GROUP BY a.user_id;
END;
$$;

-- =============================================================================
-- SECTION 7: Recreate recalculate_daily_snapshot_assets (USD-based)
-- Metal prices are stored as USD per gram, so no conversion needed
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  rates_exist BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.market_rates) INTO rates_exist;

  IF NOT rates_exist THEN
    RAISE NOTICE 'Skipping assets snapshot: no market rates available';
    RETURN;
  END IF;

  DELETE FROM public.daily_snapshot_assets
  WHERE snapshot_date = today;

  -- Metal prices are already in USD per gram, so result is directly in USD
  INSERT INTO public.daily_snapshot_assets (user_id, total_assets_usd, snapshot_date, created_at)
  SELECT
    a.user_id,
    SUM(
      am.weight_grams * am.purity_fraction *
      CASE am.metal_type
        WHEN 'GOLD' THEN r.gold_usd_per_gram
        WHEN 'SILVER' THEN r.silver_usd_per_gram
        WHEN 'PLATINUM' THEN r.platinum_usd_per_gram
        WHEN 'PALLADIUM' THEN r.palladium_usd_per_gram
        ELSE 0
      END
    )::DECIMAL(15, 2),
    today,
    NOW()
  FROM public.assets a
  JOIN public.asset_metals am ON am.asset_id = a.id
  CROSS JOIN (SELECT * FROM public.market_rates ORDER BY created_at DESC LIMIT 1) r
  WHERE a.deleted = false AND a.type = 'METAL'
  GROUP BY a.user_id;
END;
$$;

-- =============================================================================
-- SECTION 8: Recreate recalculate_daily_snapshot_net_worth (USD-based)
-- Now reads total_accounts_usd and total_assets_usd
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_net_worth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  balance_snapshots_exist BOOLEAN;
  asset_snapshots_exist BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.daily_snapshot_balance WHERE snapshot_date = today
  ) INTO balance_snapshots_exist;

  SELECT EXISTS(
    SELECT 1 FROM public.daily_snapshot_assets WHERE snapshot_date = today
  ) INTO asset_snapshots_exist;

  IF NOT balance_snapshots_exist AND NOT asset_snapshots_exist THEN
    RAISE NOTICE 'Skipping net worth snapshot: no balance or asset snapshots for today';
    RETURN;
  END IF;

  DELETE FROM public.daily_snapshot_net_worth
  WHERE snapshot_date = today;

  INSERT INTO public.daily_snapshot_net_worth (user_id, total_accounts, total_assets, total_net_worth, snapshot_date, created_at)
  SELECT
    COALESCE(b.user_id, a.user_id) AS user_id,
    COALESCE(b.total_accounts_usd, 0)::DECIMAL(15, 2) AS total_accounts,
    COALESCE(a.total_assets_usd, 0)::DECIMAL(15, 2) AS total_assets,
    (COALESCE(b.total_accounts_usd, 0) + COALESCE(a.total_assets_usd, 0))::DECIMAL(15, 2) AS total_net_worth,
    today,
    NOW()
  FROM (
    SELECT user_id, total_accounts_usd
    FROM public.daily_snapshot_balance
    WHERE snapshot_date = today
  ) b
  FULL OUTER JOIN (
    SELECT user_id, total_assets_usd
    FROM public.daily_snapshot_assets
    WHERE snapshot_date = today
  ) a ON b.user_id = a.user_id
  WHERE (COALESCE(b.total_accounts_usd, 0) + COALESCE(a.total_assets_usd, 0)) > 0;
END;
$$;

-- =============================================================================
-- SECTION 9: Drop the stale save_daily_market_rates_snapshot function
-- (References dropped daily_snapshot_market_rates table from migration 015)
-- =============================================================================

DROP FUNCTION IF EXISTS public.save_daily_market_rates_snapshot();

-- =============================================================================
-- SECTION 10: Update function comments
-- =============================================================================

COMMENT ON FUNCTION public.recalculate_daily_snapshot_balance IS 'Creates daily balance snapshots aggregated to USD';
COMMENT ON FUNCTION public.recalculate_daily_snapshot_assets IS 'Creates daily asset snapshots with metal values in USD';
COMMENT ON FUNCTION public.recalculate_daily_snapshot_net_worth IS 'Creates daily net worth snapshots from USD-denominated balance/asset snapshots';
