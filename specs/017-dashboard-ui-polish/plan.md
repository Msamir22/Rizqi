# Implementation Plan: Dashboard & UI Polish

**Branch**: `017-dashboard-ui-polish` | **Date**: 2026-03-18 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/017-dashboard-ui-polish/spec.md)  
**Input**:
Feature specification from `specs/017-dashboard-ui-polish/spec.md`

## Summary

This plan covers 4 changes grouped as a single polish batch: dynamic user
profile in the app drawer (#109), period filter for upcoming bills (#107),
equivalent preferred currency on transaction cards (#104), and a bug fix for
negative saved values (#111). **No schema changes are required.** All features
operate on existing tables (`profiles`, `market_rates`, `recurring_payments`,
`transactions`).

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React Native + Expo, NativeWind v4, WatermelonDB,
Supabase Auth  
**Storage**: WatermelonDB (offline-first), Supabase (cloud sync)  
**Testing**: Jest + React Native Testing Library (limited existing test
coverage)  
**Target Platform**: Android + iOS via Expo  
**Project Type**: Mobile (monorepo: `apps/mobile`, `packages/logic`,
`packages/db`)  
**Performance Goals**: UI updates < 500ms, no unnecessary re-renders  
**Constraints**: Offline-capable, no new network dependencies  
**Scale/Scope**: 4 small-to-medium changes across ~8 files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                          |
| ----------------------------- | ------- | -------------------------------------------------------------- |
| I. Offline-First              | ✅ Pass | All data from WatermelonDB; no new API calls                   |
| II. Documented Business Logic | ✅ Pass | Spec documents all decisions                                   |
| III. Type Safety              | ✅ Pass | All new hooks/functions will have explicit types               |
| IV. Service-Layer Separation  | ✅ Pass | Hooks observe data, components render; no business logic in UI |
| V. Premium UI                 | ✅ Pass | NativeWind classes, dark mode support, avatar fallback         |
| VI. Monorepo Boundaries       | ✅ Pass | No cross-boundary violations                                   |
| VII. Local-First Migrations   | ✅ Pass | No schema changes needed                                       |

## Project Structure

### Documentation (this feature)

```text
specs/017-dashboard-ui-polish/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code Changes

```text
apps/mobile/
├── hooks/
│   ├── useProfile.ts                    # [NEW] Observe profile for drawer
│   ├── useHistoricalRate.ts             # [NEW] Query market_rates by date
│   ├── useRecurringPayments.ts          # [MODIFY] Add date range filter
│   └── usePeriodSummary.ts              # [MODIFY] Clamp savings to 0
├── components/
│   ├── navigation/
│   │   └── AppDrawer.tsx                # [MODIFY] Dynamic profile data
│   ├── dashboard/
│   │   └── UpcomingPayments.tsx          # [MODIFY] Add period filter UI
│   └── transactions/
│       └── TransactionCard.tsx           # [MODIFY] Show equivalent currency
```

---

## Implementation Phases

### Phase 1: Bug Fix — Negative Saved Value (Issue #111)

**Priority**: P0 (quick fix, highest confidence)  
**Estimated effort**: ~5 minutes

#### [MODIFY] [usePeriodSummary.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/usePeriodSummary.ts)

- **Line 252**: Change
  `const savings = totals.totalIncome - totals.totalExpenses;` to
  `const savings = Math.max(0, totals.totalIncome - totals.totalExpenses);`
- Also clamp `savingsPercentage` to `Math.max(0, ...)` to prevent negative
  percentage in the ring gauge

> 🛡️ **Design Rationale**
>
> - **Pattern**: Data-layer clamping (Single Source of Truth)
> - **Why**: Savings is consumed by text display, ring gauge, and percentage.
>   Clamping at the hook ensures consistency across all consumers.
> - **SOLID**: SRP — the hook is responsible for computing the summary data
>   correctly.

---

### Phase 2: Drawer Profile (Issue #109)

**Priority**: P1  
**Estimated effort**: ~30 minutes

#### [NEW] [useProfile.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useProfile.ts)

Create a hook that:

1. Observes the first `Profile` record from WatermelonDB (same pattern as
   `usePreferredCurrency`)
2. Exposes `profile` (reactive), `isLoading`, and derived properties:
   - `displayName`: `profile.fullName` or fallback to email
   - `avatarUrl`: `profile.avatarUrl` or `null`
   - `initials`: First letter of first name + first letter of last name (or
     first 2 letters of email)

The hook does NOT fetch email — the component gets that from
`useAuth().user.email`.

```typescript
interface UseProfileResult {
  readonly profile: Profile | null;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly initials: string;
  readonly isLoading: boolean;
}
```

> 🛡️ **Design Rationale**
>
> - **Pattern**: Observer Hook (reactive data from WatermelonDB)
> - **Why**: Follows the established pattern from `usePreferredCurrency`. The
>   Profile record may update (e.g., user changes name in settings), and the
>   drawer should react.
> - **SOLID**: SRP — hook observes profile data; component renders it.

#### [MODIFY] [AppDrawer.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/navigation/AppDrawer.tsx)

- Import and use `useProfile()` hook and `useAuth()` hook
- **Line ~236**: Replace hardcoded `"User"` with `displayName` from
  `useProfile()`
- **Line ~237**: Replace hardcoded `"user@email.com"` with `user.email` from
  `useAuth()`
- **Line ~228-234**: Replace the static gradient circle avatar with:
  - If `avatarUrl` exists → `<Image>` with `onError` fallback to initials
  - If no `avatarUrl` → Circle with initials text (extracted from
    `useProfile().initials`)
- Ensure dark mode support with Tailwind dark variants

---

### Phase 3: Bills Period Filter (Issue #107)

**Priority**: P2  
**Estimated effort**: ~45 minutes

#### [MODIFY] [useRecurringPayments.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useRecurringPayments.ts)

- Add optional `dateRange?: { start: Date; end: Date }` to
  `UseRecurringPaymentsOptions`
- In the `filteredPayments` memo, add a filter step: if `dateRange` is provided,
  filter payments where
  `nextDueDate >= dateRange.start && nextDueDate <= dateRange.end`
- The `totalDueThisMonth` calculation should also respect the date range so the
  total reflects only filtered bills
- Add a new `totalDueFiltered` computed value that sums amounts for the filtered
  period

```typescript
interface UseRecurringPaymentsOptions {
  readonly limit?: number;
  readonly status?: RecurringStatus;
  readonly type?: TransactionType;
  readonly dateRange?: { readonly start: Date; readonly end: Date };
}
```

> 🛡️ **Design Rationale**
>
> - **Pattern**: Extended Filter Hook
> - **Why**: In-memory filtering is adequate for recurring payments (typically <
>   50 items). Adding a DB-level query would add complexity with minimal
>   benefit.
> - **SOLID**: Open/Closed — extending existing options interface without
>   modifying existing consumers.

#### [MODIFY] [UpcomingPayments.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/dashboard/UpcomingPayments.tsx)

- Add period filter state:
  `const [selectedPeriod, setSelectedPeriod] = useState<BillsPeriodFilter>("this_month");`
- Define `BillsPeriodFilter` type:
  `"this_week" | "this_month" | "six_months" | "one_year"`
- Compute `dateRange` from `selectedPeriod` using helper similar to
  `getPeriodDateRange` in `usePeriodSummary`
- Pass `dateRange` to `useRecurringPayments()`
- Add a horizontal pill/chip selector row below the header (before the content
  area):
  - `This Week` | `This Month` (default) | `6 Months` | `1 Year`
  - Use NativeWind classes, nileGreen accent for selected, slate for unselected
- Update the "Total due" footer to use the `totalDueFiltered` from the hook
- When no bills match: show empty state message instead of hiding the section

---

### Phase 4: Currency Equivalent on Transaction Cards (Issue #104)

**Priority**: P3  
**Estimated effort**: ~45 minutes

#### [NEW] [useHistoricalRate.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useHistoricalRate.ts)

Create a hook that:

1. Accepts a `transactionDate: Date`
2. Queries `market_rates` for the closest entry on or before that date:
   `Q.where("created_at", Q.lte(dateMs)), Q.sortBy("created_at", Q.desc), Q.take(1)`
3. Returns the `MarketRate` object or `null`

```typescript
interface UseHistoricalRateResult {
  readonly rate: MarketRate | null;
  readonly isLoading: boolean;
}
```

**Performance consideration**: This hook will be called per transaction card in
the list. To avoid N queries, consider a batch approach:

- Option A: Query once with the earliest transaction date and cache results per
  render cycle
- Option B: Use a provider/context that pre-loads rates for all visible
  transactions
- Option C: Accept a pre-fetched `MarketRate` as a prop instead of querying per
  card

**Recommended**: Option C — the parent list component fetches the required rates
once and passes them down as props. This avoids per-card queries and follows the
existing pattern where `TransactionCard` receives data via props.

> 🛡️ **Design Rationale**
>
> - **Pattern**: Props-down data flow + batch prefetch
> - **Why**: Avoids N+1 query pattern. The parent transaction list already
>   iterates over transactions; it can group them by date, fetch one rate per
>   unique date, and pass the appropriate rate to each card.
> - **SOLID**: DIP — card component depends on abstraction (rate prop), not on
>   the query mechanism.
> - **Algorithm**: O(D) queries where D = number of unique transaction dates in
>   the list, instead of O(N) queries where N = number of transactions.

#### [MODIFY] [TransactionCard.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/transactions/TransactionCard.tsx)

- Add optional `equivalentAmount?: number` and
  `equivalentCurrency?: CurrencyType` props
- When both are provided and `equivalentAmount > 0`, render a small text line
  below the primary amount:
  `≈ {formatCurrency({ amount: equivalentAmount, currency: equivalentCurrency })}`
  in `text-xs text-slate-400`
- When not provided or same currency, render nothing extra

---

## Verification Plan

### Manual Testing

> **Note**: These tests require the app running on an Android emulator with test
> data. Start the app with `npm run start:android` from the repo root.

**Test 1 — Negative Saved Bug (#111)**

1. Ensure you have a period where expenses exceed income (e.g., this month has
   $1000 expenses, $500 income)
2. Open the Dashboard → "This Month" section
3. ✅ Verify: "Saved" shows `0` (or `0 EGP`), not a negative number
4. ✅ Verify: The ring gauge does not show a negative segment

**Test 2 — Drawer Profile (#109)**

1. Open the side drawer (swipe from left or tap hamburger menu)
2. ✅ Verify: Your real name appears (not "User")
3. ✅ Verify: Your email appears (not "user@email.com")
4. ✅ Verify: Avatar shows your profile picture OR your initials in a circle

**Test 3 — Bills Period Filter (#107)**

1. Navigate to Dashboard → Upcoming Bills section
2. ✅ Verify: Default filter is "This Month"
3. Tap "This Week" → ✅ only bills due this week are shown
4. Tap "6 Months" → ✅ bills due in next 6 months are shown
5. Tap "1 Year" → ✅ all bills within a year are shown
6. ✅ Verify: "Total due" row updates with each filter change
7. Select a period with no bills → ✅ empty state message is shown

**Test 4 — Currency Equivalent (#104)**

1. Create a transaction in a currency different from your preferred currency
2. View the transaction in the transactions list
3. ✅ Verify: An equivalent amount in your preferred currency appears below the
   primary amount
4. View a transaction in the same currency as preferred → ✅ no equivalent shown
5. View an old transaction (if market rate data doesn't exist for that date) →
   ✅ no equivalent shown, no crash

### Automated Tests

No existing automated tests cover these components. The project uses Jest but
has limited mobile hook test coverage. New unit tests can be added for:

- `usePeriodSummary`: Test that savings is never negative
- `useProfile`: Test fallback chain (fullName → displayName → email → "")
- Date range filtering logic in `useRecurringPayments`

However, given that these are mostly UI-level changes with reactive hooks,
manual testing on device is the primary verification method for this feature.

## Complexity Tracking

No constitution violations. No additional complexity.
