# Phase 0 Research: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding` | **Last rewritten**: 2026-04-18

This document records the investigations behind the design decisions in
`plan.md` and `data-model.md`. No `[NEEDS CLARIFICATION]` markers remain.

---

## 1. Current onboarding gate — where and how it decides

**Decision**: The routing gate lives at `apps/mobile/app/index.tsx`. It
currently reads `HAS_ONBOARDED_KEY` from AsyncStorage and redirects to `/(tabs)`
if `"true"`, otherwise to `/onboarding`. It does NOT consult
`profiles.onboarding_completed` on the server or via WatermelonDB.

**Rationale**: Code inspection confirms the gate is AsyncStorage-only.
`apps/mobile/app/index.tsx` lines 15-59 read the key and redirect immediately
without awaiting sync.

`HAS_ONBOARDED_KEY` is written in a single place — `onboarding.tsx`
`handleCarouselFinish` — after the user finishes the slides carousel (not after
the cash-account confirmation, which is the actual end of the flow). The legacy
flow therefore flips its flag at the wrong step; the new flow corrects this.

**Alternatives considered and rejected**:

- **Keep AsyncStorage as the gate + add a server write alongside**: Rejected
  because it preserves the reinstall/new-device bug (empty local storage → user
  sees onboarding again even though their server profile says they're done).
  This is exactly what issue #226 reports.
- **Use a dedicated React Query hook against Supabase REST**: Rejected because
  it bypasses WatermelonDB and creates a second source of truth for profile
  data. The constitution makes WatermelonDB the single source of truth.

---

## 2. Is the initial pull-sync blocking the routing decision today?

**Decision**: **No, it is not.** `SyncProvider` runs `initialSync()` in a
`useEffect` on mount once authenticated. It sets `isInitialSync: true` when
local `accounts` collection is empty and triggers a `forceFullSync`.
`InitialSyncOverlay` consumes that state to render a fullscreen loader. However,
`apps/mobile/app/index.tsx` runs its AsyncStorage check and `<Redirect />`
independently and immediately — it does **not** await `lastSyncedAt` or
`isInitialSync`. The overlay hides the UI but does not gate routing state.

**Rationale**: Read `apps/mobile/providers/SyncProvider.tsx` lines 151-193 and
`apps/mobile/app/index.tsx` lines 25-58. The `isReady` state in `index.tsx` only
tracks whether the AsyncStorage read completed — not whether the sync resolved.

**Implications for this feature**:

- The implementation must add a **blocking-on-initial-sync** state to
  `SyncProvider` that `index.tsx` can await. Two viable designs:
  1. **Promise-based**: `SyncProvider` exposes a
     `initialSyncPromise: Promise<'success' | 'failed' | 'timeout'>` that
     resolves once. `index.tsx` awaits it before rendering its redirect.
  2. **State-based**: extend `SyncContextValue` with
     `initialSyncState: 'in-progress' | 'success' | 'failed' | 'timeout'`.
     `index.tsx` renders `InitialSyncOverlay` while `in-progress`,
     `RetrySyncScreen` on `failed` / `timeout`, and routes only on `success`.

- **Recommended**: State-based (design 2). Reasons:
  - Matches React's rendering model — no imperative promise awaiting inside
    render.
  - Integrates cleanly with the existing `InitialSyncOverlay` which already
    consumes `useSync()`.
  - Easier to unit-test.

- A 20-second timeout (Clarification Q2) is implemented by `setTimeout` inside
  `SyncProvider.initialSync` racing against the pull-sync. On timeout, state →
  `'timeout'` (surfaced as `'failed'` to UI — same recovery path).

**Alternatives considered and rejected**:

- **Block inside `AuthGuard`**: Rejected — `AuthGuard` is concerned with
  authentication, not data readiness. Mixing concerns violates SRP.
- **React Query with suspense**: Rejected — the initial sync is a WatermelonDB
  pull-sync, not a REST call; React Query is the wrong abstraction.

---

## 3. Where should per-step onboarding progress live — DB or AsyncStorage?

**Decision** (confirmed by user, 2026-04-18 second clarify pass):
**AsyncStorage, keyed by userId.**

**Rationale**:

- Onboarding is a one-time, device-local event. The user's _choices_ (language,
  currency) are synced to the server; the _position_ within the flow is
  ephemeral and does not benefit from sync.
- Keeping per-step progress off the server makes the schema simpler (one new
  column instead of two), reduces sync load, and removes the design question of
  "what does 'resume on device B' mean" (answer: it doesn't — restart from
  Language, which is acceptable per Assumptions).
- Keying by `userId` isolates different accounts on the same device. Without
  this namespacing, User A's progress could leak into User B's session.

**Trade-offs accepted**:

- Partial progress does NOT survive reinstall (AsyncStorage is wiped with app
  data).
- Partial progress does NOT cross devices (AsyncStorage is per-device).

Both are fine because onboarding is a one-time event and returning users (the
primary audience of this fix) already have `onboarding_completed = true`.

**Alternatives considered and rejected**:

- **Store `slides_viewed` as a server column**: Rejected in the second clarify
  pass. The only downside of AsyncStorage (loss on reinstall) is tolerable; the
  upside is a simpler schema and no debate about the semantics of "completed a
  skippable step" across devices.
- **Derive "next step" from field populations on the server profile** (e.g.,
  `preferred_currency set but no cash account` → start at Currency): Rejected
  because it conflates progress tracking with user preferences and requires
  careful reasoning about default-seeded values. The explicit AsyncStorage
  cursor is unambiguous.
- **Use device-level AsyncStorage keys without userId namespacing**: Rejected —
  collides between accounts on the same device.

---

## 4. `profiles` schema: current columns and what needs to change

**Decision**:

- **Add** `profiles.preferred_language` as a `preferred_language_code` enum
  (non-nullable, default `'en'`). New migration
  `040_add_preferred_language_to_profiles.sql`.
- **Reuse** the existing `profiles.onboarding_completed` column as the single
  routing gate. Its current state in the code: declared in
  `packages/db/src/schema.ts` and `base-profile.ts`, but **not consumed by any
  component or screen**. We start consuming it in this feature.
- **Do NOT add** a `slides_viewed` column (removed from earlier draft; now
  tracked in AsyncStorage per § 3).
- **Do NOT add** any other columns.

**Rationale**:

- Grep confirmed: zero consumers of `profiles.onboarding_completed` today
  outside types/schema files and one test. No migration path to worry about for
  existing readers.
- Grep confirmed: zero occurrences of `preferred_language` or
  `preferredLanguage` in `packages/db` — the column is definitively missing and
  we own its introduction.
- Postgres enum (rather than a CHECK constraint or free-text) is used for
  `preferred_language` because it gives a clean type signal in
  `supabase-types.ts` and constrains bad values at the DB layer. Lowercase
  values chosen to match existing i18n conventions.

**Alternatives considered and rejected**:

- **Text column with CHECK constraint** instead of a Postgres enum: slightly
  more flexible for ad-hoc debugging but gives a weaker type contract in the
  generated TS types. Enum chosen for correctness.
- **Nullable `preferred_language`**: rejected by user preference — always having
  a valid language is simpler and matches the "default to English" app behavior.

**Type-source convention (confirmed by user 2026-04-18)**: Postgres-enum-backed
TS types used by app code come from **`packages/db/src/types.ts`**, exposed
through the `@rizqi/db` package index. The file is auto-generated by
`npm run db:migrate` (see its header comment: "AUTO-GENERATED — DO NOT EDIT
MANUALLY") and already exports string-union types for every Postgres enum in the
schema — for example, `CurrencyType` is a 36-value union covering
`"EGP" | ... | "BTC"`. When migration 040 lands, `types.ts` will regenerate with
`export type PreferredLanguageCode = "en" | "ar"` following the same pattern.
**Do not define a shadow `SupportedLanguage = "en" | "ar"` type in
`profile-service.ts`** — always import the canonical `PreferredLanguageCode`
from `@rizqi/db`. The contract file reflects this convention.

---

## 5. Cash-account creation: existing primitive and its fit

**Decision**: Reuse `ensureCashAccount(userId, currency)` from
`apps/mobile/services/account-service.ts`. No changes needed beyond calling it
unconditionally (currency is no longer skippable per FR-009).

**Rationale**: The existing helper already:

- Idempotently creates the cash account (does nothing if one exists).
- Returns a structured `EnsureCashAccountResult` with `created`, `accountId`,
  `error`.
- Handles the `CURRENCY_UNKNOWN` sentinel case — which will become unreachable
  once FR-009 lands but remains defensive.

The `WalletCreationStep` component (conceptually "cash-account confirmation" in
the new spec; file name retained for minimal blast radius) already calls this
helper inside its `useEffect`.

**Alternatives considered and rejected**:

- **Inline the cash-account creation into a new
  `setPreferredCurrencyAndCreateCashAccount`**: selected for the profile-service
  (wraps it in a single `database.write()` alongside the currency update for
  atomicity), but the `ensureCashAccount` helper stays intact — we compose with
  it rather than replacing it.

---

## 6. Sign-in / logout integration with the retry screen

**Decision**: Sign-out from the retry screen (Clarification Q1) reuses the
existing `signOut()` helper in `apps/mobile/services/logout-service.ts`.

**Rationale**: The logout service is already referenced by `SyncProvider`
(`completeInterruptedLogout`) and by Settings. For the retry screen's "Sign out"
action, call the same function. After sign-out, the `AuthGuard` in `_layout.tsx`
detects `!isAuthenticated` and redirects to `/auth`. No new logout primitive
required.

**Alternatives considered and rejected**:

- **Direct Supabase call from the retry screen**: rejected — reimplements
  existing code and bypasses the structured logout flow (which handles
  interrupted-logout cleanup).

---

## 7. Observability (FR-014) — logger choice and log shape

**Decision**: Use the existing `apps/mobile/utils/logger.ts` at info level. One
log call per routing-gate evaluation.

**Shape** (simpler now that the gate is binary):

```ts
logger.info("onboarding.routing.decision", {
  outcome: "dashboard" | "onboarding" | "retry" | "loading",
  onboardingCompleted: boolean,
  syncState: "in-progress" | "success" | "failed" | "timeout",
});
```

**Rationale**: Mirrors the taxonomy in the spec and contracts. No PII: the
profile's personal fields (name, email, avatar_url, preferences) are not logged.
`logger` is already wired into Sentry for production per `_layout.tsx` lines
56-67.

---

## 8. Legacy AsyncStorage keys (FR-015)

**Decision**: Delete `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY` from
`apps/mobile/constants/storage-keys.ts` as part of this change.

**Rationale**:

- `HAS_ONBOARDED_KEY` — its only consumer is `apps/mobile/app/index.tsx`, which
  is being rewritten. No longer needed.
- `LANGUAGE_KEY` — its consumers are the i18n startup path and `onboarding.tsx`.
  After FR-007 lands, language lives on `profiles.preferred_language`. The i18n
  startup path should read from the profile instead.
- Pre-production status (Assumption 5) means no migration window is needed;
  pre-release testers flow through onboarding once.

**Alternatives considered and rejected**:

- **Deprecate-then-delete in two PRs**: overkill for a pre-production app.
  Delete immediately.

---

## 9. Testing strategy (TDD per Constitution + CLAUDE.md testing rule)

**Decision**: Four test tiers, written before implementation per TDD:

1. **Unit (`apps/mobile/__tests__/utils/routing-decision.test.ts`)**: Cover all
   4 outcomes (loading / dashboard / onboarding / retry) × 4 sync states via
   table-driven tests on the pure `getRoutingDecision` function.
2. **Unit (`apps/mobile/__tests__/services/profile-service.test.ts`)**: Cover
   `setPreferredLanguage`, `setPreferredCurrencyAndCreateCashAccount`,
   `completeOnboarding`. Mock `database.write` and `ensureCashAccount`.
3. **Unit
   (`apps/mobile/__tests__/services/onboarding-cursor-service.test.ts`)**: Cover
   `readOnboardingStep`, `writeOnboardingStep`, `clearOnboardingStep`. Mock
   AsyncStorage; verify key format `onboarding:<userId>:step`.
4. **Integration (`apps/mobile/__tests__/app/index.test.tsx`)**: Render the gate
   with mocked `SyncProvider` in each state and with `onboardingCompleted`
   true/false; assert the correct child is rendered (overlay, dashboard
   redirect, onboarding redirect, retry screen).

**Rationale**: Lines up with the 3 services + 1 gate; each has clear testable
outputs.

**Alternatives considered and rejected**:

- **Component-level snapshot testing for the retry screen**: rejected — brittle
  and mockups are the source of truth for visual validation.

---

## 10. Rollout considerations

**Decision**: No feature flag, no staged rollout. The app is pre-production per
the spec's Assumptions. Ship the migration + code change in a single PR.

**Rationale**: No real users are affected; no backward-compatibility burden.
Pre-release testers flow through the new onboarding once.

---

## Summary of resolved open questions

| Planning question                                             | Answer                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Where does the current gate live?                             | `apps/mobile/app/index.tsx` (confirmed).                                                                                       |
| Is the initial pull-sync blocking routing today?              | No — `index.tsx` runs its redirect independently of sync state. Must be wired (T009 / T010).                                   |
| Where does per-step progress live — DB or local?              | **AsyncStorage**, keyed by userId.                                                                                             |
| What columns need to be added?                                | **One**: `preferred_language` (enum `preferred_language_code`, NOT NULL, default `'en'`).                                      |
| Do we need new cash-account logic?                            | No — reuse `ensureCashAccount`.                                                                                                |
| How does sign-out on the retry screen work?                   | Call existing `signOut()`; `AuthGuard` handles the redirect to `/auth`.                                                        |
| How is routing logged?                                        | `logger.info("onboarding.routing.decision", { outcome, onboardingCompleted, syncState })` — no PII.                            |
| Legacy AsyncStorage keys?                                     | Deleted (`HAS_ONBOARDED_KEY`, `LANGUAGE_KEY`).                                                                                 |
| Do we need a feature flag?                                    | No — pre-production.                                                                                                           |
| Are sign-out during onboarding and back/forward nav in scope? | No — tracked as [#242](https://github.com/Msamir22/Rizqi/issues/242) and [#243](https://github.com/Msamir22/Rizqi/issues/243). |
