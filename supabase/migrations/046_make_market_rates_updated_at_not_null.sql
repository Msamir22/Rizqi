-- Migration: Make market_rates.updated_at NOT NULL

-- Step 1: Backfill null updated_at values with created_at or NOW()
UPDATE public.market_rates 
SET updated_at = COALESCE(created_at, NOW()) 
WHERE updated_at IS NULL;

-- Step 2: Set NOT NULL constraint
ALTER TABLE public.market_rates 
ALTER COLUMN updated_at SET NOT NULL;

-- Step 3: Ensure default is set (redundant but safe)
ALTER TABLE public.market_rates 
ALTER COLUMN updated_at SET DEFAULT NOW();
