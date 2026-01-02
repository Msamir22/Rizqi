# Astik - Business Logic & Architecture Discovery

> **Status:** 🟡 In Discussion  
> **Last Updated:** 2026-01-02  
> **Purpose:** Business discovery questions to guide schema design
>
> **📋 See Also:** [business-decisions.md](./business-decisions.md) - Finalized
> confirmed decisions

---

## 1. Current State Summary

### Existing Models (WatermelonDB) - TO BE REPLACED

| Model           | Status            | Reason                                                        |
| --------------- | ----------------- | ------------------------------------------------------------- |
| **Account**     | ⚠️ Needs redesign | Merging GOLD into Assets domain, separating bank_details      |
| **Transaction** | ⚠️ Needs redesign | New schema finalized in [Section 11](./business-decisions.md) |

### Existing Supabase Tables

| Table            | Status  | Notes                                 |
| ---------------- | ------- | ------------------------------------- |
| **market_rates** | ✅ Keep | Add `market_rates_history` for trends |

---

## 2. Confirmed Sections

### ✅ 2.1 User & Authentication (COMPLETE)

See
[business-decisions.md - Section 1](./business-decisions.md#1-user--authentication)

---

### ✅ 2.2 Accounts & Assets (COMPLETE)

See
[business-decisions.md - Section 2](./business-decisions.md#2-database-architecture)

---

### ✅ 2.3 Transaction Categories (COMPLETE)

See
[business-decisions.md - Section 5](./business-decisions.md#5-transaction-categories)

---

### ✅ 2.4 Debts & Loans (COMPLETE)

See [business-decisions.md - Section 6](./business-decisions.md#6-debts--loans)

---

### ✅ 2.5 Recurring Payments (COMPLETE)

See
[business-decisions.md - Section 7](./business-decisions.md#7-recurring-payments)

---

### ✅ 2.6 Transfers (COMPLETE)

See [business-decisions.md - Section 8](./business-decisions.md#8-transfers)

**Decision:** Option B - Single `transfers` table with `from_account_id` and
`to_account_id`

---

### ✅ 2.7 Budgets (COMPLETE)

See [business-decisions.md - Section 9](./business-decisions.md#9-budgets)

**Decisions:**

- Scope: Both category and global budgets
- Period: Weekly, Monthly, or Custom
- Alert threshold: User-defined (custom percentage)

---

### ✅ 2.8 Net Worth & Dashboard (COMPLETE)

See
[business-decisions.md - Section 10](./business-decisions.md#10-net-worth--dashboard)

**Decisions:**

- Storage: Summary table (`user_net_worth_summary`)
- Monthly change: Compare with 30 days ago

---

### ✅ 2.9 Transaction Schema (COMPLETE)

See
[business-decisions.md - Section 11](./business-decisions.md#11-transaction-schema-consolidated)

**Please review the consolidated schema and confirm it meets all requirements.**
Confirmed

---

## 3. Remaining Questions

### 3.1 Metals/Gold

**Q11: Gold Transactions**

When a user buys or sells physical gold:

- Do they just add/remove an asset entry manually?
- Or should buying gold automatically:
  1. Deduct from a selected account (expense transaction)
  2. Create the asset entry with `purchase_price`

**Q12: Gold Purity Pricing**

Different karats have different prices. Confirm this formula:

```
value = weight_grams × (karat / 24) × gold_price_per_gram
```

- 24K: 100% of market price
- 21K: ~87.5% of market price
- 18K: 75% of market price

---

### 3.2 Notifications

**Q13: Transaction Confirmation**

- Show notification after every saved transaction?
- Or only for voice/auto-detected transactions?

**Q14: Low Balance Warning**

- Alert when an account goes below a threshold?
- User-configurable threshold per account?

---

### 3.3 Data Sync Details

**Q15: Multi-Device Conflict**

If user logs in on two devices and both make changes offline:

- **Last write wins?** (simpler, potential data loss)
- **Merge both changes?** (complex but safer)

**Q16: Sync Tables**

Which tables should sync between WatermelonDB and Supabase?

- ✅ accounts
- ✅ bank_details
- ✅ transactions
- ✅ assets
- ✅ asset_metals
- ✅ categories (user-created only)
- ✅ budgets
- ✅ debts
- ✅ recurring_payments
- ✅ transfers
- ❌ market_rates (read-only from API)
- ❌ daily_snapshot\_\* (server-generated)
- ❌ user_net_worth_summary (server-calculated)

---

### 3.4 Additional Questions

**Q17: Digital Wallet Type**

You mentioned `'DIGITAL_WALLET'` as an account type.

- Examples: Vodafone Cash, Orange Money, InstaPay, PayPal?
- Do digital wallets need extra fields like phone number or wallet ID?

**Q18: SMS Sender Name**

You mentioned SMS auto-detection feature.

- Should `bank_details` include `sms_sender_name` column?
- Examples: "AhlyBank", "CIB", "HSBC"

**Q19: User Profile Data**

For the greeting "Good Morning, Mohamed":

- Where should the user's name come from?
  - From Google profile during social login?
  - User enters manually during sign-up?
  - Should we have a `profiles` table?

---

### 3.5 Cross-Currency Transfers

**Q20: Transfer Between Different Currencies**

If transferring from USD account to EGP account:

- Should we store the exchange rate used?
- Should we store the converted amount in destination currency?
- Example: Transfer $100 → EGP 5,000 (at rate 50.00)

---

## 4. Schema Review Checklist

Before moving to implementation, please confirm these consolidated schemas:

| Table                    | Section                                             | Status     |
| ------------------------ | --------------------------------------------------- | ---------- |
| `accounts`               | [2.2](./business-decisions.md#22-accounts-domain)   | ⏳ Confirm |
| `bank_details`           | [2.2](./business-decisions.md#22-accounts-domain)   | ⏳ Confirm |
| `assets`                 | [2.3](./business-decisions.md#23-assets-domain)     | ⏳ Confirm |
| `asset_metals`           | [2.3](./business-decisions.md#23-assets-domain)     | ⏳ Confirm |
| `transactions`           | [11](./business-decisions.md#11-transaction-schema) | ⏳ Confirm |
| `categories`             | [5.3](./business-decisions.md#53-table-categories)  | ⏳ Confirm |
| `user_category_settings` | [5.4](./business-decisions.md#54-table)             | ⏳ Confirm |
| `debts`                  | [6.2](./business-decisions.md#62-table-debts)       | ⏳ Confirm |
| `recurring_payments`     | [7.2](./business-decisions.md#72-table)             | ⏳ Confirm |
| `transfers`              | [8.2](./business-decisions.md#82-table-transfers)   | ⏳ Confirm |
| `budgets`                | [9.2](./business-decisions.md#92-table-budgets)     | ⏳ Confirm |
| `user_net_worth_summary` | [10.2](./business-decisions.md#102-storage)         | ⏳ Confirm |
| `daily_snapshot_balance` | [2.4](./business-decisions.md#24-historical)        | ⏳ Confirm |
| `daily_snapshot_assets`  | [2.4](./business-decisions.md#24-historical)        | ⏳ Confirm |
| `market_rates_history`   | [2.5](./business-decisions.md#25-market-rates)      | ⏳ Confirm |

---

## 5. Visual: Complete Data Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              auth.users (Supabase)                          │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
     ┌───────────────┬───────────────┼───────────────┬───────────────┐
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌──────────────┐   ┌─────────┐   ┌─────────────┐
│accounts │   │ assets  │   │ transactions │   │ budgets │   │   debts     │
└────┬────┘   └────┬────┘   └──────────────┘   └─────────┘   └─────────────┘
     │             │               ▲
     │             │               │
     ▼             ▼               │ linked_recurring_id
┌─────────────┐ ┌─────────────┐   │
│bank_details │ │asset_metals │   │
└─────────────┘ └─────────────┘   │
                                  │
                          ┌───────────────────┐
                          │recurring_payments │
                          └───────────────────┘

     ┌───────────────┐   ┌───────────────────────┐
     │   transfers   │   │ user_net_worth_summary│
     └───────────────┘   └───────────────────────┘

     ┌───────────────┐   ┌───────────────────────┐
     │  categories   │   │ user_category_settings│
     └───────────────┘   └───────────────────────┘
```

---

## 6. Next Steps

1. ⏳ Answer remaining questions (Q11-Q20)
2. ⏳ Review and confirm schema checklist (Section 4)
3. ⏳ Finalize complete SQL migration
4. ⏳ Update WatermelonDB models
5. ⏳ Proceed to implementation
