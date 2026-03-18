# Data Model: Dashboard & UI Polish (017)

**Feature**: 017-dashboard-ui-polish  
**Date**: 2026-03-18

## Entities

### No Schema Changes Required

This feature operates entirely on existing tables and models. No Supabase
migrations or WatermelonDB schema changes are needed.

---

### Profile (existing — read only)

| Field               | Type           | Notes                                    |
| ------------------- | -------------- | ---------------------------------------- |
| `firstName`         | string \| null | From `first_name` column                 |
| `lastName`          | string \| null | From `last_name` column                  |
| `displayName`       | string \| null | From `display_name` column               |
| `avatarUrl`         | string \| null | From `avatar_url` column                 |
| `preferredCurrency` | CurrencyType   | Used for equivalent display (Issue #104) |

**Computed**: `fullName` getter on `Profile` model (firstName + lastName, falls
back to displayName)

---

### Transaction (existing — read only for this feature)

| Field      | Type            | Notes                                  |
| ---------- | --------------- | -------------------------------------- |
| `amount`   | number          | Transaction amount in `currency`       |
| `currency` | CurrencyType    | Transaction's native currency          |
| `date`     | Date            | Used to look up historical market rate |
| `type`     | TransactionType | INCOME or EXPENSE                      |

---

### MarketRate (existing — read only)

| Field       | Type   | Notes                                            |
| ----------- | ------ | ------------------------------------------------ |
| `createdAt` | Date   | Snapshot date — used for historical lookups      |
| `*Usd`      | number | Per-currency USD rate (e.g., `egpUsd`, `sarUsd`) |

**Method**: `getRate(from, to)` — cross-currency conversion via USD base

---

### RecurringPayment (existing — read only for this feature)

| Field         | Type            | Notes                           |
| ------------- | --------------- | ------------------------------- |
| `nextDueDate` | Date            | Used for period-based filtering |
| `amount`      | number          | Payment amount                  |
| `currency`    | CurrencyType    | Payment currency                |
| `status`      | RecurringStatus | ACTIVE, PAUSED, COMPLETED       |
| `type`        | TransactionType | EXPENSE or INCOME               |

**Computed**: `isInThisMonth`, `daysUntilDue`, `isActive`, `isExpense`

## Relationships for This Feature

```
Profile ──(provides)──▶ Drawer (name, avatar, email via AuthContext)
    │
    └──(provides preferredCurrency)──▶ Transaction Card (equivalent display)

MarketRate ──(historical lookup by transaction.date)──▶ Transaction Card

RecurringPayment ──(filtered by nextDueDate range)──▶ UpcomingPayments
```
