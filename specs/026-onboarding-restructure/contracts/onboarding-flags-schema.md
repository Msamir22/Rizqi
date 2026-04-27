# `profiles.onboarding_flags` JSON Schema Contract

**Feature**: 026-onboarding-restructure **Date**: 2026-04-23

Authoritative shape of the `profiles.onboarding_flags` JSONB column. Extensions
to the shape in future features MUST NOT remove or repurpose existing keys; only
additive changes are allowed.

---

## 1. TypeScript interface

```ts
// packages/db/src/types.ts

/**
 * Per-profile first-run tooltip dismissal markers.
 *
 * Stored as a JSONB column in Supabase (`profiles.onboarding_flags`) and as
 * a stringified JSON column in WatermelonDB. Accessed via the
 * `Profile.onboardingFlags` getter which parses the raw string.
 *
 * All keys are boolean and optional. Missing key ≡ `false` (i.e., not-yet-
 * dismissed). Once a key is set to `true`, it MUST never flip back to `false`
 * in normal operation.
 *
 * Keys added as new first-run prompts ship. Do not rename or remove existing
 * keys without a full data migration — existing rows with the old key would
 * silently lose their dismissal state.
 */
export interface OnboardingFlags {
  /** Set true on dismissal of the first-run cash-account tooltip (spec FR-017 step 2). */
  readonly cash_account_tooltip_dismissed?: boolean;

  /** Set true on first tap of the voice step's action button in the Setup
   *  Guide card — regardless of how the resulting mic-button tooltip is
   *  dismissed (Try it now OR X close). (spec FR-024a) */
  readonly voice_tooltip_seen?: boolean;
}
```

---

## 2. JSON Schema (for reference / future validation)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rizqi.app/schemas/onboarding_flags.v1.json",
  "title": "OnboardingFlags",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "cash_account_tooltip_dismissed": {
      "type": "boolean",
      "description": "Set true when the user dismisses the first-run cash-account tooltip."
    },
    "voice_tooltip_seen": {
      "type": "boolean",
      "description": "Set true on first tap of the voice step's action button."
    }
  }
}
```

**Note**: we do not enforce this JSON Schema at runtime today. If drift becomes
a concern, a Zod parser in `Profile.ts` getter is the logical place to add
validation.

---

## 3. Semantic contract

### 3.1 Missing keys

- Missing ≡ `false`. A row with `onboarding_flags = '{}'::JSONB` is treated
  identically to
  `'{"cash_account_tooltip_dismissed": false, "voice_tooltip_seen": false}'`.
- This allows adding new keys without backfilling existing rows.

### 3.2 Monotonicity

- Once `true`, never `false`. Callers (hooks + services) must never write
  `false`.
- The write service function signature enforces this:
  ```ts
  setOnboardingFlag<K extends keyof OnboardingFlags>(
    flagKey: K,
    value: NonNullable<OnboardingFlags[K]>
  ): Promise<void>;
  ```
  `NonNullable<boolean | undefined>` resolves to `boolean`, so TypeScript does
  allow `false` at the type level. Discipline is enforced in code review — no
  call site should write `false`.

### 3.3 Merge semantics

- Writes always **read-merge-write**, never **replace**. See `setOnboardingFlag`
  implementation in contracts/services.md §1.2.
- Concurrent writes across devices are resolved by WatermelonDB's
  Last-Write-Wins at the cell level. Because all writes are setting different
  keys (or the same key to `true`), outcomes are deterministic regardless of
  write order.

---

## 4. Example values

### 4.1 Fresh profile (just signed up, pre-Currency-step)

```json
{}
```

### 4.2 Just dismissed the cash-account tooltip

```json
{ "cash_account_tooltip_dismissed": true }
```

### 4.3 Also saw the mic tooltip (whether they tapped "Try it now" or X)

```json
{ "cash_account_tooltip_dismissed": true, "voice_tooltip_seen": true }
```

### 4.4 Fully "tooltip-completed" user

```json
{ "cash_account_tooltip_dismissed": true, "voice_tooltip_seen": true }
```

---

## 5. Extension policy

When adding a new first-run flag in a future feature:

1. **Add the key to `OnboardingFlags`** interface.
2. **Add a corresponding test** in `__tests__/hooks/useOnboardingFlags.test.ts`.
3. **Document the key's meaning** in this file (add a row to §1 and an example
   in §4).
4. **NO schema migration required** — Postgres JSONB absorbs new keys
   automatically.
5. Use `setOnboardingFlag("new_key", true)` via the same service function. Do
   NOT add a new per-key setter.

Anti-pattern: adding a key as part of a dismissal flow that might sometimes
un-dismiss the user. If the user can un-dismiss something, it's not a fit for
this column; use a dedicated profile column or state pattern.

---

## 6. Migration + Supabase details

### 6.1 Forward migration (`043_add_onboarding_flags_to_profiles.sql`)

```sql
-- Feature: 026-onboarding-restructure
-- Adds per-profile first-run tooltip dismissal markers as JSONB.
-- See specs/026-onboarding-restructure/contracts/onboarding-flags-schema.md
-- for the authoritative shape and semantic contract.

ALTER TABLE profiles
  ADD COLUMN onboarding_flags JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN profiles.onboarding_flags
  IS 'Per-profile first-run tooltip dismissal markers. Boolean keys added '
     'without schema migrations. See spec 026-onboarding-restructure.';
```

### 6.2 Backward migration (documented but not run automatically)

```sql
-- Only if we need to fully roll back.
ALTER TABLE profiles DROP COLUMN IF EXISTS onboarding_flags;
```

### 6.3 Existing rows behavior

Because Rizqi has no production users, there are no existing rows to worry
about. In test/staging environments, existing rows pick up the default
`'{}'::JSONB` atomically during the `ADD COLUMN`. No separate backfill script
needed.
