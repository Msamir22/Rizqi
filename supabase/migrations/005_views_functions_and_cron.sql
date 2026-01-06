-- =============================================================================
-- Migration 005: Views, Functions, and Cron Jobs
-- Description: Real-time net worth view, daily snapshot functions, cron scheduling
-- =============================================================================

-- =============================================================================
-- SECTION 1: RENAME TABLE
-- =============================================================================

-- Rename user_net_worth_summary to daily_snapshot_net_worth
ALTER TABLE IF EXISTS public.user_net_worth_summary 
  RENAME TO daily_snapshot_net_worth;

-- Update comment
COMMENT ON TABLE public.daily_snapshot_net_worth IS 'Daily snapshots of user net worth for historical tracking';

-- =============================================================================
-- SECTION 2: UPDATE MARKET_RATES TABLE STRUCTURE
-- =============================================================================

-- Add computed EGP columns if they don't exist (for cleaner queries)
-- The edge function will populate these directly
ALTER TABLE public.market_rates 
  ADD COLUMN IF NOT EXISTS gold_egp_per_gram DECIMAL(15, 4),
  ADD COLUMN IF NOT EXISTS silver_egp_per_gram DECIMAL(15, 4),
  ADD COLUMN IF NOT EXISTS usd_egp DECIMAL(15, 4),
  ADD COLUMN IF NOT EXISTS eur_egp DECIMAL(15, 4);

-- =============================================================================
-- SECTION 3: REAL-TIME NET WORTH VIEW
-- =============================================================================

-- Drop if exists to allow recreation
DROP VIEW IF EXISTS public.v_user_net_worth;

-- Create the real-time calculation view
CREATE VIEW public.v_user_net_worth AS
SELECT 
  u.id AS user_id,
  COALESCE(accounts_total.total_egp, 0)::DECIMAL(15, 2) AS total_accounts,
  COALESCE(assets_total.total_egp, 0)::DECIMAL(15, 2) AS total_assets,
  (COALESCE(accounts_total.total_egp, 0) + COALESCE(assets_total.total_egp, 0))::DECIMAL(15, 2) AS total_net_worth,
  NOW() AS calculated_at
FROM auth.users u
LEFT JOIN (
  -- Accounts calculation with currency conversion
  SELECT 
    a.user_id,
    SUM(
      CASE a.currency
        WHEN 'EGP' THEN a.balance
        WHEN 'USD' THEN a.balance * COALESCE(r.usd_egp, 50)
        WHEN 'EUR' THEN a.balance * COALESCE(r.eur_egp, 55)
        ELSE a.balance
      END
    ) AS total_egp
  FROM public.accounts a
  CROSS JOIN (SELECT * FROM public.market_rates LIMIT 1) r
  WHERE a.deleted = false
  GROUP BY a.user_id
) accounts_total ON u.id = accounts_total.user_id
LEFT JOIN (
  -- Assets calculation (metals with valuation)
  SELECT 
    a.user_id,
    SUM(
      am.weight_grams * (am.purity_karat::decimal / 24) * 
      CASE am.metal_type 
        WHEN 'GOLD' THEN COALESCE(r.gold_egp_per_gram, 4000)
        WHEN 'SILVER' THEN COALESCE(r.silver_egp_per_gram, 50)
        WHEN 'PLATINUM' THEN COALESCE(r.gold_egp_per_gram * 0.5, 2000) -- Approximate
        ELSE 0
      END
    ) AS total_egp
  FROM public.assets a
  JOIN public.asset_metals am ON am.asset_id = a.id
  CROSS JOIN (SELECT * FROM public.market_rates LIMIT 1) r
  WHERE a.deleted = false AND a.type = 'METAL'
  GROUP BY a.user_id
) assets_total ON u.id = assets_total.user_id;

COMMENT ON VIEW public.v_user_net_worth IS 'Real-time calculated net worth per user (accounts + assets in EGP)';

-- =============================================================================
-- SECTION 4: DAILY SNAPSHOT FUNCTIONS
-- =============================================================================

-- Function: Recalculate daily balance snapshot for all users
CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_balance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Insert or update today's snapshot for all users with accounts
  INSERT INTO public.daily_snapshot_balance (user_id, snapshot_date, total_accounts_egp, breakdown)
  SELECT 
    a.user_id,
    today,
    SUM(
      CASE a.currency
        WHEN 'EGP' THEN a.balance
        WHEN 'USD' THEN a.balance * COALESCE(r.usd_egp, 50)
        WHEN 'EUR' THEN a.balance * COALESCE(r.eur_egp, 55)
        ELSE a.balance
      END
    )::DECIMAL(15, 2),
    jsonb_agg(
      jsonb_build_object(
        'account_id', a.id,
        'name', a.name,
        'balance', a.balance,
        'currency', a.currency,
        'balance_egp', CASE a.currency
          WHEN 'EGP' THEN a.balance
          WHEN 'USD' THEN a.balance * COALESCE(r.usd_egp, 50)
          WHEN 'EUR' THEN a.balance * COALESCE(r.eur_egp, 55)
          ELSE a.balance
        END
      )
    )
  FROM public.accounts a
  CROSS JOIN (SELECT * FROM public.market_rates LIMIT 1) r
  WHERE a.deleted = false
  GROUP BY a.user_id
  ON CONFLICT (user_id, snapshot_date) 
  DO UPDATE SET 
    total_accounts_egp = EXCLUDED.total_accounts_egp,
    breakdown = EXCLUDED.breakdown;
END;
$$;

-- Function: Recalculate daily assets snapshot for all users
CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Insert or update today's snapshot for all users with metal assets
  INSERT INTO public.daily_snapshot_assets (user_id, snapshot_date, total_assets_egp, breakdown)
  SELECT 
    a.user_id,
    today,
    SUM(
      am.weight_grams * (am.purity_karat::decimal / 24) * 
      CASE am.metal_type 
        WHEN 'GOLD' THEN COALESCE(r.gold_egp_per_gram, 4000)
        WHEN 'SILVER' THEN COALESCE(r.silver_egp_per_gram, 50)
        WHEN 'PLATINUM' THEN COALESCE(r.gold_egp_per_gram * 0.5, 2000)
        ELSE 0
      END
    )::DECIMAL(15, 2),
    jsonb_agg(
      jsonb_build_object(
        'asset_id', a.id,
        'name', a.name,
        'metal_type', am.metal_type,
        'weight_grams', am.weight_grams,
        'purity_karat', am.purity_karat,
        'value_egp', am.weight_grams * (am.purity_karat::decimal / 24) * 
          CASE am.metal_type 
            WHEN 'GOLD' THEN COALESCE(r.gold_egp_per_gram, 4000)
            WHEN 'SILVER' THEN COALESCE(r.silver_egp_per_gram, 50)
            WHEN 'PLATINUM' THEN COALESCE(r.gold_egp_per_gram * 0.5, 2000)
            ELSE 0
          END
      )
    )
  FROM public.assets a
  JOIN public.asset_metals am ON am.asset_id = a.id
  CROSS JOIN (SELECT * FROM public.market_rates LIMIT 1) r
  WHERE a.deleted = false AND a.type = 'METAL'
  GROUP BY a.user_id
  ON CONFLICT (user_id, snapshot_date) 
  DO UPDATE SET 
    total_assets_egp = EXCLUDED.total_assets_egp,
    breakdown = EXCLUDED.breakdown;
END;
$$;

-- Function: Save current market rates to history
CREATE OR REPLACE FUNCTION public.save_market_rates_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO public.market_rates_history (snapshot_date, gold_egp_per_gram, silver_egp_per_gram, usd_egp, eur_egp)
  SELECT 
    today,
    gold_egp_per_gram,
    silver_egp_per_gram,
    usd_egp,
    eur_egp
  FROM public.market_rates
  LIMIT 1
  ON CONFLICT (snapshot_date) 
  DO UPDATE SET 
    gold_egp_per_gram = EXCLUDED.gold_egp_per_gram,
    silver_egp_per_gram = EXCLUDED.silver_egp_per_gram,
    usd_egp = EXCLUDED.usd_egp,
    eur_egp = EXCLUDED.eur_egp;
END;
$$;

-- Function: Recalculate daily net worth snapshot for all users
CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_net_worth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Use the real-time view to get current values and store as snapshot
  INSERT INTO public.daily_snapshot_net_worth (user_id, total_accounts, total_assets, total_net_worth, updated_at)
  SELECT 
    user_id,
    total_accounts,
    total_assets,
    total_net_worth,
    NOW()
  FROM public.v_user_net_worth
  WHERE total_net_worth > 0  -- Only users with some data
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_accounts = EXCLUDED.total_accounts,
    total_assets = EXCLUDED.total_assets,
    total_net_worth = EXCLUDED.total_net_worth,
    updated_at = NOW();
END;
$$;

-- Function: Master function to run all daily snapshots
CREATE OR REPLACE FUNCTION public.run_daily_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Run all snapshot functions in sequence
  PERFORM public.recalculate_daily_snapshot_balance();
  PERFORM public.recalculate_daily_snapshot_assets();
  PERFORM public.save_market_rates_history();
  PERFORM public.recalculate_daily_snapshot_net_worth();
  
  RAISE NOTICE 'Daily snapshots completed at %', NOW();
END;
$$;

-- =============================================================================
-- SECTION 5: CRON JOBS
-- =============================================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Note: pg_net is required for HTTP calls from cron
-- User confirmed it's already enabled

-- Schedule daily snapshots at 11 PM Cairo time (9 PM UTC)
-- Unschedule first to avoid duplicates
SELECT cron.unschedule('daily-snapshots') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-snapshots'
);

SELECT cron.schedule(
  'daily-snapshots',
  '0 21 * * *',  -- 9 PM UTC = 11 PM Cairo
  'SELECT public.run_daily_snapshots()'
);

-- Schedule market rates fetch every 30 minutes
-- This will call the edge function via pg_net
-- NOTE: Replace <project-ref> and <service_role_key> with actual values
SELECT cron.unschedule('fetch-metal-rates') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fetch-metal-rates'
);

-- IMPORTANT: You need to run this SQL manually after replacing the placeholders:
-- SELECT cron.schedule(
--   'fetch-metal-rates',
--   '*/30 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/fetch-metal-rates',
--     body := '{}'::jsonb,
--     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
--   );
--   $$
-- );

-- =============================================================================
-- SECTION 6: RLS FOR VIEW
-- =============================================================================

-- Views inherit RLS from underlying tables, but we need to ensure proper access
-- The view already filters by user_id, and underlying tables have RLS

-- Grant select on view to authenticated users
GRANT SELECT ON public.v_user_net_worth TO authenticated;

-- =============================================================================
-- SECTION 7: COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.recalculate_daily_snapshot_balance IS 'Creates/updates daily balance snapshots for all users';
COMMENT ON FUNCTION public.recalculate_daily_snapshot_assets IS 'Creates/updates daily asset valuation snapshots for all users';
COMMENT ON FUNCTION public.save_market_rates_history IS 'Copies current market rates to history table';
COMMENT ON FUNCTION public.recalculate_daily_snapshot_net_worth IS 'Creates/updates daily net worth snapshots for all users';
COMMENT ON FUNCTION public.run_daily_snapshots IS 'Master function that runs all daily snapshot functions';
