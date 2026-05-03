-- =============================================================================
-- Migration 044: Widen DECIMAL precision from (15,2) to (15,3)
-- =============================================================================
--
-- BHD, KWD, and OMR use 3 decimal places (ISO 4217). The previous (15,2)
-- precision silently truncated values for these currencies and caused
-- local/remote drift when WatermelonDB synced floating-point values to
-- Postgres.
--
-- This migration widens ALL monetary columns and related trigger variables
-- to DECIMAL(15,3) to accommodate three-decimal currencies.

-- =============================================================================
-- SECTION 1: ALTER TABLE COLUMNS
-- =============================================================================

ALTER TABLE public.accounts
  ALTER COLUMN balance TYPE DECIMAL(15, 3);

ALTER TABLE public.debts
  ALTER COLUMN original_amount TYPE DECIMAL(15, 3),
  ALTER COLUMN outstanding_amount TYPE DECIMAL(15, 3);

ALTER TABLE public.transactions
  ALTER COLUMN amount TYPE DECIMAL(15, 3);

ALTER TABLE public.transfers
  ALTER COLUMN amount TYPE DECIMAL(15, 3),
  ALTER COLUMN converted_amount TYPE DECIMAL(15, 3);

ALTER TABLE public.recurring_payments
  ALTER COLUMN amount TYPE DECIMAL(15, 3);

-- =============================================================================
-- SECTION 2: UPDATE TRIGGER FUNCTIONS (variable declarations)
-- =============================================================================

-- Recreate recalculate_account_balance with DECIMAL(15,3)
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(account_id_param UUID)
RETURNS DECIMAL(15, 3)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calculated_balance DECIMAL(15, 3);
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN type = 'INCOME' THEN amount
      WHEN type = 'EXPENSE' THEN -amount
      ELSE 0
    END
  ), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE account_id = account_id_param
    AND deleted = false;

  RETURN calculated_balance;
END;
$$;

-- Recreate recalculate_all_account_balances with DECIMAL(15,3)
CREATE OR REPLACE FUNCTION public.recalculate_all_account_balances()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  account_record RECORD;
  new_balance DECIMAL(15, 3);
  update_count INTEGER := 0;
BEGIN
  FOR account_record IN SELECT id FROM public.accounts WHERE deleted = false LOOP
    new_balance := public.recalculate_account_balance(account_record.id);

    UPDATE public.accounts
    SET balance = new_balance, updated_at = NOW()
    WHERE id = account_record.id;

    update_count := update_count + 1;
  END LOOP;

  RETURN update_count;
END;
$$;
