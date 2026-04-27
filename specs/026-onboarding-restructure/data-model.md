# Phase 1 — Data Model: Onboarding Restructure

**Feature**: 026-onboarding-restructure **Date**: 2026-04-23

This document specifies every persisted and in-memory data structure the feature
reads, writes, or introduces.

## 1. `profiles` table (schema changes)

### 1.1 Column additions

| Column             | Type (Supabase) | Type (WatermelonDB)         | Nullable | Default       | Notes                                                                                                              |
| ------------------ | --------------- | --------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `onboarding_flags` | `JSONB`         | `string` (stringified JSON) | NOT NULL | `'{}'::JSONB` | New in migration 043. Holds per-profile first-run tooltip dismissal markers. Keys added without schema migrations. |

### 1.2 Columns unchanged (referenced)

| Column                                                                        | Purpose in this feature                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id` (UUID)                                                              | Profile scoping for queries.                                                                                                                                                                                                                                               |
| `preferred_currency` (enum `currency_type`, NOT NULL, DEFAULT 'EGP')          | Set atomically during Currency confirmation (FR-014). **NOT a routing signal** — the column is `NOT NULL DEFAULT 'EGP'`, so it always carries a value and cannot distinguish "never onboarded" from "chose EGP." DB-level enum prevents invalid values (clarification Q5). |
| `preferred_language` (enum `preferred_language_code`, NOT NULL, DEFAULT 'en') | Overwritten atomically during Currency confirmation (FR-014 step c) with the user's currently-active app language. Persisted value wins on subsequent sign-ins (FR-011).                                                                                                   |
| `onboarding_completed` (BOOLEAN, NOT NULL, DEFAULT false)                     | **Primary routing signal** (FR-012, FR-031, FR-033). Starts `false`, flipped to `true` atomically inside the Currency-confirmation write. Consumed by the existing routing gate (unchanged by this feature).                                                               |
| `setup_guide_completed` (BOOLEAN, NOT NULL, DEFAULT false)                    | Existing — tracks OnboardingGuideCard dismissal. Used by `useOnboardingGuide`.                                                                                                                                                                                             |
| `sms_detection_enabled` (BOOLEAN, NOT NULL, DEFAULT false)                    | Existing — tracks SMS auto-import state. Used by `useOnboardingGuide` completion rule for the SMS step.                                                                                                                                                                    |

### 1.3 Columns previously deprecated

- `slides_viewed` — **already dropped by migration 041** (feature 024). FR-032
  is a no-op.

### 1.4 WatermelonDB schema version

- Current version: `16`
- New version: **`17`** (bumped for `onboarding_flags` column addition).
- Migration entry in `packages/db/src/migrations.ts`:
  ```ts
  {
    toVersion: 17,
    steps: [
      addColumns({
        table: "profiles",
        columns: [
          { name: "onboarding_flags", type: "string", isOptional: false },
        ],
      }),
    ],
  },
  ```
  Note: WatermelonDB `addColumns` requires defaulting; since we declare
  `isOptional: false`, the `Profile.onboardingFlags` getter returns `{}` when
  `onboardingFlagsRaw` is falsy/empty. Existing rows get an empty string as the
  default on column add; that parses fine to the `{}` fallback.

### 1.5 RLS (Row-Level Security)

- `profiles` RLS policies are unchanged. The existing `user_id = auth.uid()`
  policy covers all reads/writes to the new column.

## 2. `onboarding_flags` JSONB schema (application-level contract)

### 2.1 Shape

```ts
// packages/db/src/types.ts
export interface OnboardingFlags {
  /** Set to true when the user dismisses the first-run cash-account tooltip on the dashboard (FR-017 queue step 2). One-way — never reset. */
  readonly cash_account_tooltip_dismissed?: boolean;
  /** Set to true on the FIRST tap of the voice step's action button, regardless of how the tooltip is dismissed (Try it now OR X). One-way — never reset. (FR-024a / FR-024b) */
  readonly voice_tooltip_seen?: boolean;
  // Future tooltip/first-run flags added here without schema changes.
}
```

### 2.2 Semantic rules

- **Missing key ≡ `false`**: a key that doesn't appear in the JSON is treated as
  not-yet-dismissed. `cash_account_tooltip_dismissed === undefined` means
  "tooltip has not been dismissed" — show it.
- **One-way semantics**: once a flag is set to `true`, it is NEVER set back to
  `false` in normal operation. No code path should reset these flags.
- **Merge semantics**: when updating the JSONB column, service writes read the
  current object, merge the new key, and write the result. Never overwrite with
  a partial object.

### 2.3 Default value

- New rows get `'{}'::JSONB` at the Supabase level.
- Existing rows at migration time (no production users per our assumption) —
  migration should backfill to `'{}'` for safety:
  ```sql
  ALTER TABLE profiles
    ADD COLUMN onboarding_flags JSONB NOT NULL DEFAULT '{}'::JSONB;
  -- The NOT NULL + DEFAULT clause handles existing rows atomically.
  ```

## 3. AsyncStorage key catalogue

### 3.1 New keys

| Key                            | Value shape                 | Scope  | Persisted across logout?                                      | Purpose                                                                                                                                                                                                                                                                    |
| ------------------------------ | --------------------------- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@rizqi/intro-seen`            | `"true"` or missing         | Device | Yes                                                           | Set once the user completes OR explicitly skips the pre-auth pitch (FR-005).                                                                                                                                                                                               |
| `@rizqi/intro-locale-override` | `"en"` \| `"ar"` \| missing | Device | Yes (NOT cleared on sign-up, sign-out, or any event — FR-030) | Set whenever the user changes language via the shared `LanguageSwitcherPill` (pitch, auth, or Currency step). Read by `initI18n()` at startup before any screen renders (FR-002) and by `confirmCurrencyAndOnboard` indirectly via `getCurrentLanguage()` (FR-014 step c). |

### 3.2 Keys unchanged (referenced)

| Key                         | Purpose                                 | Notes                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@rizqi/first-use-date`     | First-launch timestamp                  | Unchanged.                                                                                                                                                                                                  |
| `@rizqi/logout-in-progress` | Logout recovery                         | Unchanged.                                                                                                                                                                                                  |
| `onboarding:<userId>:step`  | Legacy per-step cursor from feature 024 | **Deprecated** by this feature. No new writes. Reads may still exist in `onboarding-cursor-service.ts` — drop during impl (see plan §Operational Notes). Existing values on device are harmless (not read). |

### 3.3 Storage key constants

```ts
// apps/mobile/constants/storage-keys.ts (additions)
export const INTRO_SEEN_KEY = "@rizqi/intro-seen";
export const INTRO_LOCALE_OVERRIDE_KEY = "@rizqi/intro-locale-override";

// NOTE: these are NOT added to CLEARABLE_USER_KEYS — intentionally device-scoped.
```

## 4. In-memory state (React context / session flags)

### 4.1 `FirstRunTooltipContext`

```ts
interface FirstRunTooltipContextValue {
  /** True when the user has just confirmed their currency in the current session
   *  and is transitioning to the dashboard. Consumed (and cleared) by CashAccountTooltip. */
  readonly isFirstRunPending: boolean;
  /** Sets isFirstRunPending to true. Called by the Currency step's confirm handler
   *  (via the `onTransactionCommitted` callback passed to `confirmCurrencyAndOnboard`)
   *  before navigating to the dashboard. */
  readonly markFirstRunPending: () => void;
  /** Sets isFirstRunPending to false. Called by CashAccountTooltip once the user
   *  dismisses it (or when the SMS-prompt gating never clears because the user
   *  navigated away). */
  readonly markFirstRunConsumed: () => void;
}
```

- Provider lives near the root of the app (`_layout.tsx` or a dedicated
  wrapper).
- Default value: `isFirstRunPending: false`.
- State is per-session: lost on app restart. If the user crashes between pending
  and consumed, they miss the first-run tooltips — acceptable edge case (they're
  already onboarded, tooltips are educational only).

## 5. Routing gate input/output contract

### 5.1 Contract (unchanged by this feature)

```ts
// apps/mobile/utils/routing-decision.ts (unchanged — shipped with #226)
interface RoutingInputs {
  readonly syncState: InitialSyncState;
  readonly onboardingCompleted: boolean;
}

type RoutingOutcome = "loading" | "dashboard" | "onboarding" | "retry";

function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome {
  if (inputs.syncState === "in-progress") return "loading";
  if (inputs.onboardingCompleted) return "dashboard";
  if (inputs.syncState !== "success") return "retry";
  return "onboarding";
}
```

### 5.2 Rationale for keeping `onboardingCompleted`

- `preferred_currency` CANNOT be used as the routing signal: it's a
  `currency_type NOT NULL DEFAULT 'EGP'` enum column (migration 042), so it
  always carries a value on a fresh profile. It cannot distinguish "never
  onboarded" from "legitimately chose EGP."
- `onboarding_completed` starts `false` on insert and is flipped `true`
  atomically inside the Currency-confirmation write (FR-014 step d). It IS the
  only reliable signal.
- The existing routing-gate behavior from #226 is correct for this feature. **No
  changes to `routing-decision.ts` are needed.**

### 5.3 What this feature DOES change around the router

- The Currency-confirmation service (`confirmCurrencyAndOnboard` in
  `profile-service.ts`) MUST flip `onboarding_completed = true` inside the same
  atomic write that sets `preferred_currency`, creates the cash account, and
  writes `preferred_language`. (See `contracts/services.md §1.`)
- Nothing else in the routing pipeline is modified.

## 6. Entity relationships (existing, for reference)

```text
auth.users (Supabase Auth — out of scope)
    │  (1:1)
    │
profiles ──── onboarding_flags JSONB (added here)
    │
    │  (1:N — foreign key user_id)
    │
accounts (cash account auto-created during Currency confirmation)
    │
    │  (1:N)
    │
transactions (voice / SMS / manual; feeds OnboardingGuideCard completion rules)

profiles ── budgets (1:N; feeds OnboardingGuideCard "Set a budget" completion)
```

## 7. State transitions

### 7.1 `profile.onboarding_completed` lifecycle (routing signal)

```text
false (default on row insert, set by handle_new_user trigger)
  │
  │ User confirms currency in Currency step
  ↓ (atomic write — same DB transaction as cash account create,
  │                  preferred_currency write, and preferred_language overwrite)
true (locked-in; routing gate reads this on every subsequent launch)
```

### 7.1a `profile.preferred_currency` lifecycle (not a routing signal)

```text
'EGP' (default on row insert — NOT NULL DEFAULT 'EGP')
  │
  │ User confirms currency in Currency step (may be same value 'EGP' or different)
  ↓ (atomic write with onboarding_completed = true)
CurrencyType (locked in; may change via Settings later — out of scope for this feature)
```

### 7.2 `profile.onboarding_flags` lifecycle

```text
{} (initial)
  │
  │ User dismisses cash-account tooltip
  ↓
{ cash_account_tooltip_dismissed: true }
  │
  │ User taps voice step's action button (first time)
  ↓
{ cash_account_tooltip_dismissed: true, voice_tooltip_seen: true }
```

Flags are never removed once set. The merge is additive only.

### 7.3 `@rizqi/intro-seen` lifecycle

```text
missing (fresh install)
  │
  │ User taps Skip on any slide OR reaches and exits last slide
  ↓
"true" (persists across app restarts + logout + sign-in with a different account)
```

### 7.4 `@rizqi/intro-locale-override` lifecycle

```text
missing (first launch on device — use device locale)
  │
  │ User taps language switcher (on pitch, auth, or Currency step) and changes language
  ↓
"en" or "ar" (persists across app restarts; read by initI18n() at startup before
              any screen renders, so no language-flash after an RTL reload)
  │
  │ User confirms currency during onboarding
  │
  ↓ (atomic write consumes getCurrentLanguage() which already reflects the override)
  │ profile.preferred_language is overwritten with the currently-active app language
  │
  │ intro-locale-override is NOT cleared — it persists indefinitely as a
  │ device-level language preference (FR-030). Subsequent users on this
  │ device inherit it but can change it via the switcher on any pre-auth surface.
```

Note: because the column `profiles.preferred_language` is
`NOT NULL DEFAULT 'en'`, it always has a value. The override does not need to be
gated on nullness; the Currency confirmation write overwrites
`preferred_language` unconditionally (FR-014 step c).

## 8. Validation & invariants

### 8.1 Feature-level invariants

1. **Routing invariant**:
   `profile.onboarding_completed === true ⟹ at least one non-deleted cash account exists for that user AND profile.preferred_currency is set AND profile.preferred_language is set`.
   Enforced by the atomic write in `confirmCurrencyAndOnboard` — all four
   mutations commit in a single WatermelonDB `database.write()` or none do
   (research §1). Violated states are not reachable through normal code paths.

2. **Flag monotonicity**: `profile.onboarding_flags[key] === true` once set,
   never flips back to false. Enforced by writing a merged object (never a
   replacement that could omit keys). See contracts/services.md for the write
   helper.

3. **Session-scoped first-run trigger**:
   `FirstRunTooltipContext.isFirstRunPending` is set exactly once per Currency
   confirmation and cleared when the queue finishes. Never re-set for
   already-onboarded users.

### 8.2 Zod schemas (runtime validation)

No new Zod schemas are required for this feature:

- `onboarding_flags` is our own write — we trust TypeScript typing within the
  app.
- Supabase auth payloads are validated by existing schemas in the auth flow.
- i18n resource validation is handled by existing
  `validateTranslationResources()`.

### 8.3 DB constraints

- `onboarding_flags` has `NOT NULL DEFAULT '{}'::JSONB` — prevents null-parsing
  errors on the client.
- No CHECK constraint on the JSONB shape (Postgres can validate JSON shape via
  CHECK constraints but the cost/benefit isn't worth it for a schema-less
  scalable column).

## 9. Sync behavior

- `profiles.onboarding_flags` is part of the profile row — it syncs via the
  existing profile sync pipeline. No new sync configuration is needed.
- Writes happen locally first (WatermelonDB), then sync to Supabase on the
  existing cadence (non-blocking, Constitution I).
- **Conflict resolution**: Last Write Wins at the cell level via WatermelonDB's
  sync protocol. A user signing in on two devices who dismisses a tooltip on
  each device produces a merged state — but because the merge happens
  server-side via `updated_at`, only the most recent write is kept. This is
  fine: both writes set the same flag to `true`, and the "true" value is
  idempotent.

## 10. Migration artifact summary

### 10.1 Files created/modified

- **NEW**: `supabase/migrations/043_add_onboarding_flags_to_profiles.sql`
- **REGENERATED** (by `npm run db:migrate`):
  - `packages/db/src/schema.ts` (schema version 17)
  - `packages/db/src/supabase-types.ts`
  - `packages/db/src/models/base/base-profile.ts`
- **MODIFIED MANUALLY**:
  - `packages/db/src/migrations.ts` (add step for version 17)
  - `packages/db/src/models/Profile.ts` (add `onboardingFlags` getter)
  - `packages/db/src/types.ts` (add `OnboardingFlags` interface)

### 10.2 Migration commit order

1. Write migration SQL file.
2. Run `npm run db:migrate` (or `npm run db:sync-local` if remote is already in
   sync).
3. Manually add `migrations.ts` entry for version 17.
4. Manually add `Profile.onboardingFlags` getter + `OnboardingFlags` type.
5. Commit migration file + regenerated schema + manual model/type changes
   together.
