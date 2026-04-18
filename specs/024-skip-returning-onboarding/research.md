# Phase 0 Research: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding` | **Date**: 2026-04-18

This document resolves all "NEEDS CLARIFICATION" markers and gathers
best-practice references for the design. No `[NEEDS CLARIFICATION]` markers
remained after `/speckit.clarify`; the investigations below answer the two
planning-phase open items the spec flagged explicitly.

---

## 1. Current onboarding gate — where and how it decides

**Decision**: The routing gate lives at `apps/mobile/app/index.tsx`. It
currently reads `HAS_ONBOARDED_KEY` from AsyncStorage and redirects to `/(tabs)`
if `"true"`, otherwise to `/onboarding`. It does NOT consult
`profiles.onboarding_completed` on the server or via WatermelonDB.

**Rationale**: Code inspection confirms the gate is AsyncStorage-only.
`apps/mobile/app/index.tsx` lines 15-59:

```tsx
const value = await AsyncStorage.getItem(HAS_ONBOARDED_KEY);
if (value === "true") setHasOnboarded(true);
// ...
if (hasOnboarded) return <Redirect href="/(tabs)" />;
else return <Redirect href="/onboarding" />;
```

`HAS_ONBOARDED_KEY` is written in a single place — `onboarding.tsx`
`handleCarouselFinish` — after the user finishes the slides carousel (not after
the cash-account confirmation, which is the actual end of the flow). That means
today's flag flips at the wrong step; the move to the server-authoritative
`profiles.onboarding_completed` field will also correctly realign it to flip at
the end of the flow (FR-011).

**Alternatives considered**:

- **Keep AsyncStorage + add a server write**: Rejected because it preserves the
  reinstall/new-device bug (empty local storage → user sees onboarding again
  even though their server profile says they're done). This is exactly what
  issue #226 reports.
- **Use a dedicated hook with React Query against the Supabase REST endpoint**:
  Rejected because it bypasses WatermelonDB and creates a second source of truth
  for profile data. The constitution makes WatermelonDB the single source of
  truth.

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
  `SyncProvider.initialSync` racing against `syncDatabase`. On timeout, state →
  `'timeout'` (surfaced as `'failed'` to UI — same recovery path).

**Alternatives considered**:

- **Block inside `AuthGuard`**: Rejected because `AuthGuard` is concerned with
  authentication, not data readiness. Mixing the two concerns violates SRP.
- **React Query with suspense**: Rejected because the initial sync is not a pull
  from a REST endpoint but a WatermelonDB pull-sync; React Query is the wrong
  abstraction.

---

## 3. `profiles` schema: current columns and what we need to add

**Decision**: Two new columns required on `profiles`:

| Column               | Type    | Nullable                            | Default | Purpose                                                                                                                                    |
| -------------------- | ------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `preferred_language` | text    | YES (until language step completes) | NULL    | FR-007. Populated when the user completes the Language step; used as a per-step resume signal AND for i18n startup on subsequent launches. |
| `slides_viewed`      | boolean | NO                                  | `false` | FR-008. Populated when the user views or skips the carousel. Second per-step resume signal.                                                |

Existing relevant columns on `profiles` (per `packages/db/src/schema.ts` lines
230-247):

| Column                                           | Type          | Notes                                                                                      |
| ------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------ |
| `onboarding_completed`                           | boolean       | Exists. Currently unused by router. Becomes the single gate per FR-011.                    |
| `preferred_currency`                             | text          | Exists, NOT NULL at schema level. FR-009 makes it NOT NULL at product level too (no skip). |
| `setup_guide_completed`                          | boolean       | Separate feature — untouched per FR-013.                                                   |
| `user_id`, `created_at`, `updated_at`, `deleted` | sync envelope | Required by Constitution I. Already present.                                               |

**Rationale**: Grepped `preferred_language` — zero matches in `packages/db`,
confirming the column is missing. `onboarding_completed` exists but has zero
consumers in components/screens (grep found only schema, types, and one test
file). Tests will need to be updated.

**Alternatives considered**:

- **Derive `slides_viewed` from the presence of `preferred_language` +
  `preferred_currency`**: Rejected because slides can be skipped independently
  of the other steps — there's no proxy signal for "user saw the carousel". A
  dedicated boolean is correct.
- **Use a `step_reached` text enum instead of three per-step signals**: Rejected
  as less composable and more prone to typos/rename bugs; the flag + three
  signal columns model matches the spec's Assumption 1.

---

## 4. Cash-account creation: existing primitive and its fit

**Decision**: Reuse `ensureCashAccount(userId, currency)` from
`apps/mobile/services/account-service.ts`. No changes needed beyond calling it
unconditionally (currency is no longer skippable).

**Rationale**: The existing helper already:

- Idempotently creates the cash account (does nothing if one exists).
- Returns a structured `EnsureCashAccountResult` with `created`, `accountId`,
  `error`.
- Handles the `CURRENCY_UNKNOWN` sentinel case — which will become unreachable
  once FR-009 lands but remains defensive.

The `WalletCreationStep` component (renamed conceptually to "cash-account
confirmation" in the spec; file rename optional) already calls this helper
inside its `useEffect`.

**Alternatives considered**:

- **Replace `ensureCashAccount` with a combined
  `setPreferredCurrencyAndCreateCashAccount`**: Rejected. Better to keep the
  primitives small and compose them in `profile-service.ts`. This preserves the
  current helper's usefulness for other flows (e.g., account restoration after a
  sync).

---

## 5. Sign-in / logout integration with the new gate

**Decision**: Sign-out from the retry screen (Clarification Q1) reuses the
existing logout service.

**Rationale**: `apps/mobile/services/logout-service.ts` is referenced by
`SyncProvider` (`completeInterruptedLogout`) and tests show it clears the
session and local data. For the retry screen's "Sign out" action, call the same
`signOut()` function already used by Settings. After sign-out, the `AuthGuard`
in `_layout.tsx` will detect `!isAuthenticated` and redirect to `/auth`. No new
logout primitive required.

**Alternatives considered**:

- **Direct Supabase call from the retry screen**: Rejected — reimplements
  existing code and bypasses the structured logout flow (which handles
  interrupted-logout cleanup).

---

## 6. Observability (FR-014) — logger choice and log shape

**Decision**: Use the existing `apps/mobile/utils/logger.ts` at info level. One
log call per routing-gate evaluation.

**Shape**:

```ts
logger.info("onboarding.routing.decision", {
  outcome:
    "dashboard" |
    "language" |
    "slides" |
    "currency" |
    "cash-account-confirmation" |
    "retry",
  inputs: {
    onboardingCompleted: boolean,
    hasPreferredLanguage: boolean,
    slidesViewed: boolean,
    hasPreferredCurrency: boolean,
  },
  syncState: "success" | "failed" | "timeout",
});
```

**Rationale**: Mirrors the taxonomy defined in the spec. No PII: the profile's
personal fields (name, email, avatar_url, preferences) are not logged — only the
four boolean conditions and the outcome label. `logger` is already wired into
Sentry for production per `_layout.tsx` lines 56-67.

**Alternatives considered**:

- **Per-step logs (every step entered/completed)**: Rejected — broader surface,
  deferred to planning discretion as captured in the clarify coverage summary.

---

## 7. i18n for new/changed copy

**Decision**: Add new keys to `apps/mobile/locales/{en,ar}/onboarding.json` and
`common.json`:

| Key (namespace)                  | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `common.sync_failed_title`       | Retry screen title.                                            |
| `common.sync_failed_description` | Retry screen body explanation.                                 |
| `common.retry`                   | Already exists; verify during implementation.                  |
| `common.sign_out`                | Already exists in Settings; reuse.                             |
| `onboarding.wallet_cta`          | Already exists; final confirmation button copy may be tweaked. |

**Rationale**: Constitution II and the `i18n` rule in CLAUDE.md require
translated, token-based strings. No hardcoded retry-screen text.

---

## 8. Testing strategy (TDD per Constitution + CLAUDE.md testing rule)

**Decision**: Three test tiers, written before implementation per TDD:

1. **Unit (`apps/mobile/__tests__/utils/routing-decision.test.ts`)**: Cover all
   6 outcomes (dashboard / 4 onboarding steps / retry) via table-driven tests on
   the pure `getRoutingDecision(profile, syncState)` function.
2. **Unit (`apps/mobile/__tests__/services/profile-service.test.ts`)**: Cover
   each mutation: `setPreferredLanguage`, `markSlidesViewed`,
   `setPreferredCurrencyAndCreateCashAccount`, `completeOnboarding`. Mock
   WatermelonDB's `database.write`.
3. **Integration (`apps/mobile/__tests__/app/index.test.tsx`)**: Render the gate
   with mocked `SyncProvider` in each state (`in-progress`, `success`, `failed`,
   `timeout`) and assert the correct child is rendered (overlay, redirect, retry
   screen).

**Rationale**: The routing logic and the service mutations are the high-leverage
test targets. End-to-end (sign-in → sync → dashboard) is best covered by a
Maestro script, tracked separately in Phase 2 if time permits.

**Alternatives considered**:

- **Component-level snapshot testing for the retry screen**: Rejected —
  snapshots are brittle for UI screens and mockups are still pending.

---

## 9. Rollout considerations

**Decision**: No feature flag, no staged rollout. The app is pre-production per
the spec's Assumption 5. Ship with the migration + code change in a single PR.

**Rationale**: No real users are affected; no backward-compatibility burden. The
existing AsyncStorage keys are documented as deprecated in the plan but not
deleted — they may still be written by pre-release installs during the one-time
flow-through.

---

## Summary of resolved open questions

| Planning question                                | Answer                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Where does the current gate live?                | `apps/mobile/app/index.tsx` (confirmed).                                            |
| Is the initial pull-sync blocking routing today? | No — `index.tsx` runs its redirect independently of sync state. Must be wired.      |
| What columns need to be added?                   | `preferred_language` (text, nullable) and `slides_viewed` (boolean, default false). |
| Do we need new cash-account logic?               | No — reuse `ensureCashAccount`.                                                     |
| How does sign-out on the retry screen work?      | Call existing `signOut()`; `AuthGuard` handles the redirect to `/auth`.             |
| How is routing logged?                           | `logger.info("onboarding.routing.decision", {...})` — no PII.                       |
| Do we need a feature flag?                       | No — pre-production.                                                                |

All planning-phase open items are resolved. Ready for Phase 1.
