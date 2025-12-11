-- Astik Supabase Schema
-- Market Rates Table for caching metals.dev API responses
-- Create market_rates table
create table if not exists public.market_rates (
  id INTEGER primary key default 1,
  metals JSONB not null,
  currencies JSONB not null,
  timestamp TIMESTAMPTZ not null,
  created_at TIMESTAMPTZ default NOW(),
  updated_at TIMESTAMPTZ default NOW(),
  constraint single_row_constraint check (id = 1)
);
-- Add comment
COMMENT on table public.market_rates is 'Cached metal prices and currency rates from metals.dev API';
-- Enable Row Level Security (RLS)
alter table public.market_rates ENABLE row LEVEL SECURITY;
-- Create policy for public read access (anon users can read rates)
create policy "Allow public read access" on public.market_rates for
select to anon using (true);
-- Create policy for authenticated write access (service role can update)
create policy "Allow service role to update" on public.market_rates for all to service_role using (true) with check (true);
-- Create index on timestamp for faster queries
create index IF not exists idx_market_rates_timestamp on public.market_rates (timestamp desc);
-- Create updated_at trigger
create or replace function public.update_market_rates_updated_at () RETURNS TRIGGER as $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
create trigger update_market_rates_updated_at BEFORE
update on public.market_rates for EACH row execute FUNCTION public.update_market_rates_updated_at ();
-- Insert initial empty record (optional - for structure)
insert into public.market_rates (id, metals, currencies, timestamp)
values (
    1,
    '{"gold": 0, "silver": 0, "platinum": 0, "palladium": 0}'::jsonb,
    '{"EGP": 0, "EUR": 0, "GBP": 0, "USD": 0}'::jsonb,
    NOW()
  ) on conflict (id) do nothing;