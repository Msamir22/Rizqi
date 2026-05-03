-- =============================================================================
-- Monyvi Database Schema Migration
-- Version: 008
-- Description: Update all RLS policies to require authenticated role only
--              (no public or anon access)
-- =============================================================================

-- =============================================================================
-- SECTION 1: PROFILES TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 2: ACCOUNTS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 3: BANK_DETAILS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can insert own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can update own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can delete own bank details" ON public.bank_details;

CREATE POLICY "Users can view own bank details" ON public.bank_details
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own bank details" ON public.bank_details
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can update own bank details" ON public.bank_details
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own bank details" ON public.bank_details
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

-- =============================================================================
-- SECTION 4: ASSETS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;

CREATE POLICY "Users can view own assets" ON public.assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON public.assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets" ON public.assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 5: ASSET_METALS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own metal assets" ON public.asset_metals;
DROP POLICY IF EXISTS "Users can insert own metal assets" ON public.asset_metals;
DROP POLICY IF EXISTS "Users can update own metal assets" ON public.asset_metals;
DROP POLICY IF EXISTS "Users can delete own metal assets" ON public.asset_metals;

CREATE POLICY "Users can view own metal assets" ON public.asset_metals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own metal assets" ON public.asset_metals
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

CREATE POLICY "Users can update own metal assets" ON public.asset_metals
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own metal assets" ON public.asset_metals
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

-- =============================================================================
-- SECTION 6: CATEGORIES TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view system categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view own custom categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

-- System categories visible to all authenticated users
CREATE POLICY "Users can view system categories" ON public.categories
  FOR SELECT TO authenticated USING (is_system = true);

CREATE POLICY "Users can view own custom categories" ON public.categories
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND is_system = false);

-- =============================================================================
-- SECTION 7: USER_CATEGORY_SETTINGS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own category settings" ON public.user_category_settings;
DROP POLICY IF EXISTS "Users can insert own category settings" ON public.user_category_settings;
DROP POLICY IF EXISTS "Users can update own category settings" ON public.user_category_settings;
DROP POLICY IF EXISTS "Users can delete own category settings" ON public.user_category_settings;

CREATE POLICY "Users can view own category settings" ON public.user_category_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category settings" ON public.user_category_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category settings" ON public.user_category_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category settings" ON public.user_category_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 8: DEBTS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;

CREATE POLICY "Users can view own debts" ON public.debts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts" ON public.debts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts" ON public.debts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts" ON public.debts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 9: RECURRING_PAYMENTS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can insert own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can update own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can delete own recurring payments" ON public.recurring_payments;

CREATE POLICY "Users can view own recurring payments" ON public.recurring_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring payments" ON public.recurring_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring payments" ON public.recurring_payments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring payments" ON public.recurring_payments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 10: TRANSACTIONS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 11: TRANSFERS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;

CREATE POLICY "Users can view own transfers" ON public.transfers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transfers" ON public.transfers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 12: BUDGETS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 13: DAILY_SNAPSHOT_NET_WORTH TABLE POLICIES
-- (formerly user_net_worth_summary)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own net worth" ON public.daily_snapshot_net_worth;
-- Keep the service_role policy: "Service role can manage net worth"

CREATE POLICY "Users can view own net worth" ON public.daily_snapshot_net_worth
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 14: DAILY_SNAPSHOT_BALANCE TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own balance snapshots" ON public.daily_snapshot_balance;
-- Keep the service_role policy: "Service role can manage balance snapshots"

CREATE POLICY "Users can view own balance snapshots" ON public.daily_snapshot_balance
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 15: DAILY_SNAPSHOT_ASSETS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own asset snapshots" ON public.daily_snapshot_assets;
-- Keep the service_role policy: "Service role can manage asset snapshots"

CREATE POLICY "Users can view own asset snapshots" ON public.daily_snapshot_assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SECTION 16: MARKET_RATES TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.market_rates;
-- Keep the service_role policy: "Allow service role to update"

CREATE POLICY "Allow authenticated read access" ON public.market_rates
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- SECTION 17: MARKET_RATES_HISTORY TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.market_rates_history;
-- Keep the service_role policy: "Service role can manage rates history"

CREATE POLICY "Allow authenticated read access" ON public.market_rates_history
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
