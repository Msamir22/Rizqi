# Implementation Plan: Logout Flow

**Branch**: `015-logout-flow` | **Date**: 2026-03-08 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/015-logout-flow/spec.md)
**Input**: Feature specification from `specs/015-logout-flow/spec.md`

## Summary

Implement a safe logout flow for signed-in users with: confirmation modal,
pre-logout data sync (with retry), WatermelonDB reset, fresh anonymous session
creation, and network guard. Hide logout from anonymous users. Update auth
banner messaging to generic "Connect Your Account" language.

## Technical Context

**Language/Version**: TypeScript (strict mode) **Primary Dependencies**: React
Native + Expo, Supabase Auth, WatermelonDB, NativeWind v4,
`@react-native-community/netinfo` (NEW) **Storage**: WatermelonDB (local),
Supabase (cloud), AsyncStorage (preferences) **Testing**: Jest + jest-expo
(`npm test` in `apps/mobile`) **Target Platform**: Android (primary), iOS
(secondary) **Project Type**: Mobile (monorepo: `apps/mobile`) **Constraints**:
Offline-first architecture, must sync before clearing data

## Constitution Check

| Principle                     | Status  | Notes                                                                          |
| ----------------------------- | ------- | ------------------------------------------------------------------------------ |
| I. Offline-First Data         | ✅ Pass | DB reset uses existing `unsafeResetDatabase()`. Sync runs before reset.        |
| II. Documented Business Logic | ✅ Pass | Logout behavior documented in spec. Will update business-decisions.md.         |
| III. Type Safety              | ✅ Pass | All new code will use strict types, no `any`.                                  |
| IV. Service-Layer Separation  | ✅ Pass | Logout orchestration in service layer (`logout-service.ts`), UI in components. |
| V. Premium UI                 | ✅ Pass | Uses existing `ConfirmationModal` with appropriate variant.                    |
| VI. Monorepo Boundaries       | ✅ Pass | Changes only in `apps/mobile`. No cross-package violations.                    |
| VII. Local-First Migrations   | ✅ Pass | No schema changes needed.                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/015-logout-flow/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── tasks.md             # Phase 2 output
└── spec.md              # Feature specification
```

### Source Code (files to modify/create)

```text
apps/mobile/
├── services/
│   └── logout-service.ts        # [NEW] Logout orchestration logic
├── constants/
│   └── storage-keys.ts          # [MODIFY] Add LOGOUT_IN_PROGRESS_KEY
├── context/
│   └── AuthContext.tsx           # [MODIFY] Enhanced signOut with logout service
├── components/
│   ├── navigation/
│   │   └── AppDrawer.tsx         # [MODIFY] Conditional logout visibility + confirmation modal
│   └── sign-up/
│       └── SignUpBanner.tsx      # [MODIFY] Generic "Connect Your Account" messaging
├── app/
│   ├── _layout.tsx              # [MODIFY] Force-close recovery check on launch
│   └── settings.tsx             # [MODIFY] Add logout button for signed-in users
├── __tests__/
│   └── services/
│       └── logout-service.test.ts  # [NEW] Unit tests for logout orchestration
└── package.json                 # [MODIFY] Add @react-native-community/netinfo
```

---

## Proposed Changes

### Component 1: Logout Service (Core Logic)

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Facade Pattern — `logout-service.ts` orchestrates multiple
>   subsystems (sync, DB, auth, storage)
> - **Why**: Single entry point for a multi-step process. Components call one
>   function, not five.
> - **SOLID Check**: SRP — service handles only the logout orchestration
>   sequence. OCP — each step is a separate function that can be modified
>   independently.

#### [NEW] [logout-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/logout-service.ts)

Creates a `performLogout` function that orchestrates the full logout sequence:

1. Set `@astik/logout-in-progress` flag in AsyncStorage
2. Check network connectivity via `NetInfo.fetch()`
3. If an active sync is already running (`activeSyncPromise`), await it first
4. Sync local data to server via `syncDatabase(db)` — retry once on failure
5. If sync fails after retry, return a sync-failure signal (let caller show
   warning modal)
6. Reset WatermelonDB via `resetSyncState(db)`
7. Clear user-specific AsyncStorage keys (sign-up prompt keys, SMS sync state)
8. Preserve `hasOnboarded` key
9. Call `supabase.auth.signOut()`
10. Call `supabase.auth.signInAnonymously()` to create a fresh session
11. Remove `@astik/logout-in-progress` flag

Also creates a `completeInterruptedLogout` function for force-close recovery:

1. Check for `@astik/logout-in-progress` flag
2. If present, run steps 5–10 above (skip sync since we can't guarantee state)

---

### Component 2: Storage Keys

#### [MODIFY] [storage-keys.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/constants/storage-keys.ts)

- Add `LOGOUT_IN_PROGRESS_KEY = "@astik/logout-in-progress"`
- Add `CLEARABLE_USER_KEYS` array listing all keys that should be cleared on
  logout (all `@astik/*` keys except the logout flag itself)

---

### Component 3: Auth Context

#### [MODIFY] [AuthContext.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/context/AuthContext.tsx)

- Keep the existing `signOut` callback as-is (simple `supabase.auth.signOut()`
  wrapper) — it remains available but the full logout flow uses `performLogout`
  from the service layer directly
- Remove two stray `debugger;` statements (lines 67, 78)

---

### Component 4: App Drawer

#### [MODIFY] [AppDrawer.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/navigation/AppDrawer.tsx)

- Import `useAuth` and read `isAnonymous`
- Conditionally render the Logout button only when `!isAnonymous`
- Import and use `ConfirmationModal` (warning variant, `log-out-outline` icon)
  for confirmation
- On confirm: call `performLogout(db)` from the logout service
- Handle sync-failure response: show second `ConfirmationModal` (warning
  variant) with "proceed anyway" option
- Add loading state during the sync+reset process

---

### Component 5: Settings Screen

#### [MODIFY] [settings.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/settings.tsx)

- Add a "Logout" row in the General section, conditionally visible only for
  non-anonymous users
- Style with red/destructive icon (`log-out-outline` in a red icon container)
- On tap: show same `ConfirmationModal` flow as the drawer
- Reuse the same logout handler logic

---

### Component 6: Sign-Up Banner

#### [MODIFY] [SignUpBanner.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sign-up/SignUpBanner.tsx)

- Change title from "Secure Your Account" to "Connect Your Account"
- Change subtitle from "Sign up to back up your data and access it from
  anywhere." to "Link your Google account to back up and sync your data across
  devices."

---

### Component 7: Force-Close Recovery

#### [MODIFY] [\_layout.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/_layout.tsx)

- Import `completeInterruptedLogout` from logout service
- Call it during app initialization (after database is ready) to handle
  force-close recovery
- Silent operation — no UI, just completes the interrupted cleanup

---

### Component 8: Dependencies

#### [MODIFY] [package.json](file:///e:/Work/My%20Projects/Astik/apps/mobile/package.json)

- Add `@react-native-community/netinfo` dependency for network connectivity
  check

---

## Verification Plan

### Automated Tests

#### Unit Tests: `logout-service.test.ts`

**Command**:
`cd apps/mobile && npx jest __tests__/services/logout-service.test.ts`

Test cases:

1. **Happy path**: `performLogout` calls sync → reset → clear keys → signOut →
   signInAnonymously in order
2. **Network check**: Returns error when `NetInfo.fetch()` reports no
   connectivity
3. **Sync retry**: If first `syncDatabase` fails, retries once; if retry
   succeeds, proceeds normally
4. **Sync failure after retry**: If both sync attempts fail, returns
   sync-failure signal without resetting DB
5. **Force-proceed after sync failure**: `performLogout` with
   `forceSkipSync: true` skips sync and proceeds with reset
6. **AsyncStorage cleanup**: Verifies sign-up prompt keys are cleared,
   `hasOnboarded` is preserved
7. **Force-close recovery**: `completeInterruptedLogout` completes reset when
   flag is present, does nothing when flag is absent
8. **Error handling**: If DB reset fails, session is still cleared (FR-008)

#### Existing Tests: `auth-service.test.ts`

**Command**:
`cd apps/mobile && npx jest __tests__/services/auth-service.test.ts`

Run existing auth tests to ensure no regressions from the `AuthContext` changes.

### Manual Verification

> These tests require a running Android device/emulator connected to the
> development server.

1. **Logout visibility (anonymous)**: Open the app as a fresh anonymous user →
   Open drawer → Verify "Logout" is NOT visible → Go to Settings → Verify
   "Logout" is NOT visible.

2. **Logout visibility (signed-in)**: Sign in with Google → Open drawer → Verify
   "Logout" IS visible with red styling → Go to Settings → Verify "Logout" IS
   visible.

3. **Logout flow**: As a signed-in user with some transactions → Tap Logout →
   Verify confirmation modal appears (warning style) → Tap Cancel → Verify
   nothing changed → Tap Logout again → Confirm → Verify app resets to empty
   anonymous state.

4. **Data preservation**: After logout → Verify onboarding is NOT shown (if
   previously completed) → Verify all previous transactions/accounts are gone.

5. **Re-authentication**: After logout → Use the "Connect Your Account" banner →
   Link same Google account → Verify data syncs back.

6. **Offline guard**: Disable network → Try to Logout → Verify error message
   appears and logout does not proceed.

7. **Banner messaging**: As any anonymous user → Go to Settings → Verify banner
   says "Connect Your Account" (not "Sign Up").

## Complexity Tracking

No constitution violations. No complexity justifications needed.
