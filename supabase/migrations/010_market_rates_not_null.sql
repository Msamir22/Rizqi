-- =============================================================================
-- Migration 010: Market Rates NOT NULL Constraints
-- Description: Make new market rate columns NOT NULL and remove old timestamp
-- =============================================================================

-- =============================================================================
-- SECTION 1: REMOVE OLD TIMESTAMP FIELD
-- =============================================================================

ALTER TABLE public.market_rates DROP COLUMN IF EXISTS timestamp;

-- =============================================================================
-- SECTION 2: SET DEFAULT VALUES FOR NEW COLUMNS (required before NOT NULL)
-- =============================================================================

-- Set default 0 for any NULL values in market_rates
UPDATE public.market_rates SET
  -- Metals
  platinum_egp_per_gram = COALESCE(platinum_egp_per_gram, 0),
  palladium_egp_per_gram = COALESCE(palladium_egp_per_gram, 0),
  lbma_gold_am_egp_per_gram = COALESCE(lbma_gold_am_egp_per_gram, 0),
  lbma_gold_pm_egp_per_gram = COALESCE(lbma_gold_pm_egp_per_gram, 0),
  lbma_silver_egp_per_gram = COALESCE(lbma_silver_egp_per_gram, 0),
  lbma_platinum_am_egp_per_gram = COALESCE(lbma_platinum_am_egp_per_gram, 0),
  lbma_platinum_pm_egp_per_gram = COALESCE(lbma_platinum_pm_egp_per_gram, 0),
  lbma_palladium_am_egp_per_gram = COALESCE(lbma_palladium_am_egp_per_gram, 0),
  lbma_palladium_pm_egp_per_gram = COALESCE(lbma_palladium_pm_egp_per_gram, 0),
  copper_egp_per_gram = COALESCE(copper_egp_per_gram, 0),
  aluminum_egp_per_gram = COALESCE(aluminum_egp_per_gram, 0),
  lead_egp_per_gram = COALESCE(lead_egp_per_gram, 0),
  nickel_egp_per_gram = COALESCE(nickel_egp_per_gram, 0),
  zinc_egp_per_gram = COALESCE(zinc_egp_per_gram, 0),
  -- Currencies
  aed_egp = COALESCE(aed_egp, 0),
  aud_egp = COALESCE(aud_egp, 0),
  bhd_egp = COALESCE(bhd_egp, 0),
  btc_egp = COALESCE(btc_egp, 0),
  cad_egp = COALESCE(cad_egp, 0),
  chf_egp = COALESCE(chf_egp, 0),
  cnh_egp = COALESCE(cnh_egp, 0),
  cny_egp = COALESCE(cny_egp, 0),
  dkk_egp = COALESCE(dkk_egp, 0),
  dzd_egp = COALESCE(dzd_egp, 0),
  gbp_egp = COALESCE(gbp_egp, 0),
  hkd_egp = COALESCE(hkd_egp, 0),
  inr_egp = COALESCE(inr_egp, 0),
  iqd_egp = COALESCE(iqd_egp, 0),
  isk_egp = COALESCE(isk_egp, 0),
  jod_egp = COALESCE(jod_egp, 0),
  jpy_egp = COALESCE(jpy_egp, 0),
  kpw_egp = COALESCE(kpw_egp, 0),
  krw_egp = COALESCE(krw_egp, 0),
  kwd_egp = COALESCE(kwd_egp, 0),
  lyd_egp = COALESCE(lyd_egp, 0),
  mad_egp = COALESCE(mad_egp, 0),
  myr_egp = COALESCE(myr_egp, 0),
  nok_egp = COALESCE(nok_egp, 0),
  nzd_egp = COALESCE(nzd_egp, 0),
  omr_egp = COALESCE(omr_egp, 0),
  qar_egp = COALESCE(qar_egp, 0),
  rub_egp = COALESCE(rub_egp, 0),
  sar_egp = COALESCE(sar_egp, 0),
  sek_egp = COALESCE(sek_egp, 0),
  sgd_egp = COALESCE(sgd_egp, 0),
  tnd_egp = COALESCE(tnd_egp, 0),
  try_egp = COALESCE(try_egp, 0),
  zar_egp = COALESCE(zar_egp, 0),
  -- Timestamps
  timestamp_metal = COALESCE(timestamp_metal, NOW()),
  timestamp_currency = COALESCE(timestamp_currency, NOW());

-- =============================================================================
-- SECTION 3: ADD NOT NULL CONSTRAINTS TO market_rates
-- =============================================================================

-- Metals
ALTER TABLE public.market_rates
  ALTER COLUMN platinum_egp_per_gram SET NOT NULL,
  ALTER COLUMN palladium_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_gold_am_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_gold_pm_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_silver_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_platinum_am_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_platinum_pm_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_palladium_am_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_palladium_pm_egp_per_gram SET NOT NULL,
  ALTER COLUMN copper_egp_per_gram SET NOT NULL,
  ALTER COLUMN aluminum_egp_per_gram SET NOT NULL,
  ALTER COLUMN lead_egp_per_gram SET NOT NULL,
  ALTER COLUMN nickel_egp_per_gram SET NOT NULL,
  ALTER COLUMN zinc_egp_per_gram SET NOT NULL;

-- Currencies
ALTER TABLE public.market_rates
  ALTER COLUMN aed_egp SET NOT NULL,
  ALTER COLUMN aud_egp SET NOT NULL,
  ALTER COLUMN bhd_egp SET NOT NULL,
  ALTER COLUMN btc_egp SET NOT NULL,
  ALTER COLUMN cad_egp SET NOT NULL,
  ALTER COLUMN chf_egp SET NOT NULL,
  ALTER COLUMN cnh_egp SET NOT NULL,
  ALTER COLUMN cny_egp SET NOT NULL,
  ALTER COLUMN dkk_egp SET NOT NULL,
  ALTER COLUMN dzd_egp SET NOT NULL,
  ALTER COLUMN gbp_egp SET NOT NULL,
  ALTER COLUMN hkd_egp SET NOT NULL,
  ALTER COLUMN inr_egp SET NOT NULL,
  ALTER COLUMN iqd_egp SET NOT NULL,
  ALTER COLUMN isk_egp SET NOT NULL,
  ALTER COLUMN jod_egp SET NOT NULL,
  ALTER COLUMN jpy_egp SET NOT NULL,
  ALTER COLUMN kpw_egp SET NOT NULL,
  ALTER COLUMN krw_egp SET NOT NULL,
  ALTER COLUMN kwd_egp SET NOT NULL,
  ALTER COLUMN lyd_egp SET NOT NULL,
  ALTER COLUMN mad_egp SET NOT NULL,
  ALTER COLUMN myr_egp SET NOT NULL,
  ALTER COLUMN nok_egp SET NOT NULL,
  ALTER COLUMN nzd_egp SET NOT NULL,
  ALTER COLUMN omr_egp SET NOT NULL,
  ALTER COLUMN qar_egp SET NOT NULL,
  ALTER COLUMN rub_egp SET NOT NULL,
  ALTER COLUMN sar_egp SET NOT NULL,
  ALTER COLUMN sek_egp SET NOT NULL,
  ALTER COLUMN sgd_egp SET NOT NULL,
  ALTER COLUMN tnd_egp SET NOT NULL,
  ALTER COLUMN try_egp SET NOT NULL,
  ALTER COLUMN zar_egp SET NOT NULL;

-- Timestamps
ALTER TABLE public.market_rates
  ALTER COLUMN timestamp_metal SET NOT NULL,
  ALTER COLUMN timestamp_currency SET NOT NULL;

-- =============================================================================
-- SECTION 4: SET DEFAULT VALUES FOR daily_market_rates_snapshot
-- =============================================================================

UPDATE public.daily_market_rates_snapshot SET
  -- Metals
  platinum_egp_per_gram = COALESCE(platinum_egp_per_gram, 0),
  palladium_egp_per_gram = COALESCE(palladium_egp_per_gram, 0),
  lbma_gold_am_egp_per_gram = COALESCE(lbma_gold_am_egp_per_gram, 0),
  lbma_gold_pm_egp_per_gram = COALESCE(lbma_gold_pm_egp_per_gram, 0),
  lbma_silver_egp_per_gram = COALESCE(lbma_silver_egp_per_gram, 0),
  lbma_platinum_am_egp_per_gram = COALESCE(lbma_platinum_am_egp_per_gram, 0),
  lbma_platinum_pm_egp_per_gram = COALESCE(lbma_platinum_pm_egp_per_gram, 0),
  lbma_palladium_am_egp_per_gram = COALESCE(lbma_palladium_am_egp_per_gram, 0),
  lbma_palladium_pm_egp_per_gram = COALESCE(lbma_palladium_pm_egp_per_gram, 0),
  copper_egp_per_gram = COALESCE(copper_egp_per_gram, 0),
  aluminum_egp_per_gram = COALESCE(aluminum_egp_per_gram, 0),
  lead_egp_per_gram = COALESCE(lead_egp_per_gram, 0),
  nickel_egp_per_gram = COALESCE(nickel_egp_per_gram, 0),
  zinc_egp_per_gram = COALESCE(zinc_egp_per_gram, 0),
  -- Currencies
  gbp_egp = COALESCE(gbp_egp, 0),
  aed_egp = COALESCE(aed_egp, 0),
  aud_egp = COALESCE(aud_egp, 0),
  bhd_egp = COALESCE(bhd_egp, 0),
  btc_egp = COALESCE(btc_egp, 0),
  cad_egp = COALESCE(cad_egp, 0),
  chf_egp = COALESCE(chf_egp, 0),
  cnh_egp = COALESCE(cnh_egp, 0),
  cny_egp = COALESCE(cny_egp, 0),
  dkk_egp = COALESCE(dkk_egp, 0),
  dzd_egp = COALESCE(dzd_egp, 0),
  hkd_egp = COALESCE(hkd_egp, 0),
  inr_egp = COALESCE(inr_egp, 0),
  iqd_egp = COALESCE(iqd_egp, 0),
  isk_egp = COALESCE(isk_egp, 0),
  jod_egp = COALESCE(jod_egp, 0),
  jpy_egp = COALESCE(jpy_egp, 0),
  kpw_egp = COALESCE(kpw_egp, 0),
  krw_egp = COALESCE(krw_egp, 0),
  kwd_egp = COALESCE(kwd_egp, 0),
  lyd_egp = COALESCE(lyd_egp, 0),
  mad_egp = COALESCE(mad_egp, 0),
  myr_egp = COALESCE(myr_egp, 0),
  nok_egp = COALESCE(nok_egp, 0),
  nzd_egp = COALESCE(nzd_egp, 0),
  omr_egp = COALESCE(omr_egp, 0),
  qar_egp = COALESCE(qar_egp, 0),
  rub_egp = COALESCE(rub_egp, 0),
  sar_egp = COALESCE(sar_egp, 0),
  sek_egp = COALESCE(sek_egp, 0),
  sgd_egp = COALESCE(sgd_egp, 0),
  tnd_egp = COALESCE(tnd_egp, 0),
  try_egp = COALESCE(try_egp, 0),
  zar_egp = COALESCE(zar_egp, 0);

-- =============================================================================
-- SECTION 5: ADD NOT NULL CONSTRAINTS TO daily_market_rates_snapshot
-- =============================================================================

-- Metals
ALTER TABLE public.daily_market_rates_snapshot
  ALTER COLUMN platinum_egp_per_gram SET NOT NULL,
  ALTER COLUMN palladium_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_gold_am_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_gold_pm_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_silver_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_platinum_am_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_platinum_pm_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_palladium_am_egp_per_gram SET NOT NULL,
  ALTER COLUMN lbma_palladium_pm_egp_per_gram SET NOT NULL,
  ALTER COLUMN copper_egp_per_gram SET NOT NULL,
  ALTER COLUMN aluminum_egp_per_gram SET NOT NULL,
  ALTER COLUMN lead_egp_per_gram SET NOT NULL,
  ALTER COLUMN nickel_egp_per_gram SET NOT NULL,
  ALTER COLUMN zinc_egp_per_gram SET NOT NULL;

-- Currencies
ALTER TABLE public.daily_market_rates_snapshot
  ALTER COLUMN gbp_egp SET NOT NULL,
  ALTER COLUMN aed_egp SET NOT NULL,
  ALTER COLUMN aud_egp SET NOT NULL,
  ALTER COLUMN bhd_egp SET NOT NULL,
  ALTER COLUMN btc_egp SET NOT NULL,
  ALTER COLUMN cad_egp SET NOT NULL,
  ALTER COLUMN chf_egp SET NOT NULL,
  ALTER COLUMN cnh_egp SET NOT NULL,
  ALTER COLUMN cny_egp SET NOT NULL,
  ALTER COLUMN dkk_egp SET NOT NULL,
  ALTER COLUMN dzd_egp SET NOT NULL,
  ALTER COLUMN hkd_egp SET NOT NULL,
  ALTER COLUMN inr_egp SET NOT NULL,
  ALTER COLUMN iqd_egp SET NOT NULL,
  ALTER COLUMN isk_egp SET NOT NULL,
  ALTER COLUMN jod_egp SET NOT NULL,
  ALTER COLUMN jpy_egp SET NOT NULL,
  ALTER COLUMN kpw_egp SET NOT NULL,
  ALTER COLUMN krw_egp SET NOT NULL,
  ALTER COLUMN kwd_egp SET NOT NULL,
  ALTER COLUMN lyd_egp SET NOT NULL,
  ALTER COLUMN mad_egp SET NOT NULL,
  ALTER COLUMN myr_egp SET NOT NULL,
  ALTER COLUMN nok_egp SET NOT NULL,
  ALTER COLUMN nzd_egp SET NOT NULL,
  ALTER COLUMN omr_egp SET NOT NULL,
  ALTER COLUMN qar_egp SET NOT NULL,
  ALTER COLUMN rub_egp SET NOT NULL,
  ALTER COLUMN sar_egp SET NOT NULL,
  ALTER COLUMN sek_egp SET NOT NULL,
  ALTER COLUMN sgd_egp SET NOT NULL,
  ALTER COLUMN tnd_egp SET NOT NULL,
  ALTER COLUMN try_egp SET NOT NULL,
  ALTER COLUMN zar_egp SET NOT NULL;

-- =============================================================================
-- SECTION 6: UPDATE COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.market_rates.timestamp_metal IS 'Timestamp from metals.dev API for metal prices';
COMMENT ON COLUMN public.market_rates.timestamp_currency IS 'Timestamp from metals.dev API for currency rates';

-- =============================================================================
-- SECTION 7: FIX FUNCTIONS TO USE timestamp_metal INSTEAD OF timestamp
-- =============================================================================

-- 7.1 Fix recalculate_daily_snapshot_balance
CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_balance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  rates_exist BOOLEAN;
BEGIN
  -- Check if market rates exist
  SELECT EXISTS(SELECT 1 FROM public.market_rates) INTO rates_exist;
  
  IF NOT rates_exist THEN
    RAISE NOTICE 'Skipping balance snapshot: no market rates available';
    RETURN;
  END IF;

  -- Delete existing snapshot for today (to handle re-runs)
  DELETE FROM public.daily_snapshot_balance 
  WHERE user_id IN (SELECT DISTINCT user_id FROM public.accounts WHERE deleted = false)
    AND DATE(created_at) = today;

  INSERT INTO public.daily_snapshot_balance (user_id, total_accounts_egp, breakdown, created_at)
  SELECT 
    a.user_id,
    SUM(
      CASE a.currency
        WHEN 'EGP' THEN a.balance
        WHEN 'USD' THEN a.balance * r.usd_egp
        WHEN 'EUR' THEN a.balance * r.eur_egp
        WHEN 'GBP' THEN a.balance * r.gbp_egp
        WHEN 'AED' THEN a.balance * r.aed_egp
        WHEN 'SAR' THEN a.balance * r.sar_egp
        WHEN 'KWD' THEN a.balance * r.kwd_egp
        WHEN 'BHD' THEN a.balance * r.bhd_egp
        WHEN 'QAR' THEN a.balance * r.qar_egp
        WHEN 'OMR' THEN a.balance * r.omr_egp
        WHEN 'JOD' THEN a.balance * r.jod_egp
        WHEN 'AUD' THEN a.balance * r.aud_egp
        WHEN 'CAD' THEN a.balance * r.cad_egp
        WHEN 'CHF' THEN a.balance * r.chf_egp
        WHEN 'CNY' THEN a.balance * r.cny_egp
        WHEN 'JPY' THEN a.balance * r.jpy_egp
        WHEN 'INR' THEN a.balance * r.inr_egp
        WHEN 'TRY' THEN a.balance * r.try_egp
        WHEN 'RUB' THEN a.balance * r.rub_egp
        WHEN 'ZAR' THEN a.balance * r.zar_egp
        WHEN 'BTC' THEN a.balance * r.btc_egp
        ELSE a.balance -- Fallback for any unmapped currency
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
        WHEN 'USD' THEN a.balance * r.usd_egp
        WHEN 'EUR' THEN a.balance * r.eur_egp
        WHEN 'GBP' THEN a.balance * r.gbp_egp
        WHEN 'AED' THEN a.balance * r.aed_egp
        WHEN 'SAR' THEN a.balance * r.sar_egp
        WHEN 'KWD' THEN a.balance * r.kwd_egp
        WHEN 'BHD' THEN a.balance * r.bhd_egp
        WHEN 'QAR' THEN a.balance * r.qar_egp
        WHEN 'OMR' THEN a.balance * r.omr_egp
        WHEN 'JOD' THEN a.balance * r.jod_egp
        WHEN 'AUD' THEN a.balance * r.aud_egp
        WHEN 'CAD' THEN a.balance * r.cad_egp
        WHEN 'CHF' THEN a.balance * r.chf_egp
        WHEN 'CNY' THEN a.balance * r.cny_egp
        WHEN 'JPY' THEN a.balance * r.jpy_egp
        WHEN 'INR' THEN a.balance * r.inr_egp
        WHEN 'TRY' THEN a.balance * r.try_egp
        WHEN 'RUB' THEN a.balance * r.rub_egp
        WHEN 'ZAR' THEN a.balance * r.zar_egp
        WHEN 'BTC' THEN a.balance * r.btc_egp
        ELSE a.balance
        END
      )
    ),
    NOW()
  FROM public.accounts a
  CROSS JOIN (SELECT * FROM public.market_rates ORDER BY created_at DESC LIMIT 1) r
  WHERE a.deleted = false
  GROUP BY a.user_id;
END;
$$;

-- 7.2 Fix recalculate_daily_snapshot_assets
CREATE OR REPLACE FUNCTION public.recalculate_daily_snapshot_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  rates_exist BOOLEAN;
BEGIN
  -- Check if market rates exist
  SELECT EXISTS(SELECT 1 FROM public.market_rates) INTO rates_exist;
  
  IF NOT rates_exist THEN
    RAISE NOTICE 'Skipping assets snapshot: no market rates available';
    RETURN;
  END IF;

  -- Delete existing snapshot for today (to handle re-runs)
  DELETE FROM public.daily_snapshot_assets 
  WHERE user_id IN (SELECT DISTINCT a.user_id FROM public.assets a WHERE a.deleted = false AND a.type = 'METAL')
    AND DATE(created_at) = today;

  INSERT INTO public.daily_snapshot_assets (user_id, total_assets_egp, breakdown, created_at)
  SELECT 
    a.user_id,
    SUM(
      am.weight_grams * (am.purity_karat::decimal / 24) * 
      CASE am.metal_type 
        WHEN 'GOLD' THEN r.gold_egp_per_gram
        WHEN 'SILVER' THEN r.silver_egp_per_gram
        WHEN 'PLATINUM' THEN r.platinum_egp_per_gram
        WHEN 'PALLADIUM' THEN r.palladium_egp_per_gram
        WHEN 'COPPER' THEN r.copper_egp_per_gram
        WHEN 'ALUMINUM' THEN r.aluminum_egp_per_gram
        WHEN 'LEAD' THEN r.lead_egp_per_gram
        WHEN 'NICKEL' THEN r.nickel_egp_per_gram
        WHEN 'ZINC' THEN r.zinc_egp_per_gram
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
        WHEN 'GOLD' THEN r.gold_egp_per_gram
        WHEN 'SILVER' THEN r.silver_egp_per_gram
        WHEN 'PLATINUM' THEN r.platinum_egp_per_gram
        WHEN 'PALLADIUM' THEN r.palladium_egp_per_gram
        WHEN 'COPPER' THEN r.copper_egp_per_gram
        WHEN 'ALUMINUM' THEN r.aluminum_egp_per_gram
        WHEN 'LEAD' THEN r.lead_egp_per_gram
        WHEN 'NICKEL' THEN r.nickel_egp_per_gram
        WHEN 'ZINC' THEN r.zinc_egp_per_gram
        ELSE 0
      END
      )
    ),
    NOW()
  FROM public.assets a
  JOIN public.asset_metals am ON am.asset_id = a.id
  CROSS JOIN (SELECT * FROM public.market_rates ORDER BY created_at DESC LIMIT 1) r
  WHERE a.deleted = false AND a.type = 'METAL'
  GROUP BY a.user_id;
END;
$$;

-- 7.3 Fix save_daily_market_rates_snapshot
CREATE OR REPLACE FUNCTION public.save_daily_market_rates_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Delete existing snapshot for today (to handle re-runs)
  DELETE FROM public.daily_market_rates_snapshot WHERE DATE(created_at) = today;

  INSERT INTO public.daily_market_rates_snapshot (
    -- Base metals
    gold_egp_per_gram, silver_egp_per_gram, platinum_egp_per_gram, palladium_egp_per_gram,
    -- LBMA metals
    lbma_gold_am_egp_per_gram, lbma_gold_pm_egp_per_gram, lbma_silver_egp_per_gram,
    lbma_platinum_am_egp_per_gram, lbma_platinum_pm_egp_per_gram,
    lbma_palladium_am_egp_per_gram, lbma_palladium_pm_egp_per_gram,
    -- Industrial metals
    copper_egp_per_gram, aluminum_egp_per_gram, lead_egp_per_gram, nickel_egp_per_gram, zinc_egp_per_gram,
    -- Base currencies
    usd_egp, eur_egp, gbp_egp,
    -- Other currencies
    aed_egp, aud_egp, bhd_egp, btc_egp, cad_egp, chf_egp, cnh_egp, cny_egp,
    dkk_egp, dzd_egp, hkd_egp, inr_egp, iqd_egp, isk_egp, jod_egp, jpy_egp,
    kpw_egp, krw_egp, kwd_egp, lyd_egp, mad_egp, myr_egp, nok_egp, nzd_egp,
    omr_egp, qar_egp, rub_egp, sar_egp, sek_egp, sgd_egp, tnd_egp, try_egp, zar_egp,
    -- Metadata
    created_at
  )
  SELECT 
    gold_egp_per_gram, silver_egp_per_gram, platinum_egp_per_gram, palladium_egp_per_gram,
    lbma_gold_am_egp_per_gram, lbma_gold_pm_egp_per_gram, lbma_silver_egp_per_gram,
    lbma_platinum_am_egp_per_gram, lbma_platinum_pm_egp_per_gram,
    lbma_palladium_am_egp_per_gram, lbma_palladium_pm_egp_per_gram,
    copper_egp_per_gram, aluminum_egp_per_gram, lead_egp_per_gram, nickel_egp_per_gram, zinc_egp_per_gram,
    usd_egp, eur_egp, gbp_egp,
    aed_egp, aud_egp, bhd_egp, btc_egp, cad_egp, chf_egp, cnh_egp, cny_egp,
    dkk_egp, dzd_egp, hkd_egp, inr_egp, iqd_egp, isk_egp, jod_egp, jpy_egp,
    kpw_egp, krw_egp, kwd_egp, lyd_egp, mad_egp, myr_egp, nok_egp, nzd_egp,
    omr_egp, qar_egp, rub_egp, sar_egp, sek_egp, sgd_egp, tnd_egp, try_egp, zar_egp,
    NOW()
  FROM public.market_rates
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;
