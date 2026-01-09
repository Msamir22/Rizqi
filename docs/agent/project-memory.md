---
alwaysApply: true
---

# 🧠 Astik Project Memory

> **Last Updated:** 2026-01-06 **Purpose:** Persistent context for AI agents
> across conversations

---

## 1. Project Overview

**Astik** is a personal finance mobile app designed for the Egyptian market. It
helps users track expenses, income, assets (especially gold), debts, and net
worth with an offline-first approach.

### Key Features

- 📱 Mobile app (React Native + Expo)
- 🔊 Voice transaction input
- 📨 SMS auto-detection for bank transactions
- 🪙 Gold/precious metals tracking with live rates
- 💳 Multi-currency support (EGP, USD, EUR)
- 📊 Net worth dashboard
- 🔄 Offline-first with cloud sync (WatermelonDB + Supabase)

### Target Users

- Egyptian users managing personal finances
- Gold investors wanting to track their holdings
- Users who want automatic transaction detection from bank SMS

---

## 2. Tech Stack

| Layer          | Technology                                 |
| -------------- | ------------------------------------------ |
| Mobile App     | React Native + Expo (managed workflow)     |
| Navigation     | Expo Router (file-based routing)           |
| Styling        | NativeWind (Tailwind CSS for React Native) |
| Local Database | WatermelonDB (SQLite-based, offline-first) |
| Cloud Database | Supabase (PostgreSQL + Auth + Realtime)    |
| Backend API    | Express.js (deployed on Vercel)            |
| Monorepo       | npm workspaces + Nx                        |
| Language       | TypeScript (strict mode)                   |
| Animation      | React Native Reanimated + Gesture Handler  |

---

## 3. Project Architecture

```
Astik/
├── apps/
│   ├── mobile/          # React Native Expo app
│   │   ├── app/         # Expo Router pages (file-based routing)
│   │   ├── components/  # UI components
│   │   ├── services/    # API calls, business logic
│   │   ├── hooks/       # Custom React hooks
│   │   └── assets/      # Images, fonts
│   │
│   └── api/             # Express.js backend
│       └── api/         # Serverless functions for Vercel
│
├── packages/
│   ├── db/              # WatermelonDB models & schema
│   │   ├── models/      # Account, Transaction, Category, etc.
│   │   └── schema/      # Database schema definitions
│   │
│   └── logic/           # Shared business logic
│       ├── voice-parser/     # Voice-to-transaction parsing
│       ├── notification-parser/  # SMS parsing
│       └── currency-utils/   # Currency conversion
│
├── docs/
│   ├── business/
│   │   ├── business-decisions.md  # 📌 IMPORTANT: All finalized business logic
│   │   └── business-discovery.md  # Discovery tracking
│   └── requirements/
│
└── supabase/            # Supabase migrations & config
```

---

## 4. Business Logic Summary

> 📋 **Full details:**
> [business-decisions.md](file:///e:/Work/My%20Projects/Astik/docs/business/business-decisions.md)

### 4.1 Authentication

- Email/password and Google sign-in enabled
- Guest mode with Supabase anonymous auth
- Data persists until user signs up (same user_id preserved)
- Sign-up prompt after 5 transactions

### 4.2 Database Schema (17 Tables)

| Domain       | Tables                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| User         | `profiles`                                                                  |
| Accounts     | `accounts`, `bank_details`                                                  |
| Assets       | `assets`, `asset_metals`                                                    |
| Transactions | `transactions`, `categories`, `user_category_settings`                      |
| Debts        | `debts`                                                                     |
| Recurring    | `recurring_payments`                                                        |
| Transfers    | `transfers`                                                                 |
| Budgets      | `budgets`                                                                   |
| Analytics    | `user_net_worth_summary`, `daily_snapshot_balance`, `daily_snapshot_assets` |
| Market       | `market_rates`, `market_rates_history`                                      |

### 4.3 Key Business Rules

1. **Accounts vs Assets**: Accounts = spendable money (transactions flow here),
   Assets = investments (value calculated from market rates)
2. **Categories**: 3-level hierarchy (L1 Main → L2 Sub → L3 User-defined),
   system categories are locked
3. **Transactions**: Always positive amount, type (EXPENSE/INCOME) determines
   direction
4. **Debts**: Track lent/borrowed money, linked to transactions, support
   installment payments
5. **Transfers**: Move money between own accounts (not transactions, separate
   table)
6. **Multi-currency**: One account = one currency, display totals in EGP using
   live rates
7. **Gold valuation**: `current_value = weight × (purity/24) × live_gold_price`
8. **Sync**: WatermelonDB ↔ Supabase with Last Write Wins conflict resolution

### 4.4 Categories Structure

**Main Categories (L1):** Food & Drinks, Transportation, Vehicle, Shopping,
Health & Medical, Utilities & Bills, Entertainment, Charity, Education, Housing,
Salary/Income, Debt/Loans, Other

**Internal (Hidden) Categories:** `asset_purchase`, `asset_sale` (auto-created
for asset transactions)

---

## 5. Current Project Status

### ✅ Completed

- [x] Monorepo structure (npm workspaces + Nx)
- [x] Express.js API with rates endpoints
- [x] WatermelonDB schema and models
- [x] All business logic decisions finalized (17 tables)
- [x] Category seeding on app launch
- [x] Dashboard UI (light/dark mode)
- [x] Custom bottom tab bar with animations
- [x] RecentTransactions component
- [x] Egyptian color palette (@astik/ui)
- [x] Voice parser, notification parser, currency utilities (@astik/logic)
- [x] AI Agent Memory System (project-memory.md + workflows)
- [x] Dashboard real data integration (all components)
- [x] Quick Action FAB component
- [x] Schema sync automation (Supabase → WatermelonDB)
- [x] Net worth API architecture (VIEW, API endpoint, mobile hook)
- [x] Market rates edge function (metals.dev integration)
- [x] Daily snapshot functions with pg_cron
- [x] Transaction analytics package (@astik/logic/analytics)
- [x] Analytics hooks (useMonthlyChartData, useCategoryBreakdown, useComparison)
- [x] Smart sync (15min/30min adaptive intervals, data-cleared detection)

### 🔄 In Progress

- [ ] Analytics UI (charts, comparison cards)
- [ ] Complete migration 006 (column cleanup)
- [ ] Test net worth API end-to-end

### ⏳ Pending

- [ ] Local notifications (transaction confirmations, budget alerts)
- [ ] Voice transaction input (full flow)
- [ ] SMS auto-detection integration
- [ ] Supabase sync implementation
- [ ] Debt/recurring payment forms
- [ ] Budget tracking UI
- [ ] Asset management (gold tracking)

---

## 6. User Preferences

### Coding Style

- **TypeScript strict mode** always
- **Never use `any`** - use proper types or `unknown`
- Prefer `interface` over `type` for object shapes
- Always define explicit return types for functions
- Use `const` by default, `let` only when necessary
- Prefer `async/await` over `.then()` chains
- Named exports preferred over default exports
- Group interfaces/types in separate files for clarity

### React Native Preferences

- Functional components only (no classes)
- Prefer `react-native-reanimated` for animations
- Use NativeWind (Tailwind CSS) for styling
- Minimize `useState` and `useEffect` where possible
- Use context and reducers for state management
- Memoize appropriately with `useMemo` and `useCallback`

### Design Preferences

- Egyptian-inspired color palette (Nile Green #065F46, Astik Mint #10B981)
- Premium, modern aesthetic (not basic MVPs)
- Dark mode support is essential
- Smooth animations and micro-interactions
- Use the colors from `apps/mobile/constants/colors.ts`

### What to AVOID

- Don't use `any` type
- Don't use inline styles when Tailwind classes work
- Don't create simple "MVP" designs - make them premium
- Don't guess business logic - reference `business-decisions.md`
- Don't make assumptions - ask clarifying questions

---

## 7. Recent Sessions

> Last 10 sessions for context continuity

### Session: 2026-01-09 (00:52)

- **Topic:** Transaction Analytics Architecture
- **Accomplished:** Created shared analytics package in `@astik/logic`,
  analytics hooks (`useMonthlyChartData`, `useCategoryBreakdown`,
  `useComparison`), and smart sync with adaptive intervals and data-cleared
  detection.
- **Outcome:** Fully local analytics ready for chart UI implementation.

### Session: 2026-01-07 (19:37)

- **Topic:** Fix WatermelonDB Schema Sync
- **Accomplished:** Added missing sync fields (`updated_at`, `deleted`) to
  Supabase tables. Updated local schema and bumped version.
- **Outcome:** Schema compatibility for sync restored.

### Session: 2026-01-06 (17:13)

- **Topic:** API-First Net Worth Architecture
- **Accomplished:** Created `v_user_net_worth` VIEW, daily snapshot functions,
  `fetch-metal-rates` edge function, Express API endpoints with JWT auth, mobile
  hooks with local fallback.
- **Outcome:** Net worth now calculated via API with offline support.

### Session: 2026-01-05 (20:06)

- **Topic:** Fix JSON Field Handling in Schema
- **Accomplished:** Updated schema transformation to handle JSON fields with
  `Raw` suffix in base models and manual getters for parsing in extended models.
- **Outcome:** Fixed TypeScript type mismatch for `notification_settings`.

### Session: 2026-01-05 (21:10)

- **Topic:** Category Schema Updates & Transform Script Fix
- **Accomplished:** Created migration `004_update_categories.sql` adding Travel
  as L1 category with subcategories. Updated `seed-categories.ts` with nature
  field and unique colors. Fixed duplicate associations bug in transform script.
- **Outcome:** Category structure reorganized with Travel L1, unique colors.

### Session: 2026-01-05 (15:00)

- **Topic:** Schema Sync Automation
- **Accomplished:** Created transform script that parses Supabase types and
  generates WatermelonDB schema, types, and models. Implemented base/extended
  model pattern for preserving custom getters.
- **Outcome:** `npm run db:sync` workflow complete.

### Session: 2026-01-05 (00:07)

- **Topic:** Dashboard Enhancements & Quick Action FAB
- **Accomplished:** Integrated real data into all dashboard components
  (TotalBalanceCard, LiveRates, AccountsCarousel, RecentTransactions). Created
  Quick Action FAB with 5 actions in vertical stack. Simplified tab bar mic
  button to only open voice input.
- **Outcome:** Dashboard now displays real data. FAB ready for testing.

### Session: 2026-01-04 (22:35)

- **Topic:** Memory System Enhancement
- **Accomplished:** Enhanced memory system with individual session files in
  `docs/agent/sessions/`. Rewrote session-handoff workflow.
- **Outcome:** Each session now gets detailed file with business logic
  documentation.

### Session: 2026-01-04 (05:20)

- **Topic:** AI Agent Memory System Setup
- **Accomplished:** Created memory system files, workflows, and history log.
- **Pending:** Testing in new conversation.

### Session: 2026-01-04

- **Topic:** Fixing Decorator Signature Error
- **Accomplished:** Resolved TypeScript error for `@field` decorator in
  `UserCategorySettings.ts`.
- **Outcome:** Fixed build error.

### Session: 2025-12-31 to 2026-01-04

- **Topic:** Seeding Categories on Launch
- **Accomplished:** Created `seedCategories.ts`, defined system categories
  (L1/L2), integrated with app init.
- **Pending:** Category picker UI.

### Session: 2026-01-02

- **Topic:** Debt & Recurring Payments Schema
- **Accomplished:** Finalized `debts` and `recurring_payments` tables, defined
  transaction linking logic.
- **Outcome:** Updated `business-decisions.md`.

### Session: 2025-12-26

- **Topic:** Fixing Random App Errors
- **Accomplished:** Fixed `useTheme` context error and JSI initialization
  issues.
- **Outcome:** App stability improved.

### Session: 2025-12-23 (Morning)

- **Topic:** Implementing Custom Tab Bar
- **Accomplished:** Created animated bottom tab bar, quick action buttons,
  replaced default Expo tabs.
- **Reference:** `CustomTabBar.tsx`

---

## 8. Important References

| Document           | Purpose                            | Path                                                                                                               |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Business Decisions | All finalized business logic       | [business-decisions.md](file:///e:/Work/My%20Projects/Astik/docs/business/business-decisions.md)                   |
| Dashboard Spec     | Dashboard enhancement requirements | [dashboard-enhancements-v1.md](file:///e:/Work/My%20Projects/Astik/docs/requirements/dashboard-enhancements-v1.md) |
| Progress           | High-level project status          | [PROGRESS.md](file:///e:/Work/My%20Projects/Astik/PROGRESS.md)                                                     |
| Colors             | App color palette                  | [colors.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/constants/colors.ts)                                   |
| DB Models          | WatermelonDB models                | [packages/db/models/](file:///e:/Work/My%20Projects/Astik/packages/db/models/)                                     |
| Session History    | Detailed session log               | [session-history.md](file:///e:/Work/My%20Projects/Astik/docs/agent/session-history.md)                            |

---

## 9. Quick Commands

When I ask you to do something, here are common patterns:

| Request                           | What I Mean                                          |
| --------------------------------- | ---------------------------------------------------- |
| "Continue where we left off"      | Check session history, identify pending tasks        |
| "Update the status"               | Update section 5 of this file                        |
| "What's the business rule for X?" | Check `business-decisions.md` section                |
| "Add a new table/feature"         | Update `business-decisions.md` first, then implement |
| "End session" / "Session handoff" | Run `/session-handoff` workflow                      |

---

> 💡 **For AI Agent:** Always check this file at conversation start. Update it
> when making significant decisions or completing major tasks. Run
> `/session-handoff` at conversation end to preserve context.
