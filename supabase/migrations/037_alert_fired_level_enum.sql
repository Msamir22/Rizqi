-- =============================================================================
-- Migration 037: Convert alert_fired_level to Enum
-- Converts the TEXT + CHECK constraint to a proper DB enum so the type
-- is auto-generated in types.ts by the schema transform script.
-- =============================================================================

-- 1. Create the enum type
CREATE TYPE public.alert_fired_level AS ENUM ('WARNING', 'DANGER');

-- 2. Drop the existing CHECK constraint
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS chk_alert_fired_level;

-- 3. Normalize any legacy values to NULL before enum cast
UPDATE budgets
  SET alert_fired_level = NULL
  WHERE alert_fired_level IS NOT NULL
    AND alert_fired_level NOT IN ('WARNING', 'DANGER');

-- 4. Convert the column from TEXT to the enum type
ALTER TABLE budgets
  ALTER COLUMN alert_fired_level TYPE public.alert_fired_level
  USING alert_fired_level::public.alert_fired_level;
