# Phase 1 Data Model: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding` | **Last rewritten**: 2026-04-18

## Scope

This feature changes exactly **one database table**: `profiles`. One new column
(`preferred_language`) is added, and one existing column
(`onboarding_completed`) has its semantic meaning pinned.

A new **Postgres enum** (`preferred_language_code`) is introduced to
type-constrain the language column.

All **per-step onboarding progress is tracked in AsyncStorage**, not the
database — see § 3.

## 1. `profiles` table — post-migration shape

Existing columns (unchanged by this feature):

| Column                                                     | Type                     | Nullable | Default | Notes                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (PK)                                                  | uuid                     | NO       | —       | Standard Supabase/Watermelon PK.                                                                                                      |
| `user_id`                                                  | uuid (FK → `auth.users`) | NO       | —       | RLS subject. Indexed.                                                                                                                 |
| `created_at`                                               | timestamptz              | NO       | `now()` | Sync envelope.                                                                                                                        |
| `updated_at`                                               | timestamptz              | NO       | `now()` | Sync envelope.                                                                                                                        |
| `deleted`                                                  | boolean                  | NO       | `false` | Sync envelope (tombstone).                                                                                                            |
| `display_name` / `first_name` / `last_name` / `avatar_url` | text                     | YES      | NULL    | Out of scope.                                                                                                                         |
| `preferred_currency`                                       | text                     | NO       | —       | Populated at Currency step. FR-009 makes it non-skippable at the product level; schema was already NOT NULL.                          |
| `theme`                                                    | text                     | NO       | —       | Out of scope.                                                                                                                         |
| `notification_settings`                                    | jsonb                    | YES      | NULL    | Out of scope.                                                                                                                         |
| `sms_detection_enabled`                                    | boolean                  | NO       | `false` | Out of scope.                                                                                                                         |
| `onboarding_completed`                                     | boolean                  | NO       | `false` | **Single source of truth for the routing gate**. Flips to `true` only when the user dismisses the cash-account confirmation (FR-011). |
| `setup_guide_completed`                                    | boolean                  | NO       | `false` | Dashboard setup card — **out of scope** per FR-013.                                                                                   |

**New column added by this feature**:

| Column               | Type                                      | Nullable | Default | Purpose                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preferred_language` | `preferred_language_code` (enum, see § 2) | **NO**   | `'en'`  | FR-007. Populated at the Language step. On subsequent launches, read locally and passed to the i18n `changeLanguage()` helper so the UI renders in the right language. Non-nullable so the app always has a valid language to use. |

### Removed from prior draft

- **`slides_viewed`** — removed. Per-step progress (including whether slides
  were viewed) lives in AsyncStorage, not the DB. See § 3.
- **Dedicated-vs-derived routing signal** — the earlier draft debated whether
  onboarding-completed was dedicated or derived from per-step signals.
  Simplified: only `onboarding_completed` (dedicated, authoritative) is on the
  server; per-step progress is a purely local concern.

### RLS (Row-Level Security)

No policy changes. The existing `profiles` policies (user can read/update their
own row) cover the new column automatically.

### Indexes

No new indexes. The `user_id` index already supports the router's lookup.

## 2. `preferred_language_code` Postgres enum

```sql
CREATE TYPE preferred_language_code AS ENUM ('en', 'ar');
```

- Values are **lowercase** to match the existing `apps/mobile/i18n` codebase
  (`changeLanguage('en')`, `i18n.language === 'ar'`).
- Adding new languages in the future requires
  `ALTER TYPE preferred_language_code ADD VALUE 'xx';` — not a concern right now
  but worth knowing.
- On the TypeScript side, `npm run db:migrate` auto-regenerates
  `packages/db/src/types.ts` to export
  `type PreferredLanguageCode = "en" | "ar"` (mirroring existing entries like
  `CurrencyType`). App code imports `PreferredLanguageCode` from `@monyvi/db` —
  no shadow union type is defined anywhere else. See research.md § 4 for the
  convention note.

## 3. Per-user onboarding cursor (AsyncStorage, not DB)

Per FR-008, the onboarding flow's per-step progress is tracked in AsyncStorage.
This is **not a database entity**; it is documented here because it is part of
the feature's data contract.

### Key format

```text
onboarding:<userId>:step
```

- `<userId>` is the authenticated user's `auth.users.id` (same value used
  elsewhere as `user_id`).
- Keying by userId isolates progress between different accounts signed in on the
  same device.

### Values

Exactly one of the following strings:

- `"language"` — next step is the Language picker (effectively the same as a
  missing key).
- `"slides"` — next step is the Slides carousel.
- `"currency"` — next step is the Currency picker.
- `"cash-account"` — next step is the Cash-account confirmation.

### Lifecycle

| Event                                             | AsyncStorage action                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User completes Language step                      | Write `onboarding:<userId>:step = "slides"`.                                                                                                                                                                                                                                                                  |
| User views or skips the Slides step               | Write `onboarding:<userId>:step = "currency"`.                                                                                                                                                                                                                                                                |
| User completes Currency step (picks a currency)   | Write `onboarding:<userId>:step = "cash-account"`.                                                                                                                                                                                                                                                            |
| User dismisses the Cash-account confirmation      | Set `profiles.onboarding_completed = true` via WatermelonDB, then best-effort `AsyncStorage.removeItem('onboarding:<userId>:step')`. The two stores are independent so this is **NOT atomic**; a stale cursor after a successful DB flag flip is harmless because the router reads the DB flag only (FR-011). |
| User signs out mid-flow                           | **Preserve** the key — if they sign back in as the same user before completing, they resume.                                                                                                                                                                                                                  |
| User taps "Sign out" on the retry screen (FR-006) | Not yet onboarded, so no cursor exists to clear. No-op.                                                                                                                                                                                                                                                       |

### Failure semantics

- Reading the cursor for a user key that does not exist MUST be treated as
  `"language"` (i.e., start at the first step). No error, no prompt.
- If an AsyncStorage write fails, the user continues through the flow for the
  current session; on next app launch they may resume at an earlier step than
  expected. This is acceptable — AsyncStorage writes rarely fail on modern
  platforms, and worst case the user repeats one step.

## 4. Routing decision — pure function

The routing gate in `apps/mobile/app/index.tsx` is now **binary**
(dashboard-or-onboarding), not a multi-step derivation. Resume logic lives
inside the onboarding screen itself.

```ts
type SyncState = "in-progress" | "success" | "failed" | "timeout";

interface RoutingInputs {
  readonly syncState: SyncState;
  readonly onboardingCompleted: boolean;
}

type RoutingOutcome =
  | "loading" // overlay shown, no navigation
  | "dashboard" // redirect to /(tabs)
  | "onboarding" // redirect to /onboarding
  | "retry"; // render RetrySyncScreen

function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome {
  if (inputs.syncState === "in-progress") return "loading";
  if (inputs.syncState !== "success") return "retry";
  return inputs.onboardingCompleted ? "dashboard" : "onboarding";
}
```

The onboarding screen is responsible for reading the per-user AsyncStorage
cursor and starting at the right phase; see FR-004.

## 5. Validation rules sourced from requirements

| FR     | Validation rule                                                                          | Enforced where                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-007 | `preferred_language` ∈ `{'en', 'ar'}`.                                                   | Postgres enum (authoritative) + `profile-service.setPreferredLanguage(language: PreferredLanguageCode)` — type imported from `@monyvi/db` (auto-generated).                                                                                                                                                                                                                    |
| FR-008 | AsyncStorage cursor value is one of the four named steps.                                | `onboarding-cursor-service.writeOnboardingStep()` accepts a typed `OnboardingStep` parameter.                                                                                                                                                                                                                                                                                  |
| FR-009 | Currency step requires a non-null `preferred_currency` AND a corresponding cash account. | `profile-service.setPreferredCurrencyAndCreateCashAccount()` — sequential (not atomic): one `database.write` updates the profile, then `ensureCashAccount` runs in its own inner writer. Wrapping both in a single outer writer causes a WatermelonDB deadlock, so they intentionally aren't atomic. The onboarding cursor stays at `"currency"` until this function resolves. |
| FR-010 | Cash account must exist after currency step.                                             | Same function as FR-009.                                                                                                                                                                                                                                                                                                                                                       |
| FR-011 | `onboarding_completed` flips to `true`; the cursor is cleared best-effort afterward.     | `profile-service.completeOnboarding()` — `database.write` flips the DB flag, then the AsyncStorage cursor removal runs in the same async function as a best-effort cleanup. If the cursor removal fails, log but do not rollback the DB write (a stale cursor is harmless because the router gate reads the DB flag only).                                                     |
| FR-012 | Routing gate runs on every post-auth entry.                                              | `apps/mobile/app/index.tsx` (the gate). No caching of outcome.                                                                                                                                                                                                                                                                                                                 |
| FR-013 | `setup_guide_completed` is untouched.                                                    | Code review; no writes to that column in any new service function.                                                                                                                                                                                                                                                                                                             |
| FR-015 | Legacy AsyncStorage keys deleted.                                                        | `apps/mobile/constants/storage-keys.ts` exports removed; all callers either deleted or migrated to the new key/DB.                                                                                                                                                                                                                                                             |

## 6. Out-of-scope entities

- `accounts` — the cash account row is created via the existing
  `ensureCashAccount` helper. No schema change.
- `auth.users` — unchanged.
- All other tables — unchanged.

## 7. Migration file outline

> **Note on migration history**: the feature actually shipped with two
> migrations (`040_add_language_and_slides_viewed_to_profiles.sql` and
> `041_refine_preferred_language_drop_slides_viewed.sql`, plus `042` for
> `preferred_currency`). The single-file outline below is the canonical
> "one-shot" version for a greenfield apply or a future squash. Match the
> defensive `DO $$ … EXCEPTION` pattern used throughout the real migrations so a
> re-run against an already-migrated environment doesn't fail.

File (canonical):
`supabase/migrations/NNN_add_preferred_language_to_profiles.sql`

```sql
-- Create the language enum (lowercase to match the existing i18n codebase).
-- Wrapped defensively so a re-run against an environment that already
-- applied this migration doesn't fail with SQLSTATE 42710.
DO $$
BEGIN
  CREATE TYPE preferred_language_code AS ENUM ('en', 'ar');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Add the column with the enum type. Non-nullable with a default so existing
-- rows get a valid value immediately and new signups inherit it. IF NOT EXISTS
-- makes the statement idempotent for the same reason as the DO block.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language preferred_language_code NOT NULL DEFAULT 'en';

-- RLS: no policy changes; the existing profiles policies cover the new column.
```

Post-migration commands per Constitution VII — local-first workflow:

1. Author the SQL under `supabase/migrations/NNN_*.sql` (local file, not via the
   Supabase dashboard or MCP).
2. `npm run db:migrate` — regenerates `packages/db/src/schema.ts`,
   `supabase-types.ts`, `migrations.ts`, and `base-profile.ts` from the new SQL.
3. Commit the migration SQL and all regenerated files together.

Remote deployment (`npm run db:push` against the linked Supabase project) is a
separate release step handled during merge/deploy — not part of the local spec
commands.

### WatermelonDB representation note

WatermelonDB represents Postgres enums as plain `string` columns client-side.
The `base-profile.ts` regeneration will produce
`@field("preferred_language") preferredLanguage!: string`. The narrower
`PreferredLanguageCode` union (imported from `@monyvi/db`) is enforced at the
service layer — callers cast from the raw `profile.preferredLanguage` only after
narrowing, typically at the top of `profile-service.setPreferredLanguage()` or
wherever the value is read before being passed to `changeLanguage()`.
