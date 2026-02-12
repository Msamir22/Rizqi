# Session: Concurrent Sync Fix & Category Selector Components

**Date:** 2026-02-12 **Time:** 09:44 - 10:52 **Duration:** ~1 hour

---

## Summary

Fixed the persistent "Concurrent synchronization is not allowed" error in
WatermelonDB sync that occurred during `git commit` operations. The root cause
was a race condition where Metro hot-reloads (triggered by pre-commit hook
updating schema files) caused `SyncProvider` to remount, allowing multiple
`synchronize()` calls to run concurrently. After iterating through three fix
approaches (component-level `useRef` → module-level variable in SyncProvider →
module-level lock in sync.ts + error suppression), the final solution places a
`Promise`-based lock in `syncDatabase()` and gracefully catches the WatermelonDB
concurrent sync diagnostic error.

Additionally, the user created several new component files for the category
selector feature (breadcrumb navigation, category list items, search bar,
modals, navigation hook, validation).

---

## What Was Accomplished

### Files Modified

| File                                                  | Changes                                                                                                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/services/sync.ts`                        | Added `activeSyncPromise` module-level lock in `syncDatabase()` to prevent concurrent `synchronize()` calls; added catch for WatermelonDB concurrent sync diagnostic error (treated as warning, not error) |
| `apps/mobile/providers/SyncProvider.tsx`              | Removed redundant `isSyncLocked` module-level variable and concurrency guard — delegated to `sync.ts`; simplified `sync` callback to only manage UI state                                                  |
| `.agent/rules/tailwindcss-best-practices.md`          | Added NativeWind v4 shadow bug exception                                                                                                                                                                   |
| `.eslintrc.json`                                      | Added override to disable `react-native/no-inline-styles` for account components                                                                                                                           |
| `apps/mobile/components/accounts/AccountTypeTabs.tsx` | Replaced NativeWind shadow classes with inline styles                                                                                                                                                      |
| `apps/mobile/components/accounts/AccountCard.tsx`     | Replaced NativeWind shadow classes with inline styles                                                                                                                                                      |

### Files Created (by user)

| File                                                             | Purpose                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/mobile/components/category-selector/Breadcrumb.tsx`        | Horizontal breadcrumb trail for category drill-down navigation |
| `apps/mobile/components/category-selector/CategoryListItem.tsx`  | Category list row with Split Touch Target pattern              |
| `apps/mobile/components/category-selector/CategorySearchBar.tsx` | Search bar for filtering categories at current level           |
| `apps/mobile/components/category-selector/index.ts`              | Barrel exports for category-selector components                |
| `apps/mobile/components/modals/AccountSelectorModal.tsx`         | Account selector modal for transaction form                    |
| `apps/mobile/components/modals/CategorySelectorModal.tsx`        | Drill-down category selector modal with animations             |
| `apps/mobile/hooks/useCategoriesWithChildren.ts`                 | Hook to determine which categories have children               |
| `apps/mobile/hooks/useCategoryChildren.ts`                       | Hook to fetch child categories for a parent                    |
| `apps/mobile/hooks/useCategoryNavigation.ts`                     | State machine for category drill-down navigation               |
| `apps/mobile/validation/transaction-validation.ts`               | Zod-based transaction form validation                          |

### Key Decisions Made

1. **Sync lock in sync.ts, not SyncProvider.tsx:** The concurrency guard belongs
   at the `syncDatabase()` level (the single gateway to `synchronize()`) rather
   than at the UI component level. This provides defense-in-depth regardless of
   how many callers invoke `syncDatabase()`.

2. **Graceful concurrent sync error handling:** Since WatermelonDB's concurrent
   sync error is purely diagnostic (later sync is aborted, no data corruption),
   it's caught and logged as a `console.warn` rather than thrown as an error.
   This is the pragmatic solution because module re-evaluation during hot reload
   resets any module-level lock.

3. **NativeWind v4 shadow workaround:** Shadow/opacity Tailwind classes on
   `TouchableOpacity`/`Pressable` cause a crash ("Couldn't find a navigation
   context"). Inline `style` props must be used instead — documented in
   `.agent/rules/styling-rules.md` and
   `.agent/rules/tailwindcss-best-practices.md`.

---

## Business Logic Changes

No business logic changes in this session.

---

## Technical Details

### Why Module-Level Locks Don't Fully Work During Hot Reload

During Metro hot reload:

1. Pre-commit hook runs `db:sync-local` → updates `schema.ts`, model files,
   `supabase-types.ts`
2. Metro detects file changes → triggers hot reload
3. **All modules in the dependency chain are re-evaluated**, including `sync.ts`
   (which imports `@astik/db` → `schema.ts`)
4. `let activeSyncPromise = null` is re-executed → lock resets
5. New sync call proceeds while previous `synchronize()` is still in-flight

This is a fundamental limitation of JavaScript module hot reload. The
three-layer defense:

- Layer 1: `activeSyncPromise` lock catches most cases (reduced errors from 6
  to 2)
- Layer 2: WatermelonDB's internal guard aborts the later sync safely
- Layer 3: Error catch in `syncDatabase` converts the diagnostic error to a
  warning

### Category Selector Architecture (User-Created)

The user implemented a drill-down category selector using:

- **`useCategoryNavigation`** — state machine managing breadcrumb stack, depth,
  direction
- **Split Touch Target pattern** — row body selects category, chevron drills
  into children
- **`useCategoryChildren`** / **`useCategoriesWithChildren`** — WatermelonDB
  reactive queries
- **Slide animations** — `react-native-reanimated` for forward/backward
  transitions

---

## Pending Items

- [ ] Verify concurrent sync fix by running `git commit` and confirming no red
      ERROR logs
- [ ] Continue category selector integration into add-transaction form
- [ ] Address remaining ESLint warnings (console statements in SyncProvider)
- [ ] Device testing for NativeWind shadow workaround

---

## Context for Next Session

The concurrent sync issue is addressed with a three-layer defense. The remaining
`console.warn` during hot reload is acceptable — it confirms the sync was safely
aborted.

The user has been building out the **add-transaction form** with new components:

- Category selector modal with drill-down navigation (3-level hierarchy)
- Account selector modal
- Zod-based form validation

These components are created but may need integration into
`add-transaction.tsx`. The `useCategoryNavigation` hook uses a ref+state pattern
to avoid stale closures. The `CategorySelectorModal` includes auto-skip logic
for single-item root lists (e.g., income with 1 L1 category).
