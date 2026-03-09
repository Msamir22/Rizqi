# Research: Logout Flow

**Feature**: 015-logout-flow **Date**: 2026-03-08

## R1: WatermelonDB Reset Strategy

**Decision**: Use `database.unsafeResetDatabase()` wrapped in `db.write()` —
already implemented as `resetSyncState()` in `sync.ts`. **Rationale**: This
method clears all tables AND sync metadata (lastPulledAt), which is exactly what
we need. After reset, the next sync will be a full sync from the server for the
re-authenticated user. **Alternatives considered**:

- Manual table deletion: Too fragile, misses sync metadata.
- `database.adapter.unsafeResetDatabase()`: Lower-level, same outcome but no
  write lock.

## R2: Network Connectivity Check

**Decision**: Install `@react-native-community/netinfo` and use
`NetInfo.fetch()` to check connectivity before logout. **Rationale**: No network
check utility currently exists in the project. NetInfo is the standard React
Native library for this purpose. We only need a one-time check (not a
subscription). **Alternatives considered**:

- `fetch()` ping to Supabase: Unreliable edge case handling, timeout issues.
- Skip network check: Violates FR-009 — user could lose unsynced data.

## R3: Sync-Before-Logout Strategy

**Decision**: Call `syncDatabase(db)` before reset. The existing lock
(`activeSyncPromise`) prevents concurrent syncs. If sync is already running,
await the existing promise. Implement retry-once on failure, then warn via
`ConfirmationModal`. **Rationale**: `syncDatabase()` already handles push+pull
with error handling. The sync lock ensures no concurrent sync corruption.
**Alternatives considered**:

- Push-only sync: Would miss pulling latest server data, but this isn't needed
  pre-logout since we're about to delete local data anyway. Push-only would be
  faster but WatermelonDB's `synchronize()` is atomic push+pull. Stick with full
  sync for simplicity.

## R4: AsyncStorage Keys to Clear vs Preserve

**Decision**:

- **Clear on logout**: All `@astik/*` prefixed keys (sign-up prompt dismissal,
  cooldown state), preferred currency, SMS sync state.
- **Preserve on logout**: `hasOnboarded` (device-level, not user-level).
  **Rationale**: The `hasOnboarded` key represents device onboarding, not user
  onboarding. A user who logs out on the same device shouldn't be forced through
  onboarding again.

## R5: Anonymous Session Post-Logout

**Decision**: After `supabase.auth.signOut()`, call
`supabase.auth.signInAnonymously()` to create a fresh anonymous session. The
`AuthContext` `onAuthStateChange` listener will pick up the new session
automatically. **Rationale**: The app's architecture requires an authenticated
session at all times (anonymous or permanent). Without creating a new anonymous
session, the app would be in an unauthenticated state.

## R6: ConfirmationModal Usage

**Decision**: Use existing `ConfirmationModal` component with `warning` variant
and `log-out-outline` icon for the logout confirmation. Use a second
`ConfirmationModal` (warning variant) for the sync-failure warning.
**Rationale**: The component already supports the required variants and is
reused across the app (e.g., full rescan confirmation in settings).

## R7: Logout-In-Progress Flag Recovery

**Decision**: Set `@astik/logout-in-progress` in AsyncStorage before starting
the logout sequence. Check on app launch in `_layout.tsx`. If set, complete
cleanup (reset DB, clear session). **Rationale**: Simple and reliable. The flag
is removed at the end of the logout sequence. If the app is force-closed, the
flag persists and triggers cleanup on next launch.
