-- Remove CNH from currency_type enum
-- CNH was added in migration 009 but is not supported by the app
-- (not in SUPPORTED_CURRENCIES or CURRENCY_INFO_MAP)

-- Postgres does not support ALTER TYPE ... DROP VALUE directly.
-- We must rename the old type, create a new one without CNH,
-- and migrate all columns that reference it.

-- 1. Rename the existing enum
ALTER TYPE currency_type RENAME TO currency_type_old;

-- 2. Create new enum without CNH
CREATE TYPE currency_type AS ENUM (
  'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD',
  'IQD', 'LYD', 'TND', 'MAD', 'DZD',
  'USD', 'EUR', 'GBP', 'JPY', 'CHF',
  'CNY', 'INR', 'KRW', 'KPW', 'SGD', 'HKD', 'MYR', 'AUD', 'NZD',
  'CAD',
  'SEK', 'NOK', 'DKK', 'ISK', 'TRY', 'RUB',
  'ZAR',
  'BTC'
);

-- 3. Migrate columns: accounts.currency
ALTER TABLE accounts
  ALTER COLUMN currency TYPE currency_type USING currency::text::currency_type;

-- 4. Migrate columns: transactions.currency
ALTER TABLE transactions
  ALTER COLUMN currency TYPE currency_type USING currency::text::currency_type;

-- 5. Migrate columns: recurring_payments.currency
ALTER TABLE recurring_payments
  ALTER COLUMN currency TYPE currency_type USING currency::text::currency_type;

-- 6. Migrate columns: profiles.preferred_currency
ALTER TABLE profiles
  ALTER COLUMN preferred_currency TYPE currency_type USING preferred_currency::text::currency_type;

-- 7. Drop the old type
DROP TYPE currency_type_old;
