-- Feature: 024-skip-returning-onboarding (follow-up)
-- Align `profiles.preferred_currency` with the rest of the schema by converting
-- it from `CHAR(3)` to the `currency_type` enum that every other currency
-- column already uses (see migration 027_remove_cnh_from_enum.sql).
--
-- Before this migration:
--   profiles.preferred_currency  CHAR(3) NOT NULL DEFAULT 'EGP'
-- After this migration:
--   profiles.preferred_currency  currency_type NOT NULL DEFAULT 'EGP'::currency_type
--
-- Benefits:
--   * DB-enforced value constraint matching the 36-value CurrencyType union
--     already exposed from `packages/db/src/types.ts`.
--   * Consistency with accounts.currency, assets.currency, budgets.currency,
--     transactions.currency, transfers.currency, recurring_payments.currency
--     which were all migrated in 027.
--   * Removes the "why is this one column special?" papercut in the generated
--     TS types.
--
-- Idempotency:
--   The ALTER COLUMN TYPE statement is a no-op if the column is already the
--   enum type; Postgres raises SQLSTATE 42804 ("data type mismatch") in that
--   case. We guard on `information_schema.columns` so re-running the migration
--   against an environment that already applied it is safe.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preferred_currency'
      AND data_type <> 'USER-DEFINED'
  ) THEN
    -- 1. Drop the default (Postgres can't auto-cast defaults during ALTER TYPE).
    ALTER TABLE profiles ALTER COLUMN preferred_currency DROP DEFAULT;

    -- 2. Cast the column to the enum. All existing values are 3-letter ISO
    --    codes that match the enum; any row whose value is NOT in the enum
    --    will raise an error here (acceptable — data corruption should fail
    --    loudly, not silently).
    ALTER TABLE profiles
      ALTER COLUMN preferred_currency
      TYPE currency_type
      USING preferred_currency::text::currency_type;

    -- 3. Restore the default using the enum literal.
    ALTER TABLE profiles
      ALTER COLUMN preferred_currency
      SET DEFAULT 'EGP'::currency_type;
  END IF;
END
$$;
