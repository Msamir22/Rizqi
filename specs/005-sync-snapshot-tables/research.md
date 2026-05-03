# Research: Sync Snapshot Tables Locally

**Branch**: `005-sync-snapshot-tables` | **Date**: 2026-02-19

## R1: Snapshot Table Schema — Current State vs Required State

**Decision**: Add `UNIQUE(user_id, snapshot_date)` constraint (missing on all 3
tables), drop `breakdown` JSONB column from balance/assets, and keep tables
without `updated_at`/`deleted` (use custom sync approach).

**Rationale**:

- Verified via Supabase MCP: no UNIQUE constraints exist on any snapshot table
  (the original ones from migration 002 were dropped by migration 009's schema
  overhaul).
- The cron function uses `ON CONFLICT (user_id, snapshot_date)` which depends on
  a UNIQUE constraint that no longer exists — this means upserts are actually
  inserting duplicate rows. The 13 rows for one user over 13 days confirms this
  is working by luck (no same-day duplicates yet).
- Without re-adding the constraint, the cron job could create duplicate rows if
  run multiple times in a day.
- Adding `updated_at` and `deleted` columns would conflict with the cron
  function's INSERT pattern. Instead, use a custom pull function similar to
  `pullMarketRates` that queries by `created_at`.

**Alternatives considered**:

1. Adding `updated_at`/`deleted` to comply with constitution's sync requirement
   — Rejected because these are server-generated read-only tables; adding
   soft-delete and update tracking adds complexity with zero benefit.
2. Keeping `breakdown` JSONB — Rejected because it bloats sync payloads, can't
   be queried in SQLite, and no current feature uses per-account/per-asset
   breakdown data.

## R2: Sync Strategy for Read-Only Server-Generated Tables

**Decision**: Implement `pullSnapshotTable()` function modeled after
`pullMarketRates()` — date-based cutoff (90 days), user-scoped, `created_at`
filtering for incremental sync.

**Rationale**:

- `pullMarketRates()` already solves the same problem: server-generated data, no
  `updated_at`/`deleted`, date-based retention.
- Key difference: snapshot tables are user-scoped (have `user_id`), so the pull
  function needs a `userId` parameter (unlike `pullMarketRates` which is
  global).
- The `pullChanges` router in `sync.ts` already has branching logic for
  specialized tables (`market_rates`, `categories`, child tables). Adding
  snapshot tables is just adding another branch.

**Alternatives considered**:

1. Using the standard `pullUserTable()` — Rejected because it requires
   `updated_at` column and `deleted` flag.
2. Custom sync outside WatermelonDB's `synchronize()` — Rejected because it
   would bypass WatermelonDB's conflict resolution and timestamp tracking.

## R3: WatermelonDB Model Generation for Snapshot Tables

**Decision**: Remove snapshot tables from `EXCLUDED_TABLES` in both
`transform-schema.js` and `sync.ts`, add table-to-class mappings, run
`npm run db:migrate` to auto-generate models and schema.

**Rationale**:

- `transform-schema.js` already handles `snapshot_date` in `TIMESTAMP_FIELDS`
  (line 69).
- The `breakdown` column won't exist after the migration drops it, so
  `JSON_FIELDS` doesn't need updating.
- The script generates base models (auto-generated) and extended models (only if
  missing), so new models will be created automatically.
- Need to add entries to `TABLE_TO_CLASS` mapping:
  `daily_snapshot_balance → DailySnapshotBalance`, etc.

## R4: Replacing the API-Based Comparison

**Decision**: Replace `useMonthlyPercentageChange` hook's API call with a local
WatermelonDB query against `daily_snapshot_net_worth`.

**Rationale**:

- Current flow: `(tabs)/index.tsx` → `useMonthlyPercentageChange()` →
  `getNetWorthComparison()` → API call → `/api/net-worth/comparison` → Supabase
  query.
- New flow: `(tabs)/index.tsx` → `useMonthlyPercentageChange()` → local
  WatermelonDB query (no API, no network).
- The `NetWorthComparison` interface in `@monyvi/logic` can be reused. The
  `getSameDayLastMonth()` helper is also reusable.
- `useMonthlyPercentageChange` currently depends on `useNetWorth` for loading
  state — this can be simplified since the local query is
  synchronous/observable.

## R5: Cron Function Fix – Missing UNIQUE Constraints

**Decision**: The migration must re-add `UNIQUE(user_id, snapshot_date)` on all
3 tables. Also, since the cron function on `daily_snapshot_net_worth` uses
`ON CONFLICT (user_id)` (from the original schema where it was unique per user),
it needs to be updated to `ON CONFLICT (user_id, snapshot_date)`.

**Rationale**:

- Migration 002 created `UNIQUE(user_id, snapshot_date)` on balance and assets
  tables.
- Migration 009 dropped these constraints during the schema overhaul.
- The cron function still uses `ON CONFLICT (user_id, snapshot_date)` for
  balance/assets — which silently fails to upsert without the constraint.
- For `daily_snapshot_net_worth`, migration 005 used `ON CONFLICT (user_id)`
  (one row per user), but migration 009 changed it to use `snapshot_date`. The
  function needs updating to match.
