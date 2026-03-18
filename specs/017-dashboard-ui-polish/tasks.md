# Tasks: Dashboard & UI Polish

**Input**: Design documents from `/specs/017-dashboard-ui-polish/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅,
quickstart.md ✅

**Tests**: Not explicitly requested — manual verification only per
quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Bug Fix — Negative Saved Value (Issue #111)

**Purpose**: Quick fix with highest confidence, unblocks accurate dashboard
testing for later phases

- [x] T001 Clamp savings to `Math.max(0, ...)` in
      `apps/mobile/hooks/usePeriodSummary.ts` (line 252)
- [x] T002 Clamp `savingsPercentage` to `Math.max(0, ...)` in
      `apps/mobile/hooks/usePeriodSummary.ts` (line 253-256)
- [ ] T003 Manually verify: open Dashboard → "This Month" when expenses > income
      → "Saved" shows 0, ring gauge shows no negative segment

**Checkpoint**: Negative saved bug is fixed. Dashboard shows correct
non-negative values.

---

## Phase 2: User Story 1 — Dynamic User Profile in Drawer (Priority: P1) 🎯 MVP

**Goal**: Replace hardcoded "User" / "user@email.com" in the app drawer with
real profile data from the `profiles` table.

**Independent Test**: Open the drawer after sign-in → verify user's real name,
email, and avatar (or initials fallback) are displayed.

### Implementation for User Story 1

- [x] T004 [US1] Create `useProfile` hook in `apps/mobile/hooks/useProfile.ts` —
      observe first Profile record from WatermelonDB, expose `displayName`,
      `avatarUrl`, `initials`, and `isLoading`
- [x] T005 [US1] Update avatar section in
      `apps/mobile/components/navigation/AppDrawer.tsx` (lines ~228-234) —
      replace static gradient circle with: `<Image>` if `avatarUrl` exists (with
      `onError` fallback to initials), or initials circle if no `avatarUrl`
- [x] T006 [US1] Update user info section in
      `apps/mobile/components/navigation/AppDrawer.tsx` (lines ~236-237) —
      replace hardcoded `"User"` with `displayName` from `useProfile()` and
      `"user@email.com"` with `user.email` from `useAuth()`
- [x] T007 [US1] Handle edge cases in
      `apps/mobile/components/navigation/AppDrawer.tsx` — loading shimmer while
      profile loads, broken avatar URL fallback, no-name fallback to email
- [ ] T008 [US1] Manually verify: open drawer → confirm real name, email,
      avatar/initials are shown; test with broken avatar URL → confirm initials
      fallback

**Checkpoint**: Drawer displays real user profile data. Can be tested
independently of all other stories.

---

## Phase 3: User Story 2 — Period Filter on Upcoming Bills (Priority: P2)

**Goal**: Add a period filter (This Week / This Month / 6 Months / 1 Year) to
the Upcoming Bills dashboard section so users can control their cashflow
forecast window.

**Independent Test**: On Dashboard, tap period filter options → bill list and
"Total due" row update to match the selected window.

### Implementation for User Story 2

- [x] T009 [US2] Define `BillsPeriodFilter` type and `BILLS_PERIOD_LABELS`
      constant in `apps/mobile/hooks/useRecurringPayments.ts` or a shared types
      file
- [x] T010 [US2] Add `dateRange` option to `UseRecurringPaymentsOptions`
      interface in `apps/mobile/hooks/useRecurringPayments.ts`
- [x] T011 [US2] Implement date range filtering in the `filteredPayments` memo
      in `apps/mobile/hooks/useRecurringPayments.ts` — filter by `nextDueDate`
      within the provided range
- [x] T012 [US2] Add `totalDueFiltered` computed value in
      `apps/mobile/hooks/useRecurringPayments.ts` — sum of amounts for bills
      matching the date range, converted to preferred currency
- [x] T013 [US2] Create `getBillsPeriodDateRange` helper function (can co-locate
      with `getPeriodDateRange` in `apps/mobile/hooks/usePeriodSummary.ts` or in
      the recurring payments hook)
- [x] T014 [US2] Add period filter state and pill/chip selector UI row in
      `apps/mobile/components/dashboard/UpcomingPayments.tsx` — below header,
      before content
- [x] T015 [US2] Wire `selectedPeriod` → `dateRange` → `useRecurringPayments()`
      in `apps/mobile/components/dashboard/UpcomingPayments.tsx`
- [x] T016 [US2] Update "Total due" footer in
      `apps/mobile/components/dashboard/UpcomingPayments.tsx` to use
      `totalDueFiltered`
- [x] T017 [US2] Add empty state in
      `apps/mobile/components/dashboard/UpcomingPayments.tsx` — show message
      when no bills match the selected period instead of hiding the section
- [ ] T018 [US2] Manually verify: tap each filter → bill list updates, total
      updates, empty state shows when no matches, default is "This Month"

**Checkpoint**: Upcoming Bills section has working period filter. Can be tested
independently of other stories.

---

## Phase 4: User Story 3 — Equivalent Preferred Currency on Transaction Cards (Priority: P3)

**Goal**: Show the equivalent amount in the user's preferred currency beneath
the primary amount on transaction cards, using historical market rates from the
`market_rates` table.

**Independent Test**: Create a transaction in a non-preferred currency → view in
list → equivalent preferred-currency amount appears below the primary amount.

### Implementation for User Story 3

- [x] T019 [US3] Create `useHistoricalRates` hook in
      `apps/mobile/hooks/useHistoricalRates.ts` — accepts an array of `Date[]`,
      deduplicates by date key, batch-queries `market_rates` table for the
      closest rate on-or-before each date, returns
      `Map<string, MarketRate | null>`
- [x] T020 [US3] Add optional `equivalentAmountText` prop to `BaseCard`
      interface in `apps/mobile/components/transactions/BaseCard.tsx` — render
      below main amount in muted style (`text-[11px] text-slate-400`) when
      present
- [x] T021 [US3] Add optional `equivalentAmountText` prop to `TransactionCard`
      interface in `apps/mobile/components/transactions/TransactionCard.tsx` —
      pass through to `BaseCard`
- [x] T022 [US3] In parent component `apps/mobile/app/(tabs)/transactions.tsx`,
      call `useHistoricalRates(transactionDates)` with dates from visible
      transactions to batch-prefetch rates
- [x] T023 [US3] In parent component `renderItem`, compute
      `equivalentAmountText` using
      `computeEquivalentText(amount, currency, preferredCurrency, historicalRate)`
      and pass to `<TransactionCard>`
- [ ] T024 [US3] Handle edge cases — no market rate for date (omit equivalent
      line), same currency (omit equivalent line), null/zero amounts
- [ ] T025 [US3] Manually verify: view transaction in non-preferred currency →
      equivalent shows; view same-currency transaction → no equivalent; view old
      transaction with no rate data → no equivalent, no crash

**Checkpoint**: Transaction cards show equivalent preferred currency. All user
stories are independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation across all stories

- [ ] T025 [P] Export `useProfile` from barrel file `apps/mobile/hooks/index.ts`
- [ ] T026 [P] Export `useHistoricalRate` from barrel file
      `apps/mobile/hooks/index.ts`
- [ ] T027 Run TypeScript compilation check (`npx tsc --noEmit`) to verify no
      type errors
- [ ] T028 Run ESLint (`npx eslint apps/mobile --ext .ts,.tsx`) to verify no
      lint violations
- [ ] T029 Run full manual verification per
      `specs/017-dashboard-ui-polish/quickstart.md` — all 4 test scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Bug Fix)**: No dependencies — can start immediately
- **Phase 2 (US1 - Drawer)**: No dependencies on other phases — can start in
  parallel with Phase 1
- **Phase 3 (US2 - Bills Filter)**: No dependencies on other phases — can start
  in parallel
- **Phase 4 (US3 - Currency Equivalent)**: No dependencies on other phases — can
  start in parallel
- **Phase 5 (Polish)**: Depends on all previous phases being complete

### User Story Dependencies

```
Phase 1 (Bug Fix) ─────────────────────────────────────────┐
Phase 2 (US1 - Drawer Profile) ────────────────────────────┤
Phase 3 (US2 - Bills Period Filter) ───────────────────────┼──▶ Phase 5 (Polish)
Phase 4 (US3 - Currency Equivalent) ───────────────────────┘
```

All user stories are **fully independent** — no cross-story dependencies. They
touch different files and different components.

### Within Each User Story

- Hook/data layer tasks before component/UI tasks
- Core implementation before edge case handling
- Manual verification as the final task

### Parallel Opportunities

- **T001 + T002**: Both in `usePeriodSummary.ts` — do together (same file)
- **T004 (useProfile) + T009-T013 (useRecurringPayments) + T019
  (useHistoricalRate)**: All hook tasks can run in parallel (different files)
- **T025 + T026**: Both barrel export updates can run in parallel
- **T027 + T028**: Type check and lint can run in parallel
- All 3 user stories can be worked on in parallel by different developers

---

## Parallel Example: All Hooks

```bash
# After Phase 1 (bug fix), all hooks can be created in parallel:
Task: "Create useProfile hook in apps/mobile/hooks/useProfile.ts"           # US1
Task: "Add dateRange to useRecurringPayments in apps/mobile/hooks/..."      # US2
Task: "Create useHistoricalRate hook in apps/mobile/hooks/..."              # US3
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 Only)

1. Complete Phase 1: Bug fix (#111) — 5 minutes
2. Complete Phase 2: Drawer profile (#109) — 30 minutes
3. **STOP and VALIDATE**: Test bug fix + drawer independently
4. This delivers the highest-visibility improvements first

### Incremental Delivery

1. Phase 1 → Bug fix done (immediate value)
2. Phase 2 → Real user data in drawer (biggest visual impact)
3. Phase 3 → Bills period filter (dashboard enhancement)
4. Phase 4 → Currency equivalent on cards (multi-currency UX)
5. Phase 5 → Polish and validate everything together

### Sequential Execution (Recommended for Solo Developer)

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Total estimated effort: ~2 hours

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
- **No schema changes** — all features use existing tables
- All new hooks follow the existing observer pattern from `usePreferredCurrency`

---

## Summary

| Metric                   | Value                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Total tasks              | 29                                                                                                                   |
| Phase 1 (Bug fix)        | 3 tasks                                                                                                              |
| Phase 2 (US1 - Drawer)   | 5 tasks                                                                                                              |
| Phase 3 (US2 - Bills)    | 10 tasks                                                                                                             |
| Phase 4 (US3 - Currency) | 6 tasks                                                                                                              |
| Phase 5 (Polish)         | 5 tasks                                                                                                              |
| New files                | 2 (`useProfile.ts`, `useHistoricalRate.ts`)                                                                          |
| Modified files           | 5 (`usePeriodSummary.ts`, `AppDrawer.tsx`, `useRecurringPayments.ts`, `UpcomingPayments.tsx`, `TransactionCard.tsx`) |
| Schema changes           | 0                                                                                                                    |
| Parallel opportunities   | 3 major groups (all hooks, all exports, lint+tsc)                                                                    |
