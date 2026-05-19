-- Align local replayable schema with runtime objects that existed in the
-- linked remote database but were missing from migrations.

-- Remote signup trigger behavior preserves the requested onboarding language
-- from auth metadata and pins the function search path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  requested_language public.preferred_language_code;
BEGIN
  requested_language := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'ar')
      THEN (NEW.raw_user_meta_data->>'preferred_language')::public.preferred_language_code
    ELSE 'en'::public.preferred_language_code
  END;

  INSERT INTO public.profiles (
    user_id,
    display_name,
    avatar_url,
    preferred_language
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    requested_language
  );

  RETURN NEW;
END;
$function$;

-- Migration 026 removed the old market-rate snapshot table/function. The
-- remote daily snapshot runner no longer calls that stale function.
CREATE OR REPLACE FUNCTION public.run_daily_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$BEGIN
  -- Run all snapshot functions in sequence
  PERFORM public.recalculate_daily_snapshot_balance();
  PERFORM public.recalculate_daily_snapshot_assets();
  PERFORM public.recalculate_daily_snapshot_net_worth();
  
  RAISE NOTICE 'Daily snapshots completed at %', NOW();
END;$function$;

ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

-- Shared system categories are visible to every user, so their usage counters
-- must stay neutral. User-specific ordering can only update user-owned
-- category rows.
UPDATE public.categories
  SET usage_count = 0, updated_at = now()
  WHERE user_id IS NULL
    AND usage_count <> 0;

-- Keep user-owned category usage counters in sync with transaction category changes.
CREATE OR REPLACE FUNCTION public.update_category_usage_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Handle INSERT: increment the new category's usage_count
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL AND NEW.deleted = false THEN
      UPDATE public.categories
        SET usage_count = usage_count + 1, updated_at = now()
        WHERE id = NEW.category_id
          AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE: if owner, category_id, or soft-delete changed
  IF TG_OP = 'UPDATE' THEN
    -- Category or owner changed: decrement old, increment new
    IF OLD.category_id IS DISTINCT FROM NEW.category_id
      OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      IF OLD.category_id IS NOT NULL AND OLD.deleted = false THEN
        UPDATE public.categories
          SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now()
          WHERE id = OLD.category_id
            AND user_id = OLD.user_id;
      END IF;
      IF NEW.category_id IS NOT NULL AND NEW.deleted = false THEN
        UPDATE public.categories
          SET usage_count = usage_count + 1, updated_at = now()
          WHERE id = NEW.category_id
            AND user_id = NEW.user_id;
      END IF;
    -- Soft-delete toggled
    ELSIF OLD.deleted IS DISTINCT FROM NEW.deleted THEN
      IF NEW.deleted = true AND NEW.category_id IS NOT NULL THEN
        UPDATE public.categories
          SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now()
          WHERE id = NEW.category_id
            AND user_id = NEW.user_id;
      ELSIF NEW.deleted = false AND NEW.category_id IS NOT NULL THEN
        UPDATE public.categories
          SET usage_count = usage_count + 1, updated_at = now()
          WHERE id = NEW.category_id
            AND user_id = NEW.user_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE: decrement the category's usage_count
  IF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL AND OLD.deleted = false THEN
      UPDATE public.categories
        SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now()
        WHERE id = OLD.category_id
          AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_category_usage_count ON public.transactions;
CREATE TRIGGER trg_update_category_usage_count
AFTER INSERT OR DELETE OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_category_usage_count();

DROP TRIGGER IF EXISTS handle_asset_metals_updated_at ON public.asset_metals;
ALTER TABLE public.asset_metals
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER handle_asset_metals_updated_at
BEFORE UPDATE ON public.asset_metals
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Remote uses the shared handle_updated_at trigger for market_rates. Remove the
-- stale local-only trigger/function pair from the early market-rate migration.
DROP TRIGGER IF EXISTS update_market_rates_updated_at ON public.market_rates;
DROP FUNCTION IF EXISTS public.update_market_rates_updated_at();

DROP TRIGGER IF EXISTS handle_market_rates_updated_at ON public.market_rates;
CREATE TRIGGER handle_market_rates_updated_at
BEFORE UPDATE ON public.market_rates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
