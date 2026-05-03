-- =============================================================================
-- Monyvi Database Schema Migration
-- Version: 002
-- Description: Complete schema for Monyvi personal finance app
-- =============================================================================

-- =============================================================================
-- SECTION 1: CUSTOM TYPES (ENUMS)
-- =============================================================================

-- Account types
CREATE TYPE account_type AS ENUM ('CASH', 'BANK', 'DIGITAL_WALLET');

-- Asset types
CREATE TYPE asset_type AS ENUM ('METAL', 'CRYPTO', 'REAL_ESTATE');

-- Metal types
CREATE TYPE metal_type AS ENUM ('GOLD', 'SILVER', 'PLATINUM');

-- Transaction types
CREATE TYPE transaction_type AS ENUM ('EXPENSE', 'INCOME');

-- Transaction sources
CREATE TYPE transaction_source AS ENUM ('MANUAL', 'VOICE', 'SMS', 'RECURRING');

-- Debt types
CREATE TYPE debt_type AS ENUM ('LENT', 'BORROWED');

-- Debt status
CREATE TYPE debt_status AS ENUM ('ACTIVE', 'PARTIALLY_PAID', 'SETTLED', 'WRITTEN_OFF');

-- Recurring frequency
CREATE TYPE recurring_frequency AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- Recurring action
CREATE TYPE recurring_action AS ENUM ('AUTO_CREATE', 'NOTIFY');

-- Recurring status
CREATE TYPE recurring_status AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- Budget type
CREATE TYPE budget_type AS ENUM ('CATEGORY', 'GLOBAL');

-- Budget period
CREATE TYPE budget_period AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

-- Budget status
CREATE TYPE budget_status AS ENUM ('ACTIVE', 'PAUSED');

-- Category nature
CREATE TYPE category_nature AS ENUM ('WANT', 'NEED', 'MUST');

-- Theme preference
CREATE TYPE theme_preference AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- =============================================================================
-- SECTION 2: HELPER FUNCTION FOR updated_at TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 3: PROFILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  preferred_currency CHAR(3) NOT NULL DEFAULT 'EGP',
  theme theme_preference NOT NULL DEFAULT 'SYSTEM',
  sms_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  notification_settings JSONB DEFAULT '{"sms_transaction_confirmation": true, "recurring_reminders": true, "budget_alerts": true, "low_balance_warnings": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.profiles IS 'User profiles with preferences and settings';

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SECTION 4: ACCOUNTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.accounts IS 'User accounts for liquid money (cash, bank, digital wallet)';

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_deleted ON public.accounts(deleted) WHERE deleted = false;

-- RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 5: BANK_DETAILS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_last_4 VARCHAR(4) NOT NULL,
  sms_sender_name TEXT,
  account_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.bank_details IS 'Bank-specific details for accounts with type=BANK';

CREATE INDEX idx_bank_details_account_id ON public.bank_details(account_id);
CREATE INDEX idx_bank_details_card_last_4 ON public.bank_details(card_last_4);

-- RLS (inherit from parent account)
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank details" ON public.bank_details
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own bank details" ON public.bank_details
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can update own bank details" ON public.bank_details
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own bank details" ON public.bank_details
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = bank_details.account_id AND accounts.user_id = auth.uid())
  );

-- Trigger
CREATE TRIGGER handle_bank_details_updated_at
  BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 6: ASSETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type asset_type NOT NULL,
  is_liquid BOOLEAN NOT NULL DEFAULT false,
  purchase_price DECIMAL(15, 2) NOT NULL,
  purchase_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.assets IS 'User assets for wealth tracking (metals, crypto, real estate)';

CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_assets_type ON public.assets(type);
CREATE INDEX idx_assets_deleted ON public.assets(deleted) WHERE deleted = false;

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets" ON public.assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 7: ASSET_METALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.asset_metals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  metal_type metal_type NOT NULL,
  weight_grams DECIMAL(10, 4) NOT NULL,
  purity_karat SMALLINT NOT NULL CHECK (purity_karat BETWEEN 1 AND 24),
  item_form TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.asset_metals IS 'Metal-specific details for assets with type=METAL';

CREATE INDEX idx_asset_metals_asset_id ON public.asset_metals(asset_id);

-- RLS (inherit from parent asset)
ALTER TABLE public.asset_metals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metal assets" ON public.asset_metals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own metal assets" ON public.asset_metals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

CREATE POLICY "Users can update own metal assets" ON public.asset_metals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own metal assets" ON public.asset_metals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.assets WHERE assets.id = asset_metals.asset_id AND assets.user_id = auth.uid())
  );

-- =============================================================================
-- SECTION 8: CATEGORIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  system_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  icon TEXT NOT NULL,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  nature category_nature,
  type transaction_type,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Constraints
  CONSTRAINT parent_required_for_l2_l3 CHECK (
    (level = 1 AND parent_id IS NULL) OR
    (level > 1 AND parent_id IS NOT NULL)
  ),
  CONSTRAINT user_required_for_custom CHECK (
    is_system = true OR user_id IS NOT NULL
  )
);

COMMENT ON TABLE public.categories IS 'Transaction categories with 3-level hierarchy';

CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX idx_categories_is_system ON public.categories(is_system);
CREATE INDEX idx_categories_level ON public.categories(level);
CREATE UNIQUE INDEX idx_categories_unique_name ON public.categories(user_id, parent_id, system_name) WHERE deleted = false;

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- System categories visible to all authenticated users
CREATE POLICY "Users can view system categories" ON public.categories
  FOR SELECT USING (is_system = true);

CREATE POLICY "Users can view own custom categories" ON public.categories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Trigger
CREATE TRIGGER handle_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 9: USER_CATEGORY_SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_category_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  nature category_nature,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, category_id)
);

COMMENT ON TABLE public.user_category_settings IS 'Per-user settings for system categories (hide, nature override)';

CREATE INDEX idx_user_category_settings_user_id ON public.user_category_settings(user_id);

-- RLS
ALTER TABLE public.user_category_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category settings" ON public.user_category_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category settings" ON public.user_category_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category settings" ON public.user_category_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category settings" ON public.user_category_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_user_category_settings_updated_at
  BEFORE UPDATE ON public.user_category_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 10: DEBTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type debt_type NOT NULL,
  party_name TEXT NOT NULL,
  original_amount DECIMAL(15, 2) NOT NULL,
  outstanding_amount DECIMAL(15, 2) NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  notes TEXT,
  date DATE NOT NULL,
  due_date DATE,
  status debt_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.debts IS 'Money lent to or borrowed from others';

CREATE INDEX idx_debts_user_id ON public.debts(user_id);
CREATE INDEX idx_debts_status ON public.debts(status);
CREATE INDEX idx_debts_deleted ON public.debts(deleted) WHERE deleted = false;

-- RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debts" ON public.debts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts" ON public.debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts" ON public.debts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts" ON public.debts
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 11: RECURRING_PAYMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  type transaction_type NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  frequency recurring_frequency NOT NULL,
  frequency_value SMALLINT,
  start_date DATE NOT NULL,
  end_date DATE,
  next_due_date DATE NOT NULL,
  action recurring_action NOT NULL DEFAULT 'NOTIFY',
  status recurring_status NOT NULL DEFAULT 'ACTIVE',
  linked_debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  
  CONSTRAINT frequency_value_required_for_custom CHECK (
    frequency != 'CUSTOM' OR frequency_value IS NOT NULL
  )
);

COMMENT ON TABLE public.recurring_payments IS 'Scheduled recurring transactions';

CREATE INDEX idx_recurring_payments_user_id ON public.recurring_payments(user_id);
CREATE INDEX idx_recurring_payments_next_due_date ON public.recurring_payments(next_due_date);
CREATE INDEX idx_recurring_payments_status ON public.recurring_payments(status);
CREATE INDEX idx_recurring_payments_deleted ON public.recurring_payments(deleted) WHERE deleted = false;

-- RLS
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring payments" ON public.recurring_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring payments" ON public.recurring_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring payments" ON public.recurring_payments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring payments" ON public.recurring_payments
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 12: TRANSACTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  type transaction_type NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  merchant TEXT,
  note TEXT,
  date DATE NOT NULL,
  source transaction_source NOT NULL DEFAULT 'MANUAL',
  is_draft BOOLEAN NOT NULL DEFAULT false,
  linked_debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  linked_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  linked_recurring_id UUID REFERENCES public.recurring_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.transactions IS 'All financial transactions';

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX idx_transactions_deleted ON public.transactions(deleted) WHERE deleted = false;
CREATE INDEX idx_transactions_is_draft ON public.transactions(is_draft) WHERE is_draft = true;

-- RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 13: TRANSFERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  exchange_rate DECIMAL(15, 6),
  converted_amount DECIMAL(15, 2),
  notes TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

COMMENT ON TABLE public.transfers IS 'Transfers between user own accounts';

CREATE INDEX idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX idx_transfers_date ON public.transfers(date DESC);
CREATE INDEX idx_transfers_deleted ON public.transfers(deleted) WHERE deleted = false;

-- RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfers" ON public.transfers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transfers" ON public.transfers
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 14: BUDGETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type budget_type NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  period budget_period NOT NULL,
  period_start DATE,
  period_end DATE,
  alert_threshold SMALLINT NOT NULL DEFAULT 80 CHECK (alert_threshold BETWEEN 1 AND 100),
  status budget_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  
  CONSTRAINT category_required_for_category_budget CHECK (
    type = 'GLOBAL' OR category_id IS NOT NULL
  ),
  CONSTRAINT custom_period_dates CHECK (
    period != 'CUSTOM' OR (period_start IS NOT NULL AND period_end IS NOT NULL)
  )
);

COMMENT ON TABLE public.budgets IS 'User budgets for spending limits';

CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_status ON public.budgets(status);
CREATE INDEX idx_budgets_deleted ON public.budgets(deleted) WHERE deleted = false;

-- RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER handle_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SECTION 15: USER_NET_WORTH_SUMMARY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_net_worth_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_accounts DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_assets DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_net_worth DECIMAL(15, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_net_worth_summary IS 'Cached net worth calculations for dashboard';

-- RLS
ALTER TABLE public.user_net_worth_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own net worth" ON public.user_net_worth_summary
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can update
CREATE POLICY "Service role can manage net worth" ON public.user_net_worth_summary
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- SECTION 16: DAILY_SNAPSHOT_BALANCE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.daily_snapshot_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_accounts_egp DECIMAL(15, 2) NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, snapshot_date)
);

COMMENT ON TABLE public.daily_snapshot_balance IS 'Daily snapshots of account balances for charts';

CREATE INDEX idx_daily_snapshot_balance_user_date ON public.daily_snapshot_balance(user_id, snapshot_date DESC);

-- RLS
ALTER TABLE public.daily_snapshot_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance snapshots" ON public.daily_snapshot_balance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage balance snapshots" ON public.daily_snapshot_balance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- SECTION 17: DAILY_SNAPSHOT_ASSETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.daily_snapshot_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_assets_egp DECIMAL(15, 2) NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, snapshot_date)
);

COMMENT ON TABLE public.daily_snapshot_assets IS 'Daily snapshots of asset valuations for charts';

CREATE INDEX idx_daily_snapshot_assets_user_date ON public.daily_snapshot_assets(user_id, snapshot_date DESC);

-- RLS
ALTER TABLE public.daily_snapshot_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asset snapshots" ON public.daily_snapshot_assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage asset snapshots" ON public.daily_snapshot_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- SECTION 18: MARKET_RATES_HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.market_rates_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  gold_egp_per_gram DECIMAL(15, 4) NOT NULL,
  silver_egp_per_gram DECIMAL(15, 4) NOT NULL,
  usd_egp DECIMAL(15, 4) NOT NULL,
  eur_egp DECIMAL(15, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.market_rates_history IS 'Historical daily market rates for trend analysis';

CREATE INDEX idx_market_rates_history_date ON public.market_rates_history(snapshot_date DESC);

-- RLS (public read)
ALTER TABLE public.market_rates_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.market_rates_history
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role can manage rates history" ON public.market_rates_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- SECTION 19: SEED DATA - PREDEFINED CATEGORIES
-- =============================================================================

-- Level 1: Main Categories
INSERT INTO public.categories (id, user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  -- Expense Categories
  ('00000000-0000-0000-0001-000000000001', NULL, NULL, 'food_drinks', 'Food & Drinks', '🍔', 1, 'NEED', 'EXPENSE', true, 1),
  ('00000000-0000-0000-0001-000000000002', NULL, NULL, 'transportation', 'Transportation', '🚌', 1, 'NEED', 'EXPENSE', true, 2),
  ('00000000-0000-0000-0001-000000000003', NULL, NULL, 'vehicle', 'Vehicle', '🚗', 1, 'WANT', 'EXPENSE', true, 3),
  ('00000000-0000-0000-0001-000000000004', NULL, NULL, 'shopping', 'Shopping', '🛒', 1, 'WANT', 'EXPENSE', true, 4),
  ('00000000-0000-0000-0001-000000000005', NULL, NULL, 'health_medical', 'Health & Medical', '🏥', 1, 'MUST', 'EXPENSE', true, 5),
  ('00000000-0000-0000-0001-000000000006', NULL, NULL, 'utilities_bills', 'Utilities & Bills', '📄', 1, 'MUST', 'EXPENSE', true, 6),
  ('00000000-0000-0000-0001-000000000007', NULL, NULL, 'entertainment', 'Entertainment', '🎉', 1, 'WANT', 'EXPENSE', true, 7),
  ('00000000-0000-0000-0001-000000000008', NULL, NULL, 'charity', 'Charity', '❤️', 1, 'WANT', 'EXPENSE', true, 8),
  ('00000000-0000-0000-0001-000000000009', NULL, NULL, 'education', 'Education', '📚', 1, 'NEED', 'EXPENSE', true, 9),
  ('00000000-0000-0000-0001-000000000010', NULL, NULL, 'housing', 'Housing', '🏠', 1, 'MUST', 'EXPENSE', true, 10),
  -- Income Category
  ('00000000-0000-0000-0001-000000000011', NULL, NULL, 'income', 'Salary / Income', '💰', 1, NULL, 'INCOME', true, 11),
  -- Mixed (Debt)
  ('00000000-0000-0000-0001-000000000012', NULL, NULL, 'debt_loans', 'Debt / Loans', '🤝', 1, NULL, NULL, true, 12),
  -- Fallback
  ('00000000-0000-0000-0001-000000000013', NULL, NULL, 'other', 'Other', '❓', 1, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Internal Categories (hidden from user selection)
INSERT INTO public.categories (id, user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, is_internal, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000100', NULL, NULL, 'asset_purchase', 'Asset Purchase', '📦', 1, NULL, 'EXPENSE', true, true, 100),
  ('00000000-0000-0000-0001-000000000101', NULL, NULL, 'asset_sale', 'Asset Sale', '💵', 1, NULL, 'INCOME', true, true, 101)
ON CONFLICT DO NOTHING;

-- Level 2: Food & Drinks Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000001', 'groceries', 'Groceries', '🛒', 2, 'NEED', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000001', 'restaurant', 'Restaurant', '🍽️', 2, 'WANT', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000001', 'coffee_tea', 'Coffee & Tea', '☕', 2, 'WANT', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000001', 'snacks', 'Snacks', '🍿', 2, 'WANT', 'EXPENSE', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000001', 'drinks', 'Drinks', '🥤', 2, 'WANT', 'EXPENSE', true, 5),
  (NULL, '00000000-0000-0000-0001-000000000001', 'food_other', 'Other', '🍴', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Transportation Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000002', 'public_transport', 'Public Transport', '🚇', 2, 'NEED', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000002', 'private_transport', 'Private Transport', '🚕', 2, 'WANT', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000002', 'transport_other', 'Other', '🚶', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Vehicle Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000003', 'fuel', 'Fuel', '⛽', 2, 'NEED', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000003', 'parking', 'Parking', '🅿️', 2, 'NEED', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000003', 'rental', 'Rental', '🚙', 2, 'WANT', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000003', 'license_fees', 'License Fees', '📋', 2, 'MUST', 'EXPENSE', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000003', 'vehicle_tax', 'Tax', '💰', 2, 'MUST', 'EXPENSE', true, 5),
  (NULL, '00000000-0000-0000-0001-000000000003', 'traffic_fine', 'Traffic Fine', '🚔', 2, 'MUST', 'EXPENSE', true, 6),
  (NULL, '00000000-0000-0000-0001-000000000003', 'vehicle_buy', 'Buy', '🚗', 2, NULL, 'EXPENSE', true, 7),
  (NULL, '00000000-0000-0000-0001-000000000003', 'vehicle_sell', 'Sell', '💵', 2, NULL, 'INCOME', true, 8),
  (NULL, '00000000-0000-0000-0001-000000000003', 'vehicle_maintenance', 'Maintenance', '🔧', 2, 'NEED', 'EXPENSE', true, 9),
  (NULL, '00000000-0000-0000-0001-000000000003', 'vehicle_other', 'Other', '🚗', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Shopping Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000004', 'clothes', 'Clothes', '👕', 2, 'NEED', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000004', 'electronics_appliances', 'Electronics & Appliances', '📱', 2, 'WANT', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000004', 'accessories', 'Accessories', '⌚', 2, 'WANT', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000004', 'footwear', 'Footwear', '👟', 2, 'NEED', 'EXPENSE', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000004', 'bags', 'Bags', '👜', 2, 'WANT', 'EXPENSE', true, 5),
  (NULL, '00000000-0000-0000-0001-000000000004', 'kids_baby', 'Kids & Baby', '👶', 2, 'NEED', 'EXPENSE', true, 6),
  (NULL, '00000000-0000-0000-0001-000000000004', 'beauty', 'Beauty', '💄', 2, 'WANT', 'EXPENSE', true, 7),
  (NULL, '00000000-0000-0000-0001-000000000004', 'home_garden', 'Home & Garden', '🏡', 2, 'WANT', 'EXPENSE', true, 8),
  (NULL, '00000000-0000-0000-0001-000000000004', 'pets', 'Pets', '🐕', 2, 'WANT', 'EXPENSE', true, 9),
  (NULL, '00000000-0000-0000-0001-000000000004', 'sports_fitness', 'Sports & Fitness', '🏃', 2, 'WANT', 'EXPENSE', true, 10),
  (NULL, '00000000-0000-0000-0001-000000000004', 'toys_games', 'Toys & Games', '🎮', 2, 'WANT', 'EXPENSE', true, 11),
  (NULL, '00000000-0000-0000-0001-000000000004', 'travel', 'Travel', '✈️', 2, 'WANT', 'EXPENSE', true, 12),
  (NULL, '00000000-0000-0000-0001-000000000004', 'wedding', 'Wedding', '💍', 2, 'WANT', 'EXPENSE', true, 13),
  (NULL, '00000000-0000-0000-0001-000000000004', 'detergents', 'Detergents', '🧹', 2, 'NEED', 'EXPENSE', true, 14),
  (NULL, '00000000-0000-0000-0001-000000000004', 'decorations', 'Decorations', '🎨', 2, 'WANT', 'EXPENSE', true, 15),
  (NULL, '00000000-0000-0000-0001-000000000004', 'shopping_other', 'Other', '🛍️', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Health & Medical Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000005', 'doctor', 'Doctor', '👨‍⚕️', 2, 'MUST', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000005', 'medicine', 'Medicine', '💊', 2, 'MUST', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000005', 'surgery', 'Surgery', '🏥', 2, 'MUST', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000005', 'dental', 'Dental', '🦷', 2, 'MUST', 'EXPENSE', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000005', 'health_other', 'Other', '🩺', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Utilities & Bills Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000006', 'electricity', 'Electricity', '⚡', 2, 'MUST', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000006', 'water', 'Water', '💧', 2, 'MUST', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000006', 'internet', 'Internet', '🌐', 2, 'NEED', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000006', 'phone', 'Phone', '📱', 2, 'NEED', 'EXPENSE', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000006', 'gas', 'Gas', '🔥', 2, 'MUST', 'EXPENSE', true, 5),
  (NULL, '00000000-0000-0000-0001-000000000006', 'trash', 'Trash', '🗑️', 2, 'MUST', 'EXPENSE', true, 6),
  (NULL, '00000000-0000-0000-0001-000000000006', 'online_subscription', 'Online Subscription', '📧', 2, 'WANT', 'EXPENSE', true, 7),
  (NULL, '00000000-0000-0000-0001-000000000006', 'streaming', 'Streaming', '📺', 2, 'WANT', 'EXPENSE', true, 8),
  (NULL, '00000000-0000-0000-0001-000000000006', 'taxes', 'Taxes', '📋', 2, 'MUST', 'EXPENSE', true, 9),
  (NULL, '00000000-0000-0000-0001-000000000006', 'utilities_other', 'Other', '📄', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Entertainment Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000007', 'trips_holidays', 'Trips & Holidays', '🏖️', 2, 'WANT', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000007', 'events', 'Events', '🎭', 2, 'WANT', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000007', 'tickets', 'Tickets', '🎟️', 2, 'WANT', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000007', 'entertainment_other', 'Other', '🎉', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Charity Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000008', 'donations', 'Donations', '🎁', 2, 'WANT', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000008', 'fundraising', 'Fundraising', '🤲', 2, 'WANT', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000008', 'charity_gifts', 'Gifts', '🎀', 2, 'WANT', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000008', 'charity_other', 'Other', '❤️', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Education Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000009', 'books', 'Books', '📖', 2, 'NEED', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000009', 'tuition', 'Tuition', '🎓', 2, 'MUST', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000009', 'education_fees', 'Fees', '💳', 2, 'MUST', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000009', 'education_other', 'Other', '📚', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Housing Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000010', 'rent', 'Rent', '🏠', 2, 'MUST', 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000010', 'housing_maintenance', 'Maintenance & Repairs', '🔧', 2, 'NEED', 'EXPENSE', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000010', 'housing_tax', 'Tax', '📋', 2, 'MUST', 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000010', 'housing_buy', 'Buy', '🏡', 2, NULL, 'EXPENSE', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000010', 'housing_sell', 'Sell', '💵', 2, NULL, 'INCOME', true, 5),
  (NULL, '00000000-0000-0000-0001-000000000010', 'housing_other', 'Other', '🏠', 2, NULL, 'EXPENSE', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Income Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000011', 'salary', 'Salary', '💵', 2, NULL, 'INCOME', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000011', 'bonus', 'Bonus', '🎉', 2, NULL, 'INCOME', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000011', 'commission', 'Commission', '💰', 2, NULL, 'INCOME', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000011', 'refund', 'Refund', '↩️', 2, NULL, 'INCOME', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000011', 'loan_income', 'Loan', '🏦', 2, NULL, 'INCOME', true, 5),
  (NULL, '00000000-0000-0000-0001-000000000011', 'gift_income', 'Gift', '🎁', 2, NULL, 'INCOME', true, 6),
  (NULL, '00000000-0000-0000-0001-000000000011', 'check', 'Check', '📝', 2, NULL, 'INCOME', true, 7),
  (NULL, '00000000-0000-0000-0001-000000000011', 'rental_income', 'Rental Income', '🏠', 2, NULL, 'INCOME', true, 8),
  (NULL, '00000000-0000-0000-0001-000000000011', 'income_other', 'Other', '💰', 2, NULL, 'INCOME', true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Debt / Loans Subcategories
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000012', 'lent_money', 'Lent Money', '💸', 2, NULL, 'EXPENSE', true, 1),
  (NULL, '00000000-0000-0000-0001-000000000012', 'borrowed_money', 'Borrowed Money', '💰', 2, NULL, 'INCOME', true, 2),
  (NULL, '00000000-0000-0000-0001-000000000012', 'debt_repayment_paid', 'Debt Repayment (Paid)', '✅', 2, NULL, 'EXPENSE', true, 3),
  (NULL, '00000000-0000-0000-0001-000000000012', 'debt_repayment_received', 'Debt Repayment (Received)', '📥', 2, NULL, 'INCOME', true, 4),
  (NULL, '00000000-0000-0000-0001-000000000012', 'debt_other', 'Other', '🤝', 2, NULL, NULL, true, 99)
ON CONFLICT DO NOTHING;

-- Level 2: Other (Fallback) Subcategory
INSERT INTO public.categories (user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, sort_order) VALUES
  (NULL, '00000000-0000-0000-0001-000000000013', 'uncategorized', 'Other', '❓', 2, NULL, 'EXPENSE', true, 1)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
