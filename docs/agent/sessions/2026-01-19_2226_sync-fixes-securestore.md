# Session: Sync Fixes and SecureStore Integration

**Date:** 2026-01-19 **Time:** 01:00 - 22:26 **Duration:** ~2 hours
(intermittent)

---

## Summary

This session focused on fixing critical sync issues and integrating SecureStore
for auth session persistence. We resolved the WatermelonDB sync error caused by
incorrect `sendCreatedAsUpdated` configuration, implemented a force full sync
mechanism for when local data is cleared, and integrated `expo-secure-store` for
encrypted auth token storage. We also briefly implemented device ID recovery for
anonymous users but reverted it per user's decision that users who clear data do
so intentionally.

---

## What Was Accomplished

### Files Created

| File                                                         | Purpose                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `scripts/migrate-user-data.sql`                              | Reusable SQL script to migrate all user data between user IDs |
| `supabase/migrations/018_add_device_id_to_profiles.sql`      | Added device_id column (later reverted)                       |
| `supabase/migrations/019_remove_device_id_from_profiles.sql` | Removed device_id column                                      |

### Files Modified

| File                                     | Changes                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/services/sync.ts`           | Fixed sync to put all records in `updated` array when `sendCreatedAsUpdated: true`; Added `forceFullSync` parameter to `syncDatabase()` |
| `apps/mobile/providers/SyncProvider.tsx` | Added `ensureAuthenticated()` call on mount; Uses `sync(true)` for force full sync when DB is empty                                     |
| `apps/mobile/services/supabase.ts`       | Integrated SecureStore adapter for encrypted auth token storage                                                                         |
| `apps/mobile/package.json`               | Added `expo-secure-store` dependency                                                                                                    |

### Key Decisions Made

1. **Keep SecureStore over AsyncStorage:** SecureStore provides encryption for
   auth tokens (security best practice) and survives data clear on iOS. Same
   behavior as AsyncStorage on Android data clear, so no downside.

2. **No automatic data recovery for anonymous users:** Users who clear their app
   data do so intentionally. Instead of automatic recovery via device ID, the
   plan is to prompt users to create an account to secure their data.

3. **Force full sync on empty DB:** When local WatermelonDB is empty (after data
   clear), the sync now ignores `lastPulledAt` and fetches ALL data from server.

---

## Business Logic Changes

### Anonymous User Data Policy

- **What:** When a user clears their app data on Android, they lose their
  session and start fresh
- **Why:** Users who clear data intend to do so; automatic recovery would be
  unexpected behavior
- **How it affects the system:** No device ID tracking or automatic session
  recovery. Users are encouraged to create an account.
- **Future enhancement:** Implement signup prompts to encourage account creation
  before data loss

---

## Technical Details

### WatermelonDB Sync Fix

The sync was failing with
`[Sync] 'sendCreatedAsUpdated' option is enabled, and yet server sends some records as 'created'`.
Fixed by ensuring pullChanges always puts records in the `updated` array:

```typescript
changes[table] = {
  created: [], // Never use 'created' when sendCreatedAsUpdated is enabled
  updated: activeRecords,
  deleted,
};
```

### Force Full Sync Implementation

Added `forceFullSync` parameter to `syncDatabase()`:

```typescript
export async function syncDatabase(database: Database, forceFullSync = false): Promise<void> {
  // ...
  pullChanges: async ({ lastPulledAt }): Promise<SyncPullResult> => {
    const effectiveLastPulledAt = forceFullSync ? null : lastPulledAt;
    // ...
  },
}
```

### Auth Flow in SyncProvider

SyncProvider now calls `ensureAuthenticated()` on mount before attempting sync:

```typescript
const initialSync = async (): Promise<void> => {
  const isAuthed = await ensureAuthenticated();
  if (!isAuthed) return;

  await checkDataClearedAndSync(); // Uses sync(true) for force full
  await sync();
  setupSyncInterval(true);
};
```

---

## Pending Items

- [ ] Implement signup prompt to encourage account creation
- [ ] Test full sync after data clear end-to-end
- [ ] Consider adding visual indicator when force sync is in progress

---

## Context for Next Session

- The app now properly handles the "data cleared" scenario: creates new
  anonymous user, detects empty DB, triggers full sync
- SecureStore is integrated for auth - tokens are encrypted at rest
- The migrate-user-data.sql script is useful for transferring data between user
  IDs (during testing)
- Device ID recovery was fully implemented then reverted - the code patterns are
  in git history if needed later
