# Dashboard Module Audit - Implementation Plan

## Overview

Comprehensive audit of the Dashboard module covering bugs, calculations,
performance, code quality, styling, UX polish, and new features.

---

## Phase 1: Bug Fixes & Critical Issues

- [x] **TopNav crowding on narrow screens** — Moved greeting below TopNav to its
      own row, removed inline greeting + vertical divider
- [x] **Hardcoded user name** — Replaced with `useProfile()` reading
      `firstName`/`displayName` from WatermelonDB
- [x] **Currency chip crash** — Re-added `<Text>` wrappers around raw strings in
      JSX
- [x] **Stacked JSDoc comments** — Removed duplicate JSDoc block before
      `DashboardScreen`

## Phase 2: Calculation Correctness

- [x] **Currency precision** — Added `CURRENCY_PRECISION` config
      (`packages/logic/src/utils/currency.ts`) so EGP shows 0 decimals, USD 2,
      BTC 8, etc.
- [x] **NaN guards** — Added `Number.isFinite()` guards in financial
      calculations
- [x] **Largest remainder rounding** — Ensured percentage breakdowns sum to
      exactly 100%
- [x] **Unit tests** — 246 tests across 7 test files:
  - `currency.test.ts` (51 tests)
  - `metal.test.ts` (38 tests)
  - `purity-utils.test.ts` (59 tests)
  - `transaction-analytics.test.ts` (40 tests)
  - `asset-breakdown.test.ts` (26 tests)
  - `net-worth-calculations.test.ts` (14 tests)
  - `accounts-calculations.test.ts` (18 tests)

## Phase 3: Performance Optimization

- [x] **React.memo** — Wrapped 9 components (TopNav, SectionHeader,
      FilterChipBar, AccountsSection, LiveRates, RecentTransactions, ThisMonth,
      UpcomingPayments, TotalNetWorthCard)
- [x] **useCallback** — Extracted 15+ inline handlers across 6 files
- [x] **useMemo** — Wrapped `buildRatesDisplay` in LiveRates, context values in
      6 providers (AuthContext, ThemeContext, DatabaseProvider, SyncProvider,
      MarketRatesRealtimeProvider, ToastProvider)
- [x] **Provider context memoization** — Prevents cascading re-renders when
      provider state changes

## Phase 4: Code Quality & Architecture

- [x] **PayNowModal SRP** — Extracted business logic into `usePaymentSubmission`
      hook
- [x] **SectionErrorBoundary** — New component isolating dashboard section
      crashes with retry button
- [x] **SectionHeader** — Reusable component for section title + "See All"
      action
- [x] **FilterChipBar** — Generic horizontal scrolling chip bar with type
      parameter
- [x] **Dead code removal** — Deleted `AccountsCarousel.tsx` (unused)

## Phase 5: Styling & Dark Mode

- [x] **Global CSS classes** — Added `.subtitle-text`, `.body-text`,
      `.body-small`, `.caption-text`
- [x] **Ring gauge contextual colors** — ThisMonth progress circle changes
      green/orange/red based on spending percentage
- [x] **Avatar fix** — Added `resizeMode="cover"` to AppDrawer avatar
- [x] **Skeleton loading rule** — Created `.claude/rules/skeleton-loading.md`
      enforcing `<Skeleton>` over `ActivityIndicator`

## Phase 6: Structured Logging

- [x] **Sentry logger utility** — `apps/mobile/utils/logger.ts` wrapping Sentry
      for production, console for dev
  - `error()` -> `Sentry.captureException`
  - `warn()` -> `Sentry.addBreadcrumb (warning)`
  - `info()` -> `Sentry.addBreadcrumb (info)`
  - `debug()` -> console only

## Phase 7: UX Enhancements

- [x] **Pull-to-refresh** — Added `RefreshControl` wired to `useSync().sync()`
- [x] **Greeting row** — Time-based greeting (morning/afternoon/evening) + first
      name below TopNav
- [x] **Notification bell** — Kept visible for future feature

## Phase 8: New Dashboard Cards (Mockup-Driven)

### Onboarding Guide Card

- [x] **`useOnboardingGuide` hook** — Tracks 5 setup steps reactively:
  1. Cash account created (always true, auto-created)
  2. Bank account added (WatermelonDB query: accounts where type="BANK")
  3. First transaction recorded (any non-deleted transaction exists)
  4. Spending budget set (any active budget exists)
  5. SMS auto-import enabled (AsyncStorage flag)
- [x] **`OnboardingGuideCard` component** — Dark card with:
  - Rocket icon + "Setup Guide" header
  - Progress bar (N of 5 complete)
  - 5-step checklist with completed/active/upcoming visual states
  - "NEW" badge on SMS step (Android only)
  - "Add" CTA button on active step
  - "Dismiss" action persisted to AsyncStorage
- [x] Card auto-hides when all steps complete or dismissed

### SMS Import Status Card

- [x] **`useSmsImportStats` hook** — Observes count of SMS-sourced transactions
      for current month via WatermelonDB `observeCount()`
- [x] **`SmsImportStatusCard` component** — Compact banner:
  - SMS chat icon with teal accent
  - "N transactions imported this month" (reactive count)
  - "Last scan: X ago" relative time
  - Toggle switch for SMS sync state
  - Teal left-border accent stripe
  - Only visible on Android after first sync
- [x] Tapping card navigates to `/sms-scan` screen

## Phase 9: i18n

- [x] Added 14 new translation keys (EN + AR) for onboarding guide and SMS
      import cards
- [x] Plural forms for SMS import count (`_one` / `_other`)

## Phase 10: Tooling

- [x] **Module audit command** — `.claude/commands/module-audit.md` reusable
      10-section framework
- [x] **GitHub issues** — Created issues #201-#207 for product ideas

## Phase 11: GitHub Issues Created

- #201: Voice transaction quick-launch from dashboard
- #202: SMS auto-import with ML categorization
- #203: Spending insights AI-generated
- #204: Budget alerts and notifications
- #205: Account balance trend sparklines
- #206: Quick transfer between accounts
- #207: Dashboard widget customization

---

## Files Changed

### New Files

| File                                           | Purpose                                 |
| ---------------------------------------------- | --------------------------------------- |
| `hooks/useOnboardingGuide.ts`                  | 5-step onboarding progress tracking     |
| `hooks/useSmsImportStats.ts`                   | SMS transaction count for current month |
| `hooks/usePaymentSubmission.ts`                | Extracted payment business logic        |
| `components/dashboard/OnboardingGuideCard.tsx` | Setup guide card UI                     |
| `components/dashboard/SmsImportStatusCard.tsx` | SMS import status banner                |
| `components/dashboard/SectionHeader.tsx`       | Reusable section header                 |
| `components/dashboard/FilterChipBar.tsx`       | Generic filter chip bar                 |
| `components/ui/SectionErrorBoundary.tsx`       | Crash isolation for sections            |
| `utils/logger.ts`                              | Structured Sentry logger                |
| `.claude/commands/module-audit.md`             | Reusable audit command                  |
| `.claude/rules/skeleton-loading.md`            | Skeleton loading enforcement            |
| 7 test files in `packages/logic/`              | 246 unit tests                          |

### Modified Files

| File                   | Changes                                                |
| ---------------------- | ------------------------------------------------------ |
| `app/(tabs)/index.tsx` | Greeting, pull-to-refresh, error boundaries, new cards |
| `TopNav.tsx`           | Simplified layout, removed crowding                    |
| `ThisMonth.tsx`        | Contextual ring gauge colors                           |
| `PayNowModal.tsx`      | Refactored to use usePaymentSubmission hook            |
| `currency.ts`          | CURRENCY_PRECISION config                              |
| 6 provider files       | useMemo on context values                              |
| 9 component files      | React.memo wrapping                                    |
| locale files (en/ar)   | New i18n keys                                          |

### Deleted Files

| File                   | Reason                                 |
| ---------------------- | -------------------------------------- |
| `AccountsCarousel.tsx` | Dead code, replaced by AccountsSection |
