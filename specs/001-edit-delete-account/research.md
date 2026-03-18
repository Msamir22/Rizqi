# Research: Edit Account & Delete Account

**Date**: 2026-03-18 | **Branch**: `001-edit-delete-account`

## R1: WatermelonDB Cascade Delete Pattern

**Decision**: Use `database.write()` with batch `markAsDeleted()` on all related
records.

**Rationale**: WatermelonDB's `markAsDeleted()` sets `deleted = true`, which the
sync protocol picks up and propagates to Supabase. Using `destroyPermanently()`
would lose sync tracking. All related records (transactions, transfers,
bank_details, debts, recurring_payments) must be queried and individually marked
within a single write block for atomicity.

**Alternatives considered**:

- Supabase `ON DELETE CASCADE` — exists, but insufficient for offline-first
  (deletions must happen locally first)
- `destroyPermanently()` — rejected because sync adapter won't push the deletion
  to Supabase

## R2: Bottom Sheet Component

**Decision**: Use `@gorhom/bottom-sheet` (already a project dependency).

**Rationale**: Consistent with existing patterns. Provides snap points, gesture
handling, and backdrop overlay.

**Alternatives considered**:

- Custom modal with `react-native-reanimated` — rejected for inconsistency and
  development overhead

## R3: Account Name Uniqueness Check

**Decision**: Local WatermelonDB query with debounced inline validation (300ms).

**Rationale**: Offline-first requires local validation. Query is
`Q.where('name', name) + Q.where('currency', currency) + Q.where('user_id', userId) + Q.where('deleted', Q.notEq(true))`,
excluding current account ID. Debounced to avoid excessive queries on fast
typing.

**Alternatives considered**:

- Server-side unique constraint only — rejected because app must work offline
- No uniqueness — rejected by spec clarification Q2

## R4: Balance Adjustment Transaction Creation

**Decision**: Create transaction in the same `database.write()` block as the
account update.

**Rationale**: Ensures atomicity — if either operation fails, both are rolled
back. The category ID is resolved by querying for the system category name at
runtime.

**Alternatives considered**:

- Separate write blocks — rejected for consistency risk
- Hardcoded category IDs — rejected because IDs are auto-generated

## R5: Default Account Constraint

**Decision**: Partial unique index in PostgreSQL + client-side unset-previous
logic.

**Rationale**: Belt-and-suspenders approach. Client-side logic ensures smooth UX
(unset previous default atomically in the same write block). DB constraint
catches edge cases from multi-device sync.

**Alternatives considered**:

- Client-only logic — rejected because two devices could simultaneously set
  defaults
- DB trigger — over-engineering for this use case
