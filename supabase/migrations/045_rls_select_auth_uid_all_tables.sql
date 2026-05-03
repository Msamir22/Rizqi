-- =============================================================================
-- Migration 045: Wrap auth.uid() in (SELECT auth.uid()) for RLS performance
-- =============================================================================
--
-- Supabase performance advisor recommendation: bare auth.uid() is re-evaluated
-- per row. Wrapping it in (SELECT auth.uid()) lets the Postgres planner cache
-- the value once per statement, avoiding correlated-subquery overhead on
-- high-volume tables.
--
-- Scope: ALL tables with user_id-based RLS policies.
-- Skipped: market_rates, market_rates_history (no auth.uid() — just role check),
--          "Users can view system categories" (no auth.uid() — is_system check).

-- =============================================================================
-- SECTION 1: PROFILES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 2: ACCOUNTS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 3: BANK_DETAILS (EXISTS subquery via accounts)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can insert own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can update own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can delete own bank details" ON public.bank_details;

CREATE POLICY "Users can view own bank details" ON public.bank_details
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can insert own bank details" ON public.bank_details
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can update own bank details" ON public.bank_details
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can delete own bank details" ON public.bank_details
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = (SELECT auth.uid()))
  );

-- =============================================================================
-- SECTION 4: ASSETS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;

CREATE POLICY "Users can view own assets" ON public.assets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own assets" ON public.assets
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own assets" ON public.assets
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 5: ASSET_METALS (EXISTS subquery via assets)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own metal assets" ON public.asset_metals;
DROP POLICY IF EXISTS "Users can insert own metal assets" ON public.asset_metals;
DROP POLICY IF EXISTS "Users can update own metal assets" ON public.asset_metals;
DROP POLICY IF EXISTS "Users can delete own metal assets" ON public.asset_metals;

CREATE POLICY "Users can view own metal assets" ON public.asset_metals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can insert own metal assets" ON public.asset_metals
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can update own metal assets" ON public.asset_metals
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can delete own metal assets" ON public.asset_metals
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = (SELECT auth.uid()))
  );

-- =============================================================================
-- SECTION 6: CATEGORIES (mixed: system + custom)
-- =============================================================================
-- "Users can view system categories" is NOT recreated here — it uses
-- is_system = true with no auth.uid() call, so no change needed.

DROP POLICY IF EXISTS "Users can view own custom categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own custom categories" ON public.categories
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id AND is_system = false);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id AND is_system = false);

-- =============================================================================
-- SECTION 7: USER_CATEGORY_SETTINGS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own category settings" ON public.user_category_settings;
DROP POLICY IF EXISTS "Users can insert own category settings" ON public.user_category_settings;
DROP POLICY IF EXISTS "Users can update own category settings" ON public.user_category_settings;
DROP POLICY IF EXISTS "Users can delete own category settings" ON public.user_category_settings;

CREATE POLICY "Users can view own category settings" ON public.user_category_settings
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own category settings" ON public.user_category_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own category settings" ON public.user_category_settings
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own category settings" ON public.user_category_settings
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 8: DEBTS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;

CREATE POLICY "Users can view own debts" ON public.debts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own debts" ON public.debts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own debts" ON public.debts
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own debts" ON public.debts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 9: RECURRING_PAYMENTS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can insert own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can update own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can delete own recurring payments" ON public.recurring_payments;

CREATE POLICY "Users can view own recurring payments" ON public.recurring_payments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own recurring payments" ON public.recurring_payments
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own recurring payments" ON public.recurring_payments
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own recurring payments" ON public.recurring_payments
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 10: TRANSACTIONS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 11: TRANSFERS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;

CREATE POLICY "Users can view own transfers" ON public.transfers
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own transfers" ON public.transfers
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 12: BUDGETS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 13: DAILY_SNAPSHOT_NET_WORTH
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own net worth" ON public.daily_snapshot_net_worth;

CREATE POLICY "Users can view own net worth" ON public.daily_snapshot_net_worth
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 14: DAILY_SNAPSHOT_BALANCE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own balance snapshots" ON public.daily_snapshot_balance;

CREATE POLICY "Users can view own balance snapshots" ON public.daily_snapshot_balance
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 15: DAILY_SNAPSHOT_ASSETS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own asset snapshots" ON public.daily_snapshot_assets;

CREATE POLICY "Users can view own asset snapshots" ON public.daily_snapshot_assets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
