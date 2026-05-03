-- Monyvi Supabase Schema
-- Market Rates Table for caching metals.dev API responses
-- Create market_rates table
CREATE TABLE IF NOT EXISTS public.market_rates (
  id INTEGER PRIMARY KEY DEFAULT 1,
  metals JSONB NOT NULL,
  currencies JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- Add comment
COMMENT ON TABLE public.market_rates IS 'Cached metal prices and currency rates from metals.dev API';

-- Enable Row Level Security (RLS)
ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow public read access" ON public.market_rates;
DROP POLICY IF EXISTS "Allow service role to update" ON public.market_rates;

-- Create policy for public read access (anon users can read rates)
CREATE POLICY "Allow public read access" ON public.market_rates 
  FOR SELECT TO anon USING (true);

-- Create policy for authenticated write access (service role can update)
CREATE POLICY "Allow service role to update" ON public.market_rates 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_market_rates_timestamp ON public.market_rates (timestamp DESC);

-- Drop existing trigger and function if they exist (for idempotency)
DROP TRIGGER IF EXISTS update_market_rates_updated_at ON public.market_rates;
DROP FUNCTION IF EXISTS public.update_market_rates_updated_at();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_market_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_market_rates_updated_at 
  BEFORE UPDATE ON public.market_rates 
  FOR EACH ROW EXECUTE FUNCTION public.update_market_rates_updated_at();

-- Insert initial empty record (optional - for structure)
INSERT INTO public.market_rates (id, metals, currencies, timestamp)
VALUES (
  1,
  '{"gold": 0, "silver": 0, "platinum": 0, "palladium": 0}'::jsonb,
  '{"EGP": 0, "EUR": 0, "GBP": 0, "USD": 0}'::jsonb,
  NOW()
) ON CONFLICT (id) DO NOTHING;