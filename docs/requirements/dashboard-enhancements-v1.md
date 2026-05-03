# Dashboard Screen Enhancements - Business Requirements

> **Document Version:** 1.0  
> **Date:** 2025-01-01  
> **Status:** Approved

---

## 1. Executive Summary

This document outlines the business requirements for enhancing the Monyvi mobile
app's Dashboard screen. The enhancements focus on improving user experience
through quick action accessibility, real data integration, and local
notification support.

---

## 2. Quick Actions Design

### 2.1 Core Principle

The central microphone button serves as the app's primary feature - **one-tap
voice transaction recording**. Users expect immediate voice input when tapping
this button. Quick actions should NOT interfere with this core functionality.

### 2.2 Quick Action Button (FAB)

| Property     | Specification                            |
| ------------ | ---------------------------------------- |
| **Position** | Right side of screen, above tab bar      |
| **Icon**     | Plus (+) icon                            |
| **Label**    | "Add Transaction" displayed below button |
| **Trigger**  | Single tap to expand actions             |

### 2.3 Quick Action Menu Items

When the FAB is tapped, action buttons animate (fan out from right to left):

| Order | Action          | Icon          | Destination        |
| ----- | --------------- | ------------- | ------------------ |
| 1     | Add Transaction | Plus circle   | `/add-transaction` |
| 2     | Add Account     | Wallet        | `/add-account`     |
| 3     | Add Metals      | Coins/Bars    | `/metals`          |
| 4     | Transfer        | Arrows (swap) | `/transfer` (TBD)  |
| 5     | Budgets         | Pie chart     | `/budgets` (TBD)   |

### 2.4 Animation Specification

- **Type:** Spring animation
- **Direction:** Right to left expansion (fan pattern)
- **Duration:** ~300ms with spring bounce
- **Close behavior:** Tap outside, tap FAB again, or select an action

---

## 3. Data Integration Requirements

### 3.1 Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  WatermelonDB    │    │   Supabase       │              │
│  │  (Offline-First) │────│   (Synced Data)  │              │
│  └────────┬─────────┘    └────────┬─────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌────────────────────────────────────────────┐            │
│  │           Dashboard Screen                  │            │
│  │  • Total Balance    • Live Rates           │            │
│  │  • Accounts/Assets  • Recent Transactions  │            │
│  └────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

| User State        | Data Source               | Sync Behavior       |
| ----------------- | ------------------------- | ------------------- |
| **Not signed in** | WatermelonDB (local only) | No sync             |
| **Signed in**     | WatermelonDB → Supabase   | Bi-directional sync |

### 3.3 Account Migration

When a user creates an account:

1. All local WatermelonDB data is uploaded to Supabase
2. Local data is marked as synced
3. Future operations sync to Supabase in real-time

---

## 4. Live Rates Integration

### 4.1 API Provider

| Property             | Value                              |
| -------------------- | ---------------------------------- |
| **Provider**         | Metals-API (metals.dev)            |
| **Endpoint**         | `https://api.metals.dev/v1/latest` |
| **Update Frequency** | Every 30 minutes                   |
| **Currency**         | EGP (Egyptian Pound)               |
| **Unit**             | Grams (g)                          |

### 4.2 Data Points to Display

| Rate     | Display Format | Source Field     |
| -------- | -------------- | ---------------- |
| Gold 24K | EGP X,XXX/g    | `metals.gold`    |
| Silver   | EGP XX/g       | `metals.silver`  |
| USD/EGP  | XX.XX          | `currencies.USD` |

### 4.3 Architecture

```
┌───────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Metals API   │────▶│  Supabase Edge Fn   │────▶│  market_rates   │
│ (metals.dev)  │     │  (fetch-rates)      │     │  (postgres)     │
└───────────────┘     └─────────────────────┘     └────────┬────────┘
                                                           │
                      ┌────────────────────────────────────┘
                      ▼
              ┌───────────────┐
              │  Mobile App   │
              │  (Dashboard)  │
              └───────────────┘
```

### 4.4 Edge Function Requirements

- **Name:** `fetch-metal-rates`
- **Trigger:** Scheduled (cron) every 30 minutes
- **Actions:**
  1. Call Metals API with API key
  2. Parse response for gold, silver, and currency rates
  3. Upsert into `market_rates` table
  4. Return success/error response

### 4.5 Database Schema

The `market_rates` table already exists with the following structure:

| Column       | Type         | Description              |
| ------------ | ------------ | ------------------------ |
| `id`         | INTEGER (PK) | Always 1 (single row)    |
| `metals`     | JSONB        | Metal prices in EGP/gram |
| `currencies` | JSONB        | Currency exchange rates  |
| `timestamp`  | TIMESTAMPTZ  | API response timestamp   |
| `updated_at` | TIMESTAMPTZ  | Last database update     |

---

## 5. Dashboard Components

### 5.1 Total Balance Card

| Field              | Data Source         | Calculation                              |
| ------------------ | ------------------- | ---------------------------------------- |
| **Total EGP**      | Sum of all accounts | `SUM(accounts.balance)` converted to EGP |
| **Total USD**      | Calculated          | `totalEgp / currencies.USD`              |
| **Monthly Change** | Calculated          | Compare with 30-day-ago snapshot         |

**Multi-Currency Handling:**

- EGP accounts: Use balance directly
- USD accounts: Convert using `currencies.USD` rate
- XAU (Gold) accounts: Convert using `metals.gold` rate

### 5.2 Accounts & Assets Carousel

**Slide 1 - Account Cards:**

| Field        | Data Source                                 |
| ------------ | ------------------------------------------- |
| Account Name | `accounts.name`                             |
| Account Type | `accounts.type` (CASH/BANK/DIGITAL_WALLET)  |
| Balance      | `accounts.balance` with `accounts.currency` |

> **Note:** Gold/metals are now tracked in the `assets` table, not `accounts`.

**Slide 2 - Asset Distribution:**

| Asset Type | Calculation                            |
| ---------- | -------------------------------------- |
| Bank       | Sum of BANK accounts / Total           |
| Cash       | Sum of CASH accounts / Total           |
| E-Wallet   | Sum of DIGITAL_WALLET accounts / Total |

### 5.3 Recent Transactions

| Field                | Data Source                                       |
| -------------------- | ------------------------------------------------- |
| Merchant/Description | `transactions.merchant` or `transactions.note`    |
| Date                 | `transactions.date` formatted                     |
| Amount               | `transactions.amount` (always positive)           |
| Type                 | `transactions.type` (EXPENSE/INCOME)              |
| Category Icon        | Derived from `categories` table via `category_id` |

**Display:** Last 5 transactions, ordered by `date DESC`

---

## 6. Local Notifications

### 6.1 Notification Types

| Type                         | Trigger                             | Message Example                              |
| ---------------------------- | ----------------------------------- | -------------------------------------------- |
| **Transaction Confirmation** | After successful voice/manual entry | "✅ EGP 450 expense saved to Coffee Shop"    |
| **Budget Alert**             | When spending exceeds threshold     | "⚠️ You've spent 80% of your Food budget"    |
| **Reminder**                 | Scheduled by user                   | "📝 Don't forget to log your daily expenses" |

### 6.2 Implementation

- **Library:** `expo-notifications` for local notifications
- **Permissions:** Request notification permission on first app launch
- **Storage:** Notification preferences stored in WatermelonDB

---

## 7. Security & Privacy

### 7.1 API Key Storage

| Key               | Storage Location               |
| ----------------- | ------------------------------ |
| Metals API Key    | Supabase Edge Function secrets |
| Supabase Anon Key | Mobile app `.env` file         |

### 7.2 Data Protection

- All local data is stored in WatermelonDB (SQLite encrypted)
- Supabase RLS policies restrict data access
- No direct API calls from mobile to third-party services

---

## 8. Out of Scope (Future Phases)

- Push notifications (requires backend integration)
- Transfer feature (UI placeholder only)
- Budgets feature (UI placeholder only)
- Data export functionality
- Multi-user sync

---

## 9. Success Metrics

| Metric                      | Target                          |
| --------------------------- | ------------------------------- |
| Quick action discovery rate | >50% of users within first week |
| Dashboard data accuracy     | 100% match with database        |
| Rate update reliability     | 99.9% uptime                    |
| Notification delivery       | <1s from trigger to display     |

---

## 10. Appendix

### A. Metals API Response Sample

```json
{
  "status": "success",
  "currency": "EGP",
  "unit": "g",
  "metals": {
    "gold": 6616.7928,
    "silver": 109.5179
  },
  "currencies": {
    "USD": 47.69613889,
    "EUR": 56.02911991
  },
  "timestamps": {
    "metal": "2025-12-31T21:52:03.473Z",
    "currency": "2025-12-31T21:51:09.425Z"
  }
}
```

### B. WatermelonDB Schema Reference

**Accounts Table (`accounts`):**

| Column     | Description                      |
| ---------- | -------------------------------- |
| `id`       | UUID Primary Key                 |
| `user_id`  | FK to user                       |
| `name`     | User-defined name                |
| `type`     | `CASH`, `BANK`, `DIGITAL_WALLET` |
| `balance`  | Current balance (decimal)        |
| `currency` | `EGP`, `USD`, `EUR`              |
| `deleted`  | Soft delete flag for sync        |

> **Note:** Bank details (card_last_4, bank_name) are now in separate
> `bank_details` table.

**Transactions Table (`transactions`):**

| Column        | Description                        |
| ------------- | ---------------------------------- |
| `id`          | UUID Primary Key                   |
| `user_id`     | FK to user                         |
| `account_id`  | FK to accounts                     |
| `amount`      | Always positive (decimal)          |
| `currency`    | `EGP`, `USD`, `EUR`                |
| `type`        | `EXPENSE`, `INCOME`                |
| `category_id` | FK to categories table             |
| `merchant`    | Optional merchant name             |
| `note`        | Optional user note                 |
| `date`        | Transaction date                   |
| `source`      | `MANUAL`, `VOICE`, `SMS`           |
| `is_draft`    | Draft flag for unconfirmed entries |
| `deleted`     | Soft delete flag for sync          |

**Categories Table (`categories`):**

| Column         | Description                            |
| -------------- | -------------------------------------- |
| `id`           | UUID Primary Key                       |
| `system_name`  | e.g., `food`, `transport`              |
| `display_name` | e.g., "Food & Dining"                  |
| `icon`         | Icon name (e.g., `fast-food`)          |
| `color`        | Hex color for UI                       |
| `type`         | `EXPENSE`, `INCOME`                    |
| `is_system`    | Boolean - system categories are locked |
