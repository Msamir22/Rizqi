# Feature Specification: Sync Snapshot Tables Locally

**Feature Branch**: `005-sync-snapshot-tables`  
**Created**: 2026-02-19  
**Status**: Draft  
**Input**: User description: "Bring daily snapshot tables into local
WatermelonDB sync, remove comparison API endpoint, replace API calls with local
queries, and restructure the breakdown JSONB column"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Net Worth Comparison Offline (Priority: P1)

A user opens the Monyvi app while offline (no internet) and views their
dashboard. They see a net worth comparison card showing how their net worth has
changed compared to last month. Previously, this required an API call to the
server which would fail offline. Now, the comparison data is available from the
local database.

**Why this priority**: This is the core motivation for the entire refactor. The
net worth comparison is a key dashboard feature, and it currently breaks the
app's offline-first guarantee.

**Independent Test**: Can be fully tested by opening the app in airplane mode
and verifying the net worth comparison card displays a percentage change.
Delivers immediate offline value.

**Acceptance Scenarios**:

1. **Given** a user with synced snapshot data, **When** they open the dashboard
   offline, **Then** the net worth comparison card displays the percentage
   change vs. last month
2. **Given** a user with no previous snapshot data (new user), **When** they
   view the dashboard, **Then** the comparison card handles the missing data
   gracefully (shows "No data" or similar)
3. **Given** a user whose data was recently synced, **When** a new daily
   snapshot is generated server-side and sync completes, **Then** the local
   comparison data updates automatically

---

### User Story 2 - Reactive Net Worth Updates (Priority: P2)

When new snapshot data is synced from the server, the dashboard updates
automatically without the user needing to refresh or re-open the app. This
leverages WatermelonDB's observable queries instead of the current manual API
fetch pattern.

**Why this priority**: Improves user experience by making data feel alive.
Depends on P1 being complete (tables must exist locally first).

**Independent Test**: Can be tested by triggering a sync while the dashboard is
open and observing the comparison card update in real-time.

**Acceptance Scenarios**:

1. **Given** a user viewing the dashboard, **When** a sync pulls new snapshot
   data, **Then** the UI reactively updates the net worth comparison without
   user interaction
2. **Given** a user viewing the dashboard, **When** sync fails or returns no new
   data, **Then** the existing comparison data remains displayed without errors

---

### User Story 3 - Simplified Architecture (Priority: P3)

The development team no longer needs to maintain a dedicated API endpoint for
net worth comparison. The comparison logic runs entirely on-device using local
data, reducing server load and code maintenance burden.

**Why this priority**: Developer experience improvement. Value is indirect
(reduced maintenance, fewer moving parts) rather than user-facing.

**Independent Test**: Can be verified by confirming the API route is removed,
the mobile service file is deleted or updated, and all comparison logic uses
local WatermelonDB queries.

**Acceptance Scenarios**:

1. **Given** the API codebase, **When** a developer looks for comparison
   endpoints, **Then** none exist (removed)
2. **Given** the mobile codebase, **When** a developer searches for API calls
   related to net worth comparison, **Then** none exist (replaced by local
   queries)

---

### Edge Cases

- What happens when the user has never had a snapshot (brand new account, no
  cron job has run yet)?
- How does the system handle the transition period when old API code is removed
  but the user hasn't synced yet?
- What happens if the snapshot tables grow very large (user active for 5+
  years)?
- How does sync handle the fact that snapshot rows can be re-written (updated
  via DELETE + INSERT pattern in the cron functions)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST sync the three snapshot tables
  (`daily_snapshot_balance`, `daily_snapshot_assets`,
  `daily_snapshot_net_worth`) from the cloud to the local device
- **FR-002**: Snapshot tables MUST be synced as read-only (pull from server,
  never push changes back)
- **FR-003**: System MUST NOT sync snapshot data older than 90 days to limit
  local storage usage
- **FR-004**: System MUST remove the API endpoint at `/api/net-worth/comparison`
- **FR-005**: System MUST replace the API-based comparison fetch with a local
  WatermelonDB query
- **FR-006**: System MUST calculate net worth percentage change locally using
  snapshot data
- **FR-007**: System MUST drop the `breakdown` JSONB column from
  `daily_snapshot_balance` and `daily_snapshot_assets` tables
- **FR-008**: System MUST add standard sync-compatible columns (`updated_at`,
  `deleted`, `snapshot_date`) to snapshot tables that are missing them
- **FR-009**: System MUST handle the case where no snapshot data exists locally
  (new user or pre-sync state) by displaying a graceful fallback
- **FR-010**: System MUST use `created_at`-based filtering for incremental sync
  (these tables use `created_at` instead of `updated_at` for data freshness)

### Key Entities _(include if feature involves data)_

- **Daily Snapshot Balance**: Captures the total of all account balances in EGP
  for a user on a given day. Key attributes: user, date, total balance in EGP.
- **Daily Snapshot Assets**: Captures the total of all asset (metal) valuations
  in EGP for a user on a given day. Key attributes: user, date, total assets in
  EGP.
- **Daily Snapshot Net Worth**: Combines balance and asset totals into a single
  net worth figure. Key attributes: user, date, total accounts, total assets,
  total net worth.

### Assumptions

- The daily cron job (`run_daily_snapshots`) will continue to generate snapshot
  data server-side. This refactor does not change data generation — only how
  it's consumed on the mobile client.
- The `breakdown` column is not used by any current mobile feature. The only
  current consumer of snapshot data is the net worth comparison card, which only
  reads the `total_net_worth` field. If per-account historical breakdowns are
  needed in the future, a separate detail table can be introduced at that time
  (YAGNI principle).
- A 90-day retention window for local snapshots covers all foreseeable
  comparison use cases (vs. last month, vs. last quarter).
- The `daily_snapshot_net_worth` table currently uses a `UNIQUE(user_id)`
  constraint with upsert — meaning it stores only ONE row per user (the latest
  snapshot). This will need to be changed to support historical data (one row
  per user per day) for meaningful comparisons.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Net worth comparison data is available offline within 1 second of
  opening the dashboard
- **SC-002**: Initial sync of snapshot data completes within the normal sync
  window (no noticeable slowdown)
- **SC-003**: The API endpoint `/api/net-worth/comparison` is removed, reducing
  API surface by one route
- **SC-004**: The `breakdown` JSONB column is removed, reducing per-row storage
  by approximately 50-80%
- **SC-005**: All existing net worth comparison functionality continues to work
  identically from the user's perspective
