-- =============================================================================
-- Migration 006: Cleanup market_rates table
-- Description: Remove unused JSONB columns (metals, currencies)
-- =============================================================================

-- First, drop the view that depends on market_rates (uses SELECT *)
DROP VIEW IF EXISTS public.v_user_net_worth;

-- Now drop the JSONB columns
ALTER TABLE public.market_rates 
  DROP COLUMN IF EXISTS metals,
  DROP COLUMN IF EXISTS currencies;

-- Recreate the view with explicit column selection
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
  CROSS JOIN (
    SELECT gold_egp_per_gram, silver_egp_per_gram, usd_egp, eur_egp 
    FROM public.market_rates LIMIT 1
  ) r
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
        WHEN 'PLATINUM' THEN COALESCE(r.gold_egp_per_gram * 0.5, 2000)
        ELSE 0
      END
    ) AS total_egp
  FROM public.assets a
  JOIN public.asset_metals am ON am.asset_id = a.id
  CROSS JOIN (
    SELECT gold_egp_per_gram, silver_egp_per_gram, usd_egp, eur_egp 
    FROM public.market_rates LIMIT 1
  ) r
  WHERE a.deleted = false AND a.type = 'METAL'
  GROUP BY a.user_id
) assets_total ON u.id = assets_total.user_id;

-- Re-grant permissions
GRANT SELECT ON public.v_user_net_worth TO authenticated;

-- Add comments
COMMENT ON VIEW public.v_user_net_worth IS 'Real-time calculated net worth per user (accounts + assets in EGP)';
COMMENT ON TABLE public.market_rates IS 'Current market rates (single row, updated every 30 mins by edge function)';
COMMENT ON COLUMN public.market_rates.gold_egp_per_gram IS 'Gold price in EGP per gram (24K pure gold)';
COMMENT ON COLUMN public.market_rates.silver_egp_per_gram IS 'Silver price in EGP per gram';
COMMENT ON COLUMN public.market_rates.usd_egp IS 'USD to EGP exchange rate';
COMMENT ON COLUMN public.market_rates.eur_egp IS 'EUR to EGP exchange rate';
