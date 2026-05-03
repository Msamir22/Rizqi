# Tasks: Sync Snapshot Tables Locally

**Input**: Design documents from `/specs/005-sync-snapshot-tables/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅,
quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Database Migration

**Purpose**: Fix schema issues and prepare tables for local sync

- [x] T001 Create migration `supabase/migrations/025_sync_snapshot_tables.sql`:
      drop `breakdown` JSONB from `daily_snapshot_balance` and
      `daily_snapshot_assets`, add `UNIQUE(user_id, snapshot_date)` on all 3
      tables, update cron functions
- [x] T002 Apply migration to remote via `npm run db:push`

**Checkpoint**: Remote database has correct schema, cron functions updated

---

## Phase 2: WatermelonDB Schema Generation

**Purpose**: Generate local models and schema for snapshot tables

- [x] T003 [P] Remove snapshot tables from `EXCLUDED_TABLES` and add
      `TABLE_TO_CLASS` mappings in `scripts/transform-schema.js`
- [ ] T004 Regenerate Supabase types (`npx supabase gen types ...`)
- [ ] T005 Run `npm run db:migrate` to generate WatermelonDB schema, models, and
      local migrations
- [ ] T006 Verify generated models and exports in `packages/db/src/index.ts`

**Checkpoint**: WatermelonDB schema includes snapshot tables, models compile

---

## Phase 3: Sync Logic — Offline Net Worth (Priority: P1) 🎯 MVP

**Goal**: Snapshot data syncs to local device, enabling offline access

**Independent Test**: After sync, snapshot data is queryable from WatermelonDB

### Implementation

- [ ] T007 [US1] Remove `daily_snapshot_*` from `EXCLUDED_TABLES` in
      `apps/mobile/services/sync.ts`
- [ ] T008 [US1] Create `pullSnapshotTable()` function in
      `apps/mobile/services/sync.ts` (modeled after `pullMarketRates`,
      user-scoped, 90-day cutoff, `created_at` filtering)
- [ ] T009 [US1] Add routing in `pullChanges()` for snapshot tables →
      `pullSnapshotTable()` in `apps/mobile/services/sync.ts`
- [ ] T010 [US1] Add snapshot tables to push exclusion logic in
      `apps/mobile/services/sync.ts` (read-only, never push)

**Checkpoint**: Sync pulls snapshot data locally, no push attempted

---

## Phase 4: Local Query Replacement — Reactive UI (Priority: P2)

**Goal**: Replace API-based comparison with local WatermelonDB query

**Independent Test**: Home screen shows net worth percentage change offline

### Implementation

- [ ] T011 [US2] Rewrite `useMonthlyPercentageChange` in
      `apps/mobile/hooks/useNetWorth.ts` to query local
      `daily_snapshot_net_worth` using `getSameDayLastMonth()` and WatermelonDB
      observe pattern
- [ ] T012 [US2] Delete API service file `apps/mobile/services/net-worth.ts`

**Checkpoint**: Net worth comparison works offline from local data

---

## Phase 5: API Cleanup — Simplified Architecture (Priority: P3)

**Goal**: Remove server-side comparison endpoint and clean up contracts

### Implementation

- [ ] T013 [P] [US3] Delete API route file
      `apps/api/src/routes/net-worth-comparison.ts`
- [ ] T014 [US3] Remove `netWorthRouter` import and mount from
      `apps/api/src/index.ts`
- [ ] T015 [P] [US3] Clean up `NetWorthComparison` contract in
      `packages/logic/src/api/contracts.ts` if only used by deleted endpoint

**Checkpoint**: API compiles without net-worth comparison route

---

## Phase 6: Polish & Verification

**Purpose**: Cross-cutting validation

- [ ] T016 Run TypeScript compilation check:
      `npx nx run-many --target=typecheck --all`
- [ ] T017 Run ESLint check: `npx nx run-many --target=lint --all`
- [ ] T018 Manual verification: trigger sync, verify snapshot data pulled, check
      offline net worth comparison on home screen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Migration): No dependencies — start immediately
- **Phase 2** (Schema Gen): Depends on Phase 1 (migration applied)
- **Phase 3** (Sync Logic): Depends on Phase 2 (models exist)
- **Phase 4** (Local Query): Depends on Phase 3 (data available locally)
- **Phase 5** (API Cleanup): Depends on Phase 4 (API no longer used)
- **Phase 6** (Polish): Depends on all phases complete

### Parallel Opportunities

- T003 can run in parallel with T002 (different files)
- T013, T015 can run in parallel (different files)

---

## Implementation Strategy

### Sequential Execution (Solo Developer)

1. Phase 1 → Phase 2 → Phase 3 → **VALIDATE: sync works offline**
2. Phase 4 → **VALIDATE: comparison works locally**
3. Phase 5 → Phase 6 → **FINAL VALIDATION**

---

## Notes

- Snapshot tables are **read-only** — never pushed to server
- Custom sync uses `created_at` instead of `updated_at` (tables lack
  `updated_at`)
- 90-day data retention locally (matching market_rates pattern)
- `NetWorthComparison` interface in `@monyvi/logic` is reused
