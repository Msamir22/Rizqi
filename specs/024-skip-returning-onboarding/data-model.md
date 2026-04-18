# Phase 1 Data Model: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding` | **Date**: 2026-04-18

## Scope

This feature changes exactly one table's shape: `profiles`. No new tables. No
relationship changes. Two columns are added; one existing column is repurposed
as the routing gate.

## 1. `profiles` table — post-migration shape

Existing columns (unchanged by this feature):

| Column                  | Type                     | Nullable | Default | Notes                                                                                                               |
| ----------------------- | ------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `id` (PK)               | uuid                     | NO       | —       | Standard Supabase/Watermelon PK.                                                                                    |
| `user_id`               | uuid (FK → `auth.users`) | NO       | —       | RLS subject. Indexed.                                                                                               |
| `created_at`            | timestamptz              | NO       | `now()` | Sync envelope.                                                                                                      |
| `updated_at`            | timestamptz              | NO       | `now()` | Sync envelope.                                                                                                      |
| `deleted`               | boolean                  | NO       | `false` | Sync envelope (tombstone).                                                                                          |
| `display_name`          | text                     | YES      | NULL    | Out of scope.                                                                                                       |
| `first_name`            | text                     | YES      | NULL    | Out of scope.                                                                                                       |
| `last_name`             | text                     | YES      | NULL    | Out of scope.                                                                                                       |
| `avatar_url`            | text                     | YES      | NULL    | Out of scope.                                                                                                       |
| `preferred_currency`    | text                     | NO       | —       | Populated at Currency step. FR-009 makes it non-skippable at the product level; schema was already NOT NULL.        |
| `theme`                 | text                     | NO       | —       | Out of scope.                                                                                                       |
| `notification_settings` | jsonb                    | YES      | NULL    | Out of scope.                                                                                                       |
| `sms_detection_enabled` | boolean                  | NO       | `false` | Out of scope.                                                                                                       |
| `onboarding_completed`  | boolean                  | NO       | `false` | **Repurposed** as the single routing gate. Flips to `true` only when the user reaches the end of the flow (FR-011). |
| `setup_guide_completed` | boolean                  | NO       | `false` | Dashboard setup card — **out of scope** per FR-013.                                                                 |

**New columns added by this feature**:

| Column               | Type    | Nullable | Default | Purpose                                                                                                                                                                                                                                                                      |
| -------------------- | ------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preferred_language` | text    | YES      | NULL    | FR-007. Populated when the Language step is completed. Values constrained by the app layer to `'en'` or `'ar'` (current supported set). Used as (a) a per-step resume signal and (b) the startup i18n source for subsequent launches (replaces AsyncStorage `LANGUAGE_KEY`). |
| `slides_viewed`      | boolean | NO       | `false` | FR-008. Set to `true` when the user views or skips the onboarding carousel. Per-step resume signal.                                                                                                                                                                          |

### Constraints and checks

- `preferred_language`: No DB-level enum or check constraint; the
  product-supported set (`'en'`, `'ar'`) is enforced in `profile-service.ts`
  (Zod or TypeScript literal union). Rationale: keeps the migration minimal and
  allows future language additions without a schema change.
- `slides_viewed`: No check constraint needed; it's a pure boolean gate.
- `preferred_currency`: Existing NOT NULL constraint stays. It is still
  initially populated (to an app-provided default or first valid value) when the
  row is created via the `handle_new_user()` Supabase trigger — verify this
  during implementation. After the Currency step, the column reflects the user's
  chosen value.

### RLS (Row-Level Security)

No policy changes. The existing `profiles` policies (user can read/update their
own row) cover the new columns automatically.

### Indexes

No new indexes. The `user_id` index already supports the router's lookup.

---

## 2. State transitions for `profiles` relevant to this feature

Routing-relevant fields only:

```
                    ┌─────────────────────────────────────┐
                    │ Profile row created by trigger on   │
                    │ first successful sign-in            │
                    │                                     │
                    │ preferred_language     = NULL       │
                    │ slides_viewed          = false      │
                    │ preferred_currency     = <default>  │
                    │ onboarding_completed   = false      │
                    └──────────────┬──────────────────────┘
                                   │
                     Language step │ sets preferred_language = <en|ar>
                                   ▼
                    ┌─────────────────────────────────────┐
                    │ preferred_language     = 'en' | 'ar'│
                    │ slides_viewed          = false      │
                    │ preferred_currency     = <default>  │
                    │ onboarding_completed   = false      │
                    └──────────────┬──────────────────────┘
                                   │
                     Slides step   │ sets slides_viewed = true
                                   ▼
                    ┌─────────────────────────────────────┐
                    │ preferred_language     = 'en' | 'ar'│
                    │ slides_viewed          = true       │
                    │ preferred_currency     = <default>  │
                    │ onboarding_completed   = false      │
                    └──────────────┬──────────────────────┘
                                   │
                     Currency step │ sets preferred_currency = <user choice>
                                   │ + creates cash account
                                   ▼
                    ┌─────────────────────────────────────┐
                    │ preferred_language     = 'en' | 'ar'│
                    │ slides_viewed          = true       │
                    │ preferred_currency     = <choice>   │
                    │ onboarding_completed   = false      │
                    │ (cash account row exists)           │
                    └──────────────┬──────────────────────┘
                                   │
                     Cash-account  │ sets onboarding_completed = true
                     confirmation  │ (user taps "Got it")
                                   ▼
                    ┌─────────────────────────────────────┐
                    │ preferred_language     = 'en' | 'ar'│
                    │ slides_viewed          = true       │
                    │ preferred_currency     = <choice>   │
                    │ onboarding_completed   = true       │
                    └─────────────────────────────────────┘
                             Terminal state — routing gate returns "dashboard".
```

Each transition is driven by a function in `profile-service.ts`. Writes go
through WatermelonDB's `database.write()` and are synced to Supabase on the next
push-sync cycle.

---

## 3. Routing decision — pure function

Not a persisted entity; a planning artifact. The routing gate is a pure function
of four booleans plus the sync state:

```ts
type SyncState = "in-progress" | "success" | "failed" | "timeout";

interface RoutingInputs {
  readonly syncState: SyncState;
  readonly onboardingCompleted: boolean;
  readonly hasPreferredLanguage: boolean;
  readonly slidesViewed: boolean;
  readonly hasCashAccount: boolean; // cash account present ⇒ user confirmed currency (per FR-010)
}

type RoutingOutcome =
  | "loading"
  | "dashboard"
  | "language"
  | "slides"
  | "currency"
  | "cash-account-confirmation"
  | "retry";

function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome {
  if (inputs.syncState === "in-progress") return "loading";
  if (inputs.syncState !== "success") return "retry";
  if (inputs.onboardingCompleted) return "dashboard";
  if (!inputs.hasPreferredLanguage) return "language";
  if (!inputs.slidesViewed) return "slides";
  if (!inputs.hasCashAccount) return "currency";
  return "cash-account-confirmation";
}
```

**"User completed currency step" signal — DECIDED 2026-04-18: Option B
(cash-account presence)**.

Because `preferred_currency` is NOT NULL at the schema level and seeded by
`handle_new_user()`, we cannot use `preferred_currency IS NULL` as the "user
hasn't picked yet" signal. We use the **presence of a cash account row** as the
confirmation signal instead — cash accounts are only created after the user
confirms a currency (FR-010). This:

- Matches FR-010 directly (the account IS the side effect of the currency step).
- Avoids any dependency on `handle_new_user()` seeding behavior.
- Is straightforward to test (query `accounts` collection by user, filter by
  type=CASH).

The routing function therefore takes `hasCashAccount: boolean` rather than
`hasPreferredCurrency: boolean` — see `contracts/profile-service.ts`.

---

## 4. Validation rules sourced from requirements

| FR     | Validation rule                                                                          | Enforced where                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| FR-007 | `preferred_language` ∈ `{'en', 'ar'}` (current app support).                             | `profile-service.setPreferredLanguage()` TS type guard.                                                                                  |
| FR-008 | `slides_viewed` is a boolean; defaults to `false`.                                       | DB `NOT NULL DEFAULT false`.                                                                                                             |
| FR-009 | Currency step requires a non-null `preferred_currency` AND a corresponding cash account. | `profile-service.setPreferredCurrencyAndCreateCashAccount()` — atomic `database.write` that updates profile + calls `ensureCashAccount`. |
| FR-010 | Cash account must exist after currency step.                                             | Same function as FR-009.                                                                                                                 |
| FR-011 | `onboarding_completed` flips to `true` only on final confirmation dismissal.             | `profile-service.completeOnboarding()` — called only from `WalletCreationStep.onComplete`.                                               |
| FR-012 | Routing gate runs on every post-auth entry.                                              | `apps/mobile/app/index.tsx` (the gate). No caching of outcome.                                                                           |
| FR-013 | `setup_guide_completed` is untouched.                                                    | Code review; no writes to that column in any new service function.                                                                       |

---

## 5. Out-of-scope entities

The following entities are referenced by the feature but not modified:

- `accounts` — the cash account row is created via the existing
  `ensureCashAccount` helper. No schema change.
- `auth.users` — unchanged.
- All other tables — unchanged.

---

## 6. Migration file outline

File: `supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql`

```sql
ALTER TABLE profiles
  ADD COLUMN preferred_language TEXT NULL,
  ADD COLUMN slides_viewed BOOLEAN NOT NULL DEFAULT FALSE;

-- No index needed; no constraint needed (enum enforced at app layer).
-- RLS policies on profiles automatically cover the new columns.
```

Post-migration commands per Constitution VII:

1. `npm run db:push` (applies SQL to remote Supabase).
2. `npm run db:migrate` (regenerates `packages/db/src/schema.ts`,
   `supabase-types.ts`, `migrations.ts`, and `base-profile.ts`).
3. Commit the migration SQL and all regenerated files together.
