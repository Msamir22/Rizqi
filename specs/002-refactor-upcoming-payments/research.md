# Research: Refactor Upcoming Payments

**Branch**: `002-refactor-upcoming-payments` | **Date**: 2026-02-14

## Key Findings

### 1. Date Helper Duplication

**Decision**: Reuse existing `getDueText` and `getDaysUntil` from
`apps/mobile/utils/dateHelpers.ts` instead of the component's `formatDueDate`.

**Rationale**: `dateHelpers.ts` (lines 73-89) already has:

- `getDaysUntil(date)` → identical logic to the component's inline calculation
- `getDueText(date)` → identical output to `formatDueDate(daysUntilDue)`

The component's `formatDueDate` is a redundant copy. Remove it and import from
`dateHelpers.ts`.

**Alternatives considered**:

- Move `formatDueDate` as-is → Would create two similar functions in the same
  file
- Create a separate `recurring-date-helpers.ts` → Unnecessary fragmentation

### 2. `calculateNextDueDate` Placement

**Decision**: Move `calculateNextDueDate` to `apps/mobile/utils/dateHelpers.ts`.

**Rationale**: It's pure date arithmetic with no database or UI dependencies.
Fits alongside the existing date helpers. However, note that `dateHelpers.ts`
already has `getNextMonthSameDay` which handles one case (monthly). The new
`calculateNextDueDate` function handles all frequencies (daily, weekly, monthly,
quarterly, yearly), so it's a superset.

**Alternatives considered**:

- `packages/logic/` → Overkill; this function is mobile-specific (API has no
  need for next-due-date calculations)
- Inside `recurring-payment-service.ts` → Violates SRP; service should handle DB
  writes, not date math

### 3. `updateRecurringPaymentNextDueDate` Placement

**Decision**: Move to `apps/mobile/services/recurring-payment-service.ts`.

**Rationale**: This function does a WatermelonDB write (`database.write`). The
service file already has `createRecurringPayment` which follows the same
pattern. Adding an `updateNextDueDate` function alongside it keeps all recurring
payment DB operations in one service.

**Alternatives considered**:

- A new service file → Unnecessary; `recurring-payment-service.ts` is the
  natural home

### 4. TextField vs Dropdown in Pay Now Modal

**Decision**: Use `TextField` for the amount input. Use a custom styled
`TouchableOpacity` list for account selection (not `Dropdown`).

**Rationale**: The project's `TextField` component
(`components/ui/TextField.tsx`) wraps `TextInput` with label, error state, and
consistent theming — exactly what the amount field needs. For account selection,
a dropdown picker would add an external dependency; the current inline
expandable list is appropriate for the small number of accounts a user typically
has.

### 5. Commented-Out EmptyState Component

**Decision**: Remove the commented-out `EmptyState` component entirely.

**Rationale**: The spec already states "if no payments exist, the section should
not render at all" (current behavior). An empty state within the section
contradicts this design decision. Dead code should be removed per project rules.

### 6. No Unresolved Unknowns

All NEEDS CLARIFICATION markers from the spec have been resolved through the
`/speckit.clarify` workflow. No external research was needed since this is an
internal refactoring using existing project patterns and components.
