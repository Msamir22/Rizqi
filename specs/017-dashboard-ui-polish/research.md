# Research: Dashboard & UI Polish (017)

**Feature**: 017-dashboard-ui-polish  
**Date**: 2026-03-18

## Research Items

### R1: How to access user profile data for the drawer

**Decision**: Create a new `useProfile` hook that observes the first `Profile`
record from WatermelonDB, following the exact same pattern as
`usePreferredCurrency` (which already does
`database.get<Profile>("profiles").query(Q.where("deleted", false), Q.take(1)).observe()`).
For the email, use `useAuth()` which exposes `user.email` from the Supabase
session.

**Rationale**: The profile data (name, avatar) lives in WatermelonDB's
`profiles` table. The email is not in that table but is available from the
Supabase `User` object in `AuthContext`. Combining both sources gives us all
drawer fields.

**Alternatives considered**:

- Query Supabase directly for profile → violates offline-first principle
- Store email in profiles table → requires migration and sync changes; email
  already available from auth

### R2: Historical market rate lookup for transaction currency equivalent

**Decision**: Query the `market_rates` WatermelonDB table for the rate entry
closest to (but not after) the transaction date. The `market_rates` table stores
daily snapshots with a `created_at` date. Use
`Q.where("created_at", Q.lte(transactionDate))` +
`Q.sortBy("created_at", Q.desc)` + `Q.take(1)` to find the nearest rate.

**Rationale**:
`convertCurrency(amount, fromCurrency, toCurrency, marketRateObject)` already
handles cross-currency conversion via the `MarketRate.getRate()` method. We just
need to provide the correct historical `MarketRate` object instead of the latest
one.

**Alternatives considered**:

- Store exchange rate on transaction at creation time → rejected by user (breaks
  on preferred currency change)
- Use latest rate for all transactions → inaccurate for old transactions
- API call for historical rates → violates offline-first principle

### R3: Period filtering for recurring payments

**Decision**: Extend the existing `useRecurringPayments` hook to accept an
optional date range filter, and filter `allPayments` by `nextDueDate` within the
range. The filtering stays in-memory since the dataset is small (recurring
payments). The `UpcomingPayments` component will manage a `selectedPeriod` state
and pass the derived date range to the hook.

**Rationale**: `useRecurringPayments` already does in-memory filtering by
`status` and `type`. Adding date range filtering follows the same pattern. The
`RecurringPayment` model has `nextDueDate` as a `Date` field.

**Alternatives considered**:

- WatermelonDB query-level filtering → more complex, marginal benefit for small
  datasets
- Separate hook → violates DRY since all the existing logic (convert to
  preferred currency, totals) would need duplication

### R4: Clamping negative saved value

**Decision**: Clamp at the `usePeriodSummary` hook level (line 252 in
`usePeriodSummary.ts`):
`const savings = Math.max(0, totals.totalIncome - totals.totalExpenses)`. This
keeps the fix in the data layer, not the UI.

**Rationale**: The savings value is consumed by multiple UI elements (text, ring
gauge, percentage). Clamping at the source ensures consistency everywhere.

**Alternatives considered**:

- Clamp in `ThisMonth.tsx` component → would need to clamp in multiple places
  (text display + ring gauge)
- Allow negative but show "Overspent" label → would require spec change and
  design work
