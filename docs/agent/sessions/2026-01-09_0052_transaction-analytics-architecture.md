# Session: Transaction Analytics Architecture

**Date:** 2026-01-09 **Time:** 00:52 - 02:06 **Duration:** ~1 hour 15 minutes

---

## Summary

Designed and implemented a fully local transaction analytics architecture for
Monyvi. The session started with a discussion about moving calculation logic
from frontend to backend, exploring options for storing pre-aggregated data
(Postgres VIEW vs table vs JSON field). After thorough analysis of pros/cons and
offline-first requirements, decided on a **fully local approach** using
WatermelonDB with shared calculation logic in `@monyvi/logic`.

Also implemented **smart sync** with adaptive intervals (15min active, 30min
background) and data-cleared detection for automatic resync.

---

## What Was Accomplished

### Files Created

| File                                                    | Purpose                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/logic/src/analytics/types.ts`                 | TypeScript interfaces for analytics (MonthlyTotals, CategoryBreakdown, etc.)   |
| `packages/logic/src/analytics/transaction-analytics.ts` | Core calculation functions (calculateMonthlyTotals, aggregateByCategory, etc.) |
| `packages/logic/src/analytics/index.ts`                 | Module exports                                                                 |
| `apps/mobile/hooks/useAnalytics.ts`                     | Analytics hooks (useMonthlyChartData, useCategoryBreakdown, useComparison)     |

### Files Modified

| File                                     | Changes                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/logic/src/index.ts`            | Added export for analytics module                                              |
| `apps/mobile/hooks/useTransactions.ts`   | Refactored `useMonthlyTransactions` to use shared analytics, added `netChange` |
| `apps/mobile/providers/SyncProvider.tsx` | Implemented smart sync with AppState detection and data-cleared trigger        |
| `apps/mobile/package.json`               | Added `react-native-gifted-charts` and `react-native-linear-gradient`          |

### Key Decisions Made

1. **Fully Local Analytics:** Chose local WatermelonDB queries over API/VIEW
   approach because SQLite handles 10-20K transactions efficiently (<200ms),
   enables true offline-first, and simplifies architecture. API endpoints
   deferred to web app phase.

2. **Shared Logic Package:** Calculation logic lives in `@monyvi/logic` so it
   can be reused by both mobile app (now) and future web app (later).

3. **Smart Sync Intervals:** Changed from 5-minute fixed interval to adaptive
   15min (foreground) / 30min (background) to reduce database queries by ~66%
   while maintaining acceptable sync freshness.

4. **Chart Library:** Selected `react-native-gifted-charts` for Expo
   compatibility, smooth animations, and good performance with small-medium
   datasets.

---

## Business Logic Changes

> No new business rules established. This session focused on technical
> architecture for analytics features.

---

## Technical Details

### Analytics Functions Available

```typescript
// Shared logic functions
calculateMonthlyTotals(transactions); // Returns { totalExpenses, totalIncome, netChange }
aggregateByCategory(transactions, names, colors); // Returns CategoryBreakdown[]
generateMonthlyChartData(transactions, months, type); // Returns ChartDataPoint[]
calculateComparison(current, previous); // Returns { percentageChange, trend, ... }
getMonthBoundaries(year, month); // Returns { startDate, endDate }
getComparisonPeriods("mom" | "yoy", year, month); // For MoM/YoY comparisons
```

### Analytics Hooks Available

```typescript
useMonthlyChartData(months, accountIds?)  // Bar/line chart data
useCategoryBreakdown(year, month, accountIds?)  // Pie chart data
useComparison('mom' | 'yoy', year?, month?)  // Comparative analytics
useMonthlySummaries(months, accountIds?)  // Array of monthly summaries
```

### Smart Sync Features

- **AppState Listener:** Detects foreground/background transitions
- **Adaptive Intervals:** 15 min (active) / 30 min (background)
- **Data-Cleared Detection:** Checks if accounts table is empty on mount,
  triggers immediate sync if so
- **Foreground Return Sync:** Syncs immediately when app returns to foreground

### Important Fix

WatermelonDB stores `date` as a `Date` object, but analytics functions expect
timestamps in milliseconds. User fixed this by adding `.getTime()` calls when
mapping transactions to `TransactionData`.

---

## Pending Items

- [ ] Create chart components using `react-native-gifted-charts` with the new
      hooks
- [ ] Build analytics screen with monthly bar chart and category pie chart
- [ ] Add comparison card to dashboard showing MoM spending change
- [ ] Test smart sync on actual device (foreground/background transitions)

---

## Context for Next Session

The analytics infrastructure is complete. All hooks are created and working. The
next step is to **build the UI components** that use these hooks:

1. **Monthly Chart Component** - Use `useMonthlyChartData(12)` with `BarChart`
   from gifted-charts
2. **Category Pie Chart** - Use `useCategoryBreakdown(year, month)` with
   `PieChart`
3. **Comparison Card** - Use `useComparison('mom')` to show "You spent X%
   more/less than last month"

The chart library is already installed. Just import from
`react-native-gifted-charts` and pass the hook data.

**Important:** Remember that transaction dates are `Date` objects in
WatermelonDB but need `.getTime()` when converting to `TransactionData` for
analytics functions.
