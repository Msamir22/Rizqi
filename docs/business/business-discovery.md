# Astik - Business Logic & Architecture Discovery

> **Status:** 🟡 In Discussion  
> **Last Updated:** 2026-01-01  
> **Purpose:** Business discovery questions to guide schema design
>
> **📋 See Also:** [business-decisions.md](./business-decisions.md) - Finalized
> confirmed decisions

---

## 1. Current State Summary

### Existing Models (WatermelonDB) - TO BE REPLACED

| Model           | Status            | Reason                                                   |
| --------------- | ----------------- | -------------------------------------------------------- |
| **Account**     | ⚠️ Needs redesign | Merging GOLD into Assets domain, separating bank_details |
| **Transaction** | ⚠️ Needs review   | Confirm fields after Transactions section                |

### Existing Supabase Tables

| Table            | Status  | Notes                                 |
| ---------------- | ------- | ------------------------------------- |
| **market_rates** | ✅ Keep | Add `market_rates_history` for trends |

---

## 2. Confirmed Sections

### ✅ 2.1 User & Authentication (COMPLETE)

See [business-decisions.md](./business-decisions.md#1-user--authentication)

**Summary:**

- Email/Password + Google login
- Supabase Anonymous Auth for guest mode
- Sign-up prompt after 5 transactions
- "Ghost User" pattern - data syncs before sign-up

---

### ✅ 2.2 Accounts & Assets (COMPLETE)

See [business-decisions.md](./business-decisions.md#2-database-architecture)

**Summary:**

- Supertype/Subtype pattern
- **Accounts Domain:** `accounts` + `bank_details` (for SMS parsing)
- **Assets Domain:** `assets` + `asset_metals` (weight × price valuation)
- Daily snapshots: `daily_snapshot_balance`, `daily_snapshot_assets`

---

## 3. Remaining Questions

### 3.1 Transactions

**Q1: Transaction Categories**

- Should categories be predefined (dropdown) or user-defined (free text)?
- If predefined, what categories do you want?

  _Suggested list:_
  - Food & Dining
  - Transport
  - Shopping
  - Utilities & Bills
  - Entertainment
  - Health & Medical
  - Education
  - Housing & Rent
  - Salary / Income
  - Gifts
  - Other

**Q2: Transaction Types** Since we now have separate Account and Asset domains:

- Transactions only affect `accounts` (spendable money), correct?
- When buying gold, should it create a transaction (expense from account) AND
  create an asset entry? Or is this handled manually?

**Q3: Transfer Between Accounts**

- Is a "transfer" just moving money between your own accounts? (e.g., Bank →
  Cash)
- How should it be stored?
  - **Option A:** Two transactions (expense from source + income to destination)
  - **Option B:** Single "transfer" record with `from_account_id` and
    `to_account_id`

**Q4: Loans & Debt** The current Transaction model has `loan` and `borrow` types
(from voice parsing).

- Should we track WHO you lent money to or borrowed from?
- Do you want a separate `debts` table to track outstanding balances?

**Q5: Recurring Transactions**

- Do you want recurring transaction support? (e.g., monthly rent, subscriptions)
- If yes:
  - Should they auto-create on due date?
  - Or just send a reminder notification?

---

### 3.2 Total Balance & Net Worth

**Q6: Net Worth Calculation** Net Worth = Total Accounts (EGP) + Total Assets
(EGP)

For the dashboard "Total Net Worth" card:

- Should this be calculated on-the-fly? Or stored in a summary table?
- The monthly percentage change: Compare with which snapshot?
  - Yesterday?
  - 30 days ago?
  - Same day last month?

**Q7: Emergency Fund Calculation** You mentioned `is_liquid` flag on assets.
Should we show:

- "Emergency Fund Available" = Liquid accounts + Liquid assets?
- Is this a future feature or needed now?

---

### 3.3 Budgets

**Q8: Budget Scope**

- Category-based budgets only? (e.g., "Food: EGP 5000/month")
- Global budget? ("Total spending: EGP 20,000/month")
- Or both?

**Q9: Budget Period**

- Monthly only?
- Weekly option?
- Custom date range?

**Q10: Budget Alerts**

- At what percentage should we alert? (80%? 90%? Custom?)
- How many alerts per budget cycle?

---

### 3.4 Metals/Gold

**Q11: Gold Transactions** When a user buys or sells physical gold:

- Do they just add/remove an asset entry manually?
- Or should buying gold automatically:
  1. Deduct from a selected account (expense transaction)
  2. Create the asset entry with purchase_price

**Q12: Gold Purity Pricing** Different karats have different prices. How to
handle?

- 24K: 100% of market price
- 21K: ~87.5% of market price
- 18K: 75% of market price

Should we calculate this automatically using the formula:
`value = weight_grams × (karat / 24) × gold_price_per_gram`

---

### 3.5 Notifications

**Q13: Transaction Confirmation**

- Show notification after every saved transaction?
- Or only voice/auto-detected transactions?

**Q14: Low Balance Warning**

- Alert when an account goes below a threshold?
- User-configurable threshold per account?

---

### 3.6 Data Sync Details

**Q15: Multi-Device Conflict** If user logs in on two devices and both make
changes offline:

- **Last write wins?** (simpler, potential data loss)
- **Merge both changes?** (complex but safer)

**Q16: Sync Tables** Which tables should sync between WatermelonDB and Supabase?

- ✅ accounts
- ✅ bank_details
- ✅ transactions
- ✅ assets
- ✅ asset_metals
- ❓ budgets (when implemented)
- ❌ market_rates (read-only from API)
- ❌ daily*snapshot*\* (server-generated)

---

## 4. New Questions (From Your Answers)

These arose from analyzing your responses:

**Q17: Digital Wallet Type** You mentioned `'DIGITAL_WALLET'` as an account
type.

- Examples: Vodafone Cash, Orange Money, InstaPay, PayPal?
- Do digital wallets need extra fields like phone number or wallet ID?

**Q18: SMS Sender Name** You mentioned SMS auto-detection feature.

- Should `bank_details` include `sms_sender_name` column?
- Examples: "AhlyBank", "CIB", "HSBC"

**Q19: User Profile Data** For the greeting "Good Morning, Mohamed":

- Where should the user's name come from?
  - From Google profile during social login?
  - User enters manually during sign-up?
  - Should we have a `profiles` table?

---

## 5. Visual: Complete Data Model (Draft)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              auth.users (Supabase)                          │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
    │  accounts   │          │   assets    │          │  profiles?  │
    │             │          │             │          │  (TBD)      │
    │ CASH/BANK/  │          │ METAL/CRYPTO│          │             │
    │ WALLET      │          │ /REAL_ESTATE│          └─────────────┘
    └──────┬──────┘          └──────┬──────┘
           │                        │
           │ type = 'BANK'          │ type = 'METAL'
           ▼                        ▼
    ┌─────────────┐          ┌─────────────┐
    │ bank_details│          │asset_metals │
    └─────────────┘          └─────────────┘
           │
           │ account_id
           ▼
    ┌─────────────┐
    │transactions │
    └─────────────┘
```

---

## 6. Next Steps

1. ⏳ Answer remaining questions (3.1 - 3.6, 4.x)
2. ⏳ Finalize complete schema
3. ⏳ Review WatermelonDB model updates
4. ⏳ Proceed to implementation
