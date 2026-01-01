# Astik - Finalized Business Decisions

> **Status:** 🟢 Confirmed  
> **Last Updated:** 2026-01-01  
> **Purpose:** Single source of truth for all confirmed business decisions

---

## 1. User & Authentication

### 1.1 Authentication Methods

| Method              | Status         |
| ------------------- | -------------- |
| Email/Password      | ✅ Enabled     |
| Google Social Login | ✅ Enabled     |
| Apple Social Login  | ❌ Not planned |
| Phone OTP           | ❌ Not planned |

### 1.2 Guest Mode (Anonymous Authentication)

**Implementation:** Supabase Anonymous Authentication with WatermelonDB
offline-first

**Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. FIRST APP LAUNCH                                                    │
│     └─→ signInAnonymously() → Supabase creates "Ghost ID" (user_123)    │
│                                                                          │
│  2. USER ADDS DATA                                                       │
│     └─→ Saved to WatermelonDB (instant) → Syncs to Supabase (background)│
│                                                                          │
│  3. SIGN-UP PROMPT                                                       │
│     └─→ Triggered after 5 transactions                                  │
│     └─→ User can continue indefinitely without signing up               │
│                                                                          │
│  4. ACCOUNT CONVERSION                                                   │
│     └─→ updateUser({ email, password }) → Attaches credentials          │
│     └─→ NO data migration needed (same user_id)                         │
│                                                                          │
│  5. DEVICE LOSS (Guest)                                                  │
│     └─→ Data exists in Supabase but ACCESS IS LOST (no credentials)     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 User Profile Fields

| Field        | Required              | Notes                         |
| ------------ | --------------------- | ----------------------------- |
| `id` (UUID)  | ✅                    | Supabase auth.users           |
| `email`      | Only after conversion | Anonymous users have no email |
| `name`       | 🟡 TBD                | Display name for greeting     |
| `avatar_url` | 🟡 TBD                | From Google profile?          |

---

## 2. Database Architecture

### 2.1 Design Pattern

**Supertype/Subtype (Polymorphic) Pattern**

Separates data into two distinct domains:

- **Accounts Domain:** Liquid, spendable money (transactions flow here)
- **Assets Domain:** Investments, net worth tracking (value calculated from
  market rates)

### 2.2 Accounts Domain (Spendable Money)

#### Table: `accounts`

Parent table for all liquid money containers.

| Column       | Type        | Required | Description                                  |
| ------------ | ----------- | -------- | -------------------------------------------- |
| `id`         | UUID        | ✅       | Primary Key                                  |
| `user_id`    | UUID        | ✅       | FK → auth.users                              |
| `name`       | TEXT        | ✅       | User-defined name (e.g., "Main CIB Account") |
| `type`       | ENUM        | ✅       | `'CASH'`, `'BANK'`, `'DIGITAL_WALLET'`       |
| `balance`    | DECIMAL     | ✅       | Current available money                      |
| `currency`   | CHAR(3)     | ✅       | ISO code: `'EGP'`, `'USD'`, `'EUR'`          |
| `created_at` | TIMESTAMPTZ | ✅       | Auto-generated                               |
| `updated_at` | TIMESTAMPTZ | ✅       | For WatermelonDB sync                        |
| `deleted`    | BOOLEAN     | ✅       | Soft delete for sync (default: false)        |

**Business Rules:**

- One account = one currency
- Same name can exist with different currencies (e.g., "CIB USD", "CIB EGP")
- Balance updated automatically when transactions are added

#### Table: `bank_details`

Child table for accounts where `type = 'BANK'`. 1-to-Many (one bank account can
have multiple cards).

| Column            | Type        | Required | Description                            |
| ----------------- | ----------- | -------- | -------------------------------------- |
| `id`              | UUID        | ✅       | Primary Key                            |
| `account_id`      | UUID        | ✅       | FK → accounts.id                       |
| `bank_name`       | TEXT        | ✅       | e.g., "HSBC", "National Bank of Egypt" |
| `card_last_4`     | VARCHAR(4)  | ✅       | For SMS auto-detection                 |
| `sms_sender_name` | TEXT        | ❓       | e.g., "AhlyBank" (for SMS parsing)     |
| `account_number`  | TEXT        | ❌       | Optional IBAN                          |
| `created_at`      | TIMESTAMPTZ | ✅       | Auto-generated                         |

### 2.3 Assets Domain (Wealth & Investments)

#### Table: `assets`

Parent table for all investment holdings.

| Column           | Type        | Required | Description                                  |
| ---------------- | ----------- | -------- | -------------------------------------------- |
| `id`             | UUID        | ✅       | Primary Key                                  |
| `user_id`        | UUID        | ✅       | FK → auth.users                              |
| `name`           | TEXT        | ✅       | User-defined name (e.g., "My Wedding Gold")  |
| `type`           | ENUM        | ✅       | `'METAL'`, `'CRYPTO'`, `'REAL_ESTATE'`       |
| `is_liquid`      | BOOLEAN     | ✅       | Can be sold instantly? (emergency fund calc) |
| `purchase_price` | DECIMAL     | ✅       | Cost basis (total paid)                      |
| `purchase_date`  | DATE        | ✅       | When acquired                                |
| `currency`       | CHAR(3)     | ✅       | Currency used to purchase                    |
| `notes`          | TEXT        | ❌       | Optional user notes                          |
| `created_at`     | TIMESTAMPTZ | ✅       | Auto-generated                               |
| `updated_at`     | TIMESTAMPTZ | ✅       | For WatermelonDB sync                        |
| `deleted`        | BOOLEAN     | ✅       | Soft delete for sync                         |

**Note:** `current_value` is NOT stored. It's calculated:

- Metals: `weight_grams * live_market_rate`
- Crypto: 🟡 TBD (future)
- Real Estate: 🟡 TBD (future, possibly manual entry)

#### Table: `asset_metals`

Child table for assets where `type = 'METAL'`.

| Column         | Type        | Required | Description                        |
| -------------- | ----------- | -------- | ---------------------------------- |
| `id`           | UUID        | ✅       | Primary Key                        |
| `asset_id`     | UUID        | ✅       | FK → assets.id                     |
| `metal_type`   | ENUM        | ✅       | `'GOLD'`, `'SILVER'`, `'PLATINUM'` |
| `weight_grams` | DECIMAL     | ✅       | Physical weight                    |
| `purity_karat` | SMALLINT    | ✅       | 24 for pure gold, 21, 18, etc.     |
| `item_form`    | TEXT        | ❌       | "Coin", "Bar", "Jewelry"           |
| `created_at`   | TIMESTAMPTZ | ✅       | Auto-generated                     |

**Valuation Formula:**
`current_value = weight_grams * (purity_karat / 24) * live_gold_price_per_gram`

### 2.4 Historical Snapshots

#### Table: `daily_snapshot_balance`

Stores end-of-day account balances for charts and trends.

| Column               | Type        | Description                          |
| -------------------- | ----------- | ------------------------------------ |
| `id`                 | UUID        | Primary Key                          |
| `user_id`            | UUID        | FK → auth.users                      |
| `snapshot_date`      | DATE        | The date of snapshot                 |
| `total_accounts_egp` | DECIMAL     | Sum of all accounts converted to EGP |
| `breakdown`          | JSONB       | Per-account breakdown                |
| `created_at`         | TIMESTAMPTZ | Auto-generated                       |

**Trigger:** Daily at 11 PM

#### Table: `daily_snapshot_assets`

Stores end-of-day asset valuations.

| Column             | Type        | Description                        |
| ------------------ | ----------- | ---------------------------------- |
| `id`               | UUID        | Primary Key                        |
| `user_id`          | UUID        | FK → auth.users                    |
| `snapshot_date`    | DATE        | The date of snapshot               |
| `total_assets_egp` | DECIMAL     | Sum of all assets converted to EGP |
| `breakdown`        | JSONB       | Per-asset breakdown with values    |
| `created_at`       | TIMESTAMPTZ | Auto-generated                     |

**Trigger:** Daily at 11 PM

### 2.5 Market Rates

#### Table: `market_rates` (existing)

Current live rates (single row, updated every 30 mins).

#### Table: `market_rates_history` (new)

Historical rates for trend calculation.

| Column                | Type        | Description                |
| --------------------- | ----------- | -------------------------- |
| `id`                  | UUID        | Primary Key                |
| `snapshot_date`       | DATE        | Unique per day             |
| `gold_egp_per_gram`   | DECIMAL     | Gold price at end of day   |
| `silver_egp_per_gram` | DECIMAL     | Silver price at end of day |
| `usd_egp`             | DECIMAL     | USD/EGP rate               |
| `eur_egp`             | DECIMAL     | EUR/EGP rate               |
| `created_at`          | TIMESTAMPTZ | Auto-generated             |

**Trigger:** Daily at 11 PM

---

## 3. Multi-Currency Handling

| Scenario                        | Behavior                                                 |
| ------------------------------- | -------------------------------------------------------- |
| One bank, multiple currencies   | Create separate account per currency (same name allowed) |
| Transaction in foreign currency | Transaction stored in account's currency                 |
| Total balance display           | Convert all to EGP using live rates                      |
| Supported currencies            | EGP, USD, EUR                                            |

---

## 4. Sync Strategy

### 4.1 Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │ ←───│ WatermelonDB│ ←───│   Supabase  │
│   (UI)      │     │  (Local)    │     │   (Cloud)   │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          │ push_changes() / pull_changes()
                          ▼
                    ┌─────────────┐
                    │  Supabase   │
                    │    RPC      │
                    └─────────────┘
```

### 4.2 Sync Columns (All Tables)

- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted` (BOOLEAN, default false)
- `user_id` (UUID, set from auth.uid())

### 4.3 RLS Policies

All tables: `user_id = auth.uid()` for SELECT, INSERT, UPDATE, DELETE

---

## 5. Pending Questions (Section 2.3+)

See `business-discovery.md` for remaining questions about:

- Transactions (categories, types, recurring)
- Budgets
- Transfers
- Notifications
- And more...
