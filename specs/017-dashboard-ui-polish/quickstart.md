# Quickstart: Dashboard & UI Polish (017)

**Feature**: 017-dashboard-ui-polish  
**Date**: 2026-03-18

## Prerequisites

- Node.js and npm installed
- Android emulator or device connected
- Supabase MCP for read-only queries

## Running the App

```bash
cd e:/Work/My\ Projects/Astik
npm run start:android
```

## Key Files to Touch

### Issue #109 — Drawer Profile

- **New**: `apps/mobile/hooks/useProfile.ts` — observe first Profile record
- **Modify**: `apps/mobile/components/navigation/AppDrawer.tsx` — replace
  hardcoded user info

### Issue #107 — Bills Period Filter

- **Modify**: `apps/mobile/hooks/useRecurringPayments.ts` — add date range
  filter
- **Modify**: `apps/mobile/components/dashboard/UpcomingPayments.tsx` — add
  period selector UI

### Issue #104 — Currency Equivalent

- **New**: `apps/mobile/hooks/useHistoricalRate.ts` — query market_rates by
  transaction date
- **Modify**: `apps/mobile/components/transactions/TransactionCard.tsx` — show
  equivalent line

### Issue #111 — Negative Saved Bug

- **Modify**: `apps/mobile/hooks/usePeriodSummary.ts` — clamp savings to 0

## Testing

```bash
# Run existing tests
cd e:/Work/My\ Projects/Astik
npx jest --passWithNoTests

# Manual testing
# 1. Open drawer → verify name/avatar from profile
# 2. Dashboard → Upcoming Bills → tap period filter → verify bill list updates
# 3. Create a transaction in a different currency → verify equivalent shows
# 4. Check "This Month" when expenses > income → saved should show 0, not negative
```
