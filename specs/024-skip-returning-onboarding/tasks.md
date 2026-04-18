---
description:
  "Dependency-ordered task list for feature 024-skip-returning-onboarding"
---

# Tasks: Skip Onboarding for Returning Users

**Input**: Design documents from `/specs/024-skip-returning-onboarding/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅,
contracts/profile-service.ts ✅, quickstart.md ✅

**Tests**: Included per Rizqi Constitution III (Type Safety) + project TDD
mandate in `CLAUDE.md`. All test tasks below are REQUIRED — write them first,
ensure they FAIL, then implement (RED → GREEN → REFACTOR).

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing. Because all four user stories touch shared
foundational pieces (profile schema, profile-service, SyncProvider extension,
router), those pieces are extracted into Phase 2 (blocking) so each story's
phase only contains its own incremental delta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete
  tasks)
- **[Story]**: Maps to user stories from spec.md (US1/US2/US3/US4)
- Include exact file paths in descriptions

## Path Conventions

Rizqi mobile monorepo (confirmed in plan.md):

- Mobile app code: `apps/mobile/`
- Shared WatermelonDB package: `packages/db/`
- Tests colocated at `apps/mobile/__tests__/`
- Migrations at `supabase/migrations/`
- Docs at `docs/`

---

## Phase 1: Setup (Pre-Implementation Gates) — RESOLVED

**Purpose**: Blocking external dependencies that must be resolved before any
implementation tasks can begin.

- [x] T001 ✅ Retry-screen mockup approved (2026-04-18). Variant 2 "Status Card"
      approved. Reference assets at
      `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png`
      (visual) and `.../retry-sync-screen.html` (component structure).
      **Implementation warning carried forward to T032**: omit the
      Stitch-generated top-app-bar (Close X + "Sync Status" title) — the retry
      screen has no valid close destination; only Retry and Sign out are
      legitimate actions.
- [x] T002 ✅ Resolved (2026-04-18). Decision: **Option B** — the routing gate's
      "currency step complete" signal is the presence of a cash account row, NOT
      `preferred_currency IS NOT NULL`. This avoids dependency on
      `handle_new_user()` trigger seeding behavior.
      `contracts/profile-service.ts` and `data-model.md` § 3 already reflect
      `hasCashAccount: boolean` in `RoutingInputs`.

---

## Phase 2: Foundational (Blocking Prerequisites) 🔒

**Purpose**: Core infrastructure and primitives that every user story depends
on. NO user story work can begin until this phase is complete.

**⚠️ CRITICAL**: T003–T018 must all be green before starting Phase 3.

### Schema & Database

- [x] T003 Write migration file
      `supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql`
      adding `preferred_language TEXT NULL` and
      `slides_viewed BOOLEAN NOT NULL DEFAULT FALSE` to the `profiles` table
      (SQL body per data-model.md § 6).
- [x] T004 Run `npm run db:push` then `npm run db:migrate` from repo root; stage
      and commit the regenerated `packages/db/src/schema.ts`,
      `packages/db/src/migrations.ts`, `packages/db/src/supabase-types.ts`, and
      `packages/db/src/models/base/base-profile.ts` alongside the migration file
      (single commit per Constitution VII).

### Pure routing-decision function (used by US1, US2, US3, US4)

- [x] T005 [P] Write unit tests for `getRoutingDecision` covering all 7 outcomes
      (loading, retry, dashboard, language, slides, currency,
      cash-account-confirmation) and all 4 sync states in
      `apps/mobile/__tests__/utils/routing-decision.test.ts` — must FAIL before
      T006.
- [x] T006 Implement `getRoutingDecision(inputs: RoutingInputs): RoutingOutcome`
      exactly matching the signature in
      `specs/024-skip-returning-onboarding/contracts/profile-service.ts` in
      `apps/mobile/utils/routing-decision.ts` — turn T005 GREEN.

### Profile service (used by US2 and US4)

- [x] T007 [P] Write unit tests for `setPreferredLanguage`, `markSlidesViewed`,
      `setPreferredCurrencyAndCreateCashAccount`, and `completeOnboarding`
      mocking `database.write` and `ensureCashAccount` in
      `apps/mobile/__tests__/services/profile-service.test.ts` — must FAIL
      before T008.
- [x] T008 Implement `apps/mobile/services/profile-service.ts` exporting the
      four mutation functions exactly matching signatures in
      `specs/024-skip-returning-onboarding/contracts/profile-service.ts`;
      `setPreferredCurrencyAndCreateCashAccount` wraps profile update +
      `ensureCashAccount` in a single `database.write()` call.

### Profile observation hook (used by US1, US3)

- [x] T009 [P] Write unit tests for `useProfile` hook (observes first
      non-deleted profile row, cleans up subscription on unmount) in
      `apps/mobile/__tests__/hooks/useProfile.test.ts` — must FAIL before T010.
- [x] T010 Verify existing `apps/mobile/hooks/useProfile.ts` matches the
      required interface `{ profile: Profile | null; isLoading: boolean }` and
      exposes the fields needed by the routing gate. The hook already implements
      the correct
      `database.get("profiles").query(Q.where("deleted", false), Q.take(1)).observe()`
      pattern. Extend only if gaps are found; the test from T009 validates the
      contract.

### SyncProvider extension — `initialSyncState` + retry + 20s timeout (used by US1, US4)

- [x] T011 Write unit tests for the new `initialSyncState` state machine
      (`in-progress` → `success` | `failed` | `timeout`), the 20-second timeout
      race, and the `retryInitialSync()` function in
      `apps/mobile/__tests__/providers/SyncProvider.test.tsx` — must FAIL before
      T012.
- [x] T012 Extend `apps/mobile/providers/SyncProvider.tsx`: add
      `initialSyncState` and `retryInitialSync` to `SyncContextValue`, race the
      existing `initialSync()` against a 20-second `setTimeout`, and resolve the
      state accordingly. Keep `isInitialSync` intact for backward compatibility
      with `InitialSyncOverlay`.

### i18n strings (used by US4 retry screen)

- [x] T013 [P] Add keys `sync_failed_title`, `sync_failed_description`,
      `sign_out` to `apps/mobile/locales/en/common.json` and
      `apps/mobile/locales/ar/common.json`; confirm `retry` already exists and
      reuse it.

### Documentation (Constitution II — Business Logic)

- [x] T014 [P] Update `docs/business/business-decisions.md` with: (a) the 4-step
      onboarding flow (Language mandatory, Slides skippable, Currency mandatory
      no-skip, Cash-account confirmation); (b) `preferred_currency` and
      `preferred_language` as server-authoritative; (c) retirement of
      `HAS_ONBOARDED_KEY` / `LANGUAGE_KEY` AsyncStorage keys from the onboarding
      gate.

### Deprecation of legacy keys (documents intent; read-paths removed in later tasks)

- [x] T015 [P] Add JSDoc `@deprecated` comments to `HAS_ONBOARDED_KEY` and
      `LANGUAGE_KEY` exports in `apps/mobile/constants/storage-keys.ts` pointing
      to the new profile-driven flow; DO NOT delete the exports (legacy reads
      eliminated in T017, T018, T027).

### Structured log contract

- [x] T016 [P] Write a unit test asserting the exact payload shape emitted by
      the routing decision (per contracts/profile-service.ts
      `RoutingDecisionLog`) in
      `apps/mobile/__tests__/utils/routing-decision-log.test.ts` — helper
      function `buildRoutingDecisionLog(inputs, outcome)` must produce a
      serializable object with no PII fields.
- [x] T017 Implement `buildRoutingDecisionLog` in
      `apps/mobile/utils/routing-decision.ts` (same file; helper exported
      alongside `getRoutingDecision`) — turn T016 GREEN.

**Checkpoint**: Foundation ready — user story implementation can now begin. US1
and US2 are both P1 and can be developed in parallel by separate contributors
after this point.

---

## Phase 3: User Story 1 - Returning user lands on dashboard without re-onboarding (Priority: P1) 🎯 MVP

**Goal**: A user whose remote profile has `onboarding_completed = true` lands on
the dashboard directly after sign-in — preferences and cash account restored —
with no onboarding screen shown.

**Independent Test**: Seed a Supabase `profiles` row with
`onboarding_completed = true`, `preferred_language = 'en'`,
`slides_viewed = true`, `preferred_currency = 'EGP'` and a matching cash account
row. Sign in on a clean install. Verify the app transitions from
`InitialSyncOverlay` directly to `/(tabs)` (dashboard) with the stored language,
currency, and cash account visible.

### Tests for User Story 1

- [x] T018 [P] [US1] Write integration test: mount `<Index />` with
      `SyncProvider` state stubbed to `initialSyncState='success'` and
      `useProfile` returning an already-onboarded profile; assert the component
      redirects to `/(tabs)` in `apps/mobile/__tests__/app/index.test.tsx` —
      must FAIL before T020.
- [x] T019 [P] [US1] Write integration test: mount `<Index />` with
      `initialSyncState='in-progress'`; assert `InitialSyncOverlay` is rendered
      and no redirect is issued in `apps/mobile/__tests__/app/index.test.tsx` —
      must FAIL before T020.

### Implementation for User Story 1

- [x] T020 [US1] Rewrite `apps/mobile/app/index.tsx`: remove the
      `HAS_ONBOARDED_KEY` AsyncStorage read; import `useSync`, `useProfile`,
      `getRoutingDecision`, and `buildRoutingDecisionLog`; render based on the
      routing outcome — `loading` → rely on overlay and render nothing,
      `dashboard` → `<Redirect href="/(tabs)" />`,
      `language|slides|currency|cash-account-confirmation` →
      `<Redirect href="/onboarding" />` (the onboarding screen handles sub-phase
      selection per US3), `retry` → render `<RetrySyncScreen />` (component
      lands in US4; for now, render a placeholder and mark with a `TODO:`
      comment pointing to the US4 task).
- [x] T021 [US1] Emit
      `logger.info("onboarding.routing.decision", buildRoutingDecisionLog(...))`
      once per evaluation in `apps/mobile/app/index.tsx` (FR-014) — payload must
      not contain PII.

**Checkpoint**: US1 independently functional for the happy path.
`RetrySyncScreen` is a placeholder until US4 ships; the retry outcome still
exits the onboarding flow without crashing.

---

## Phase 4: User Story 2 - New user completes the full onboarding flow (Priority: P1)

**Goal**: A brand-new user (or one whose profile is not marked as onboarded)
completes Language → Slides → Currency → Cash-account confirmation; after the
confirmation, `onboarding_completed` flips to `true` on the profile and they
land on the dashboard.

**Independent Test**: Sign up a new user. Confirm the Language picker appears
first; after language selection, the slides carousel appears; after skip/finish
of slides, the Currency picker appears **with no Skip button** and Continue
disabled until a currency is selected; after currency selection, the
cash-account confirmation appears; after dismissing it, the dashboard appears
with the cash account visible. Re-launch the app — dashboard appears directly
(confirms `onboarding_completed=true` landed on the profile).

### Tests for User Story 2

- [x] T022 [P] [US2] Write integration test: drive the onboarding state machine
      through all 4 phases with stubbed `profile-service`; assert the correct
      profile mutation is called at each transition in
      `apps/mobile/__tests__/app/onboarding.test.tsx` — must FAIL before
      implementation.
- [x] T023 [P] [US2] Write unit test asserting `CurrencyPickerStep` renders
      without a Skip button and that its Continue action is only enabled once a
      currency is selected in
      `apps/mobile/__tests__/components/onboarding/CurrencyPickerStep.test.tsx`
      — must FAIL before T025.

### Implementation for User Story 2

- [x] T024 [US2] Remove the `onSkip` prop declaration and the Skip
      `TouchableOpacity` (and its `t("skip")` label usage) from
      `apps/mobile/components/onboarding/CurrencyPickerStep.tsx`; also delete
      the `FALLBACK_CURRENCY` constant since the fallback is no longer needed
      for skip (keep timezone detection for the suggested-currency pre-selection
      only).
- [x] T025 [US2] Modify
      `apps/mobile/components/onboarding/LanguagePickerStep.tsx` — after
      `changeLanguage(language)` resolves in the parent's
      `handleLanguageSelected`, call
      `profile-service.setPreferredLanguage(language)`; propagate errors via the
      existing Toast pattern (no silent swallow).
- [x] T026 [US2] Modify
      `apps/mobile/components/onboarding/WalletCreationStep.tsx` — on
      `phase === "success"` before calling `onComplete()` (i.e., when the user
      taps the "Let's Go" CTA), first call
      `profile-service.completeOnboarding()`. Do not set the flag in the error
      branch (user will retry). Remove the `setPreferredCurrency` hook usage
      here — that responsibility has moved to
      `profile-service.setPreferredCurrencyAndCreateCashAccount` called earlier
      in the Currency step.
- [x] T027 [US2] Rewrite `apps/mobile/app/onboarding.tsx`: (a) delete the
      `AsyncStorage.setItem(HAS_ONBOARDED_KEY, "true")` write and the
      `AsyncStorage.getItem(LANGUAGE_KEY)` read; (b) determine initial `phase`
      by calling `getRoutingDecision` on the current profile (restart at the
      resume point); (c) on carousel finish/skip, call
      `profile-service.markSlidesViewed()` instead of the AsyncStorage write;
      (d) on currency selection, call
      `profile-service.setPreferredCurrencyAndCreateCashAccount(currency)`
      before transitioning to the confirmation phase; (e)
      handleCurrencyPickerSkip is dead code after T024 — delete. Keep the
      existing pending-navigation ref for auth-loading coordination.

**Checkpoint**: US2 independently functional. New user can complete the flow
end-to-end; subsequent launches go straight to the dashboard (proves US1 via the
profile field now being populated).

---

## Phase 5: User Story 3 - User resumes partial onboarding at the step they left off (Priority: P2)

**Goal**: A user who quit mid-flow sees only the steps they haven't finished on
next sign-in.

**Independent Test**: For each of the 4 partial-progress states below, seed a
profile manually in Supabase and sign in on a clean install. Expect the app to
land directly on the specified step with no earlier steps re-shown:

| Seeded profile state                                                                               | Expected step                                                  |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `preferred_language='en'`, `slides_viewed=false`, no cash account, `onboarding_completed=false`    | Slides                                                         |
| `preferred_language='en'`, `slides_viewed=true`, no cash account, `onboarding_completed=false`     | Currency                                                       |
| `preferred_language='en'`, `slides_viewed=true`, cash account exists, `onboarding_completed=false` | Cash-account confirmation                                      |
| all fields populated + `onboarding_completed=true`                                                 | Dashboard (this is the US1 test, listed here for completeness) |

### Tests for User Story 3

- [x] T028 [P] [US3] Write integration tests covering the 4 partial-progress
      seed states above in `apps/mobile/__tests__/app/onboarding.test.tsx` (new
      `describe("resume logic", ...)` block) — must FAIL if the initial-phase
      logic regresses.

### Implementation for User Story 3

- [x] T029 [US3] Verify the initial-phase derivation implemented in T027
      correctly handles each of the 4 partial states; if any branch is missing,
      fix `apps/mobile/app/onboarding.tsx` to call `getRoutingDecision`
      exhaustively and map the outcome to its `OnboardingPhase`.

**Checkpoint**: US3 independently functional. Partial resume works for all 4
seeded states without re-showing completed steps.

---

## Phase 6: User Story 4 - Slow or failed initial sync does not fall through to onboarding (Priority: P2)

**Goal**: When the post-sign-in profile fetch takes > 20 seconds or fails with a
network/server error, the user sees a retry screen with Retry + Sign out actions
— never the onboarding flow.

**Independent Test**: Throttle the network to 2G or take Supabase offline. Sign
in. Expect the `InitialSyncOverlay` to remain visible for up to 20s, then
transition to `RetrySyncScreen`. Tapping Retry (with server restored) loads the
dashboard. Tapping Sign out returns to `/auth`.

### Tests for User Story 4

- [x] T030 [P] [US4] Write integration test: mount `<Index />` with
      `initialSyncState='failed'`; assert `RetrySyncScreen` is rendered (not the
      onboarding flow) in `apps/mobile/__tests__/app/index.test.tsx` — must FAIL
      before T032.
- [x] T031 [P] [US4] Write unit test for `RetrySyncScreen` rendering both Retry
      and Sign-out actions and invoking the injected callbacks on press in
      `apps/mobile/__tests__/components/RetrySyncScreen.test.tsx` — must FAIL
      before T032.

### Implementation for User Story 4

- [x] T032 [US4] Create `apps/mobile/components/ui/RetrySyncScreen.tsx`
      implementing the approved Variant 2 "Status Card" mockup at
      `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png` +
      `.html`. Key structure (from approved HTML):
  - Full-screen dark container (slate-900 bg) with a centered card (slate-800
    bg, 16pt radius, subtle drop shadow, ~342pt wide, 24pt internal padding,
    centered both axes).
  - Card contents top-to-bottom: 48pt red icon tile (red-400 cloud-offline icon
    on red-500/12% bg, 12pt radius) → 20pt gap → "Sync failed" pill chip
    (red-400 text on red-500/15% bg, 999pt radius) → 16pt gap → headline
    "Couldn't load your account" (22pt Inter bold, slate-25) → 12pt gap → body
    "We tried to download your latest data but couldn't reach our servers."
    (14pt Inter regular, slate-400) → 24pt gap → two buttons side-by-side (12pt
    gap): **LEFT** ghost Sign out (slate-700 1pt border, slate-25 text) —
    **RIGHT** primary Retry (nileGreen-500 fill, slate-25 text).
  - Below card: 24pt gap, helper line "Still not working? Check your internet
    connection." (12pt slate-500, centered, 300pt max-width).
  - **OMIT** the Stitch-generated top-app-bar (Close X + "Sync Status" title) —
    retry has no valid close destination; Retry and Sign out are the only
    actions.
  - i18n keys from T013 (`common.sync_failed_title`,
    `common.sync_failed_description`, `common.retry`, `common.sign_out`). All UI
    strings MUST go through the translation layer, no hardcoded copy.
  - Palette constants from `apps/mobile/constants/colors.ts` — `palette.slate`,
    `palette.red`, `palette.nileGreen`. No hardcoded hex in JSX.
  - Dark mode via `dark:` variants per Constitution V; use `text-text-primary` /
    `text-text-secondary` classes where they apply.
  - **NativeWind v4 crash avoidance**: do NOT use `shadow-*`, `opacity-*`, or
    `bg-color/opacity` on `TouchableOpacity` or `Pressable`. The Retry button's
    shadow MUST use inline
    `style={{ shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }}`
    (see `WalletCreationStep.tsx` lines 230-241 for the existing pattern). The
    card's drop shadow is on a `View`, so the `shadow-*` class is safe there.
  - The decorative ambient glow behind the card (`bg-primary/5 blur-[120px]`) is
    OPTIONAL; include only if it renders cleanly without the NativeWind crash —
    acceptable to drop in the RN port.
  - Props: `{ onRetry: () => void; onSignOut: () => void; }` both non-optional,
    wired by T033/T034.
- [x] T033 [US4] Wire `RetrySyncScreen` into `apps/mobile/app/index.tsx` —
      remove the placeholder left by T020, render
      `<RetrySyncScreen onRetry={retryInitialSync} onSignOut={handleSignOut} />`
      when the routing decision returns `retry`.
- [x] T034 [US4] Wire the Sign-out handler in `apps/mobile/app/index.tsx` to the
      existing logout function (import from
      `apps/mobile/services/logout-service.ts` or equivalent — research.md § 5
      confirms reuse path); after sign-out, `AuthGuard` handles the redirect to
      `/auth`.
- [x] T035 [US4] Add integration tests for the retry and sign-out flows in
      `apps/mobile/__tests__/app/index.test.tsx`: (a) failed → tap Retry → sync
      resolves → dashboard; (b) failed → tap Sign out → redirected to `/auth`.

**Checkpoint**: All four user stories independently functional. Feature behavior
complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, verification, and follow-ups after all four stories land.

- [x] T036 [P] Grep the repository for any remaining runtime reads of
      `HAS_ONBOARDED_KEY` or `LANGUAGE_KEY`
      (`grep -r "HAS_ONBOARDED_KEY\|LANGUAGE_KEY" apps/mobile/ --exclude-dir=__tests__ --exclude=storage-keys.ts`)
      — expect zero matches in production code. Any matches are regressions.
- [x] T037 [P] Run `npx tsc --noEmit` from repo root and confirm no type errors.
- [ ] T039 [P] Run the full Jest suite (`npm --workspace apps/mobile test`) and
      confirm all tests pass.
- [ ] T040 Walk through the manual verification checklist in
      `specs/024-skip-returning-onboarding/quickstart.md` on a real device
      (iOS + Android) and tick each item.
- [ ] T041 Verify in Sentry (or local log output with `DEBUG=1`) that exactly
      one `onboarding.routing.decision` event fires per app launch, with the
      expected payload shape.
- [ ] T042 File a GitHub issue titled "Remove `HAS_ONBOARDED_KEY` and
      `LANGUAGE_KEY` AsyncStorage legacy keys" as a follow-up PR (to be merged
      after at least one release cycle, once pre-release devices have flowed
      through the new onboarding).
- [ ] T043 Run `/speckit.analyze` to cross-check spec ↔ plan ↔ tasks ↔ code
      alignment for this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Both blockers resolved on 2026-04-18 (see T001, T002). No
  longer blocks Phase 2 or Phase 6.
- **Phase 2 (Foundational)**: Must complete before Phases 3–6 begin. All
  T003–T017 are blocking.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2. Can run in parallel with Phase 3.
- **Phase 5 (US3)**: Depends on T027 (from US2) because the initial-phase
  derivation is implemented there. Start after US2 completes.
- **Phase 6 (US4)**: Depends on Phase 2 + T001 (mockups). T033 depends on T020
  (from US1) because it replaces the placeholder router branch. Can otherwise
  run in parallel with US1/US2/US3.
- **Phase 7 (Polish)**: All tasks depend on Phases 3–6 completing.

### Within-Phase Dependencies

- Schema: **T003 → T004** (strict).
- Routing decision: **T005 → T006**; **T016 → T017** (TDD: test must FAIL
  first).
- Profile service: **T007 → T008** (TDD).
- Profile hook: **T009 → T010** (TDD).
- SyncProvider: **T011 → T012** (TDD).
- US1: **T018, T019 → T020, T021** (TDD).
- US2: **T022, T023 → T024–T027** (TDD); within implementation **T024 can run in
  parallel with T025 and T026**; **T027 depends on T025 (language setter) and
  T026 (completeOnboarding call)**.
- US3: **T028 → T029** (TDD).
- US4: **T030, T031 → T032, T033** (TDD); **T033 depends on T032**; **T035
  depends on T033, T034**. (T001 mockup blocker resolved.)

### Parallel Opportunities

**Phase 2 — heavy parallelism once T003/T004 land**:

- T005 (routing test) ∥ T007 (profile-service test) ∥ T009 (useProfile test) ∥
  T011 (SyncProvider test) ∥ T013 (i18n) ∥ T014 (business docs) ∥ T015
  (deprecation comments) ∥ T016 (log test).
- Then the implementations: T006 ∥ T008 ∥ T010 ∥ T012 ∥ T017 can run
  simultaneously by different contributors.

**Phases 3 and 4 in parallel** (both P1) if two contributors are available — US1
owns `apps/mobile/app/index.tsx`, US2 owns `apps/mobile/app/onboarding.tsx` and
the three onboarding step components. No file conflicts.

**Phase 6 (US4)** can also run in parallel with Phases 3/4/5 except for T033
which touches `index.tsx` after T020.

**Phase 7** — T036, T037, T038, T039 can all run in parallel.

---

## Parallel Example: Phase 2 Foundational Tests (TDD RED step)

```bash
# Four contributors can draft tests in parallel once the schema is in place:
Contributor A: T005 — tests/utils/routing-decision.test.ts
Contributor B: T007 — tests/services/profile-service.test.ts
Contributor C: T009 — tests/hooks/useProfile.test.ts
Contributor D: T011 — tests/providers/SyncProvider.test.tsx
```

## Parallel Example: US1 + US2 + US4 running concurrently

```bash
Dev A (US1):  T018, T019 → T020, T021
Dev B (US2):  T022, T023 → T024, T025, T026 → T027
Dev C (US4):  T030, T031 → T032 (after mockups) → T033 (after T020) → T034, T035
```

---

## Implementation Strategy

### MVP = US1 + US2 combined (both P1)

US1 alone is not demo-worthy because the existing onboarding writes to
AsyncStorage, not to the profile. A new user would see the flow, set the
AsyncStorage flag, then get sent back to onboarding on next launch because their
profile's `onboarding_completed` is still false.

Ship **Phase 1 + Phase 2 + Phase 3 + Phase 4** together as the MVP. Internally
testable after Phase 3; externally shippable after Phase 4.

### Incremental delivery after MVP

1. **MVP (US1 + US2)**: returning users skip onboarding; new users complete the
   corrected 4-step flow that persists to the server. Deploy/demo.
2. **US3**: partial-resume polish — unlikely to affect demo users but
   correctness-critical. Deploy/demo.
3. **US4**: slow/failed sync safeguard — the retry screen. Deploy/demo. (Depends
   on mockups being ready.)

### Stop points

- **After T021**: US1 is testable against a pre-seeded profile. Good checkpoint
  for early verification before starting US2.
- **After T027**: MVP is complete. Pause and validate end-to-end manually before
  Phase 5.
- **After T035**: feature-complete. Run polish phase.

---

## Notes

- [P] markers on the list above indicate file-level independence. Two [P] tasks
  never both modify the same file.
- Every implementation task has a corresponding TDD test task that precedes it
  and must FAIL first (per Rizqi Constitution + `CLAUDE.md` testing rule).
- Do not commit implementation code without its test. Do not commit test code
  that already passes without an implementation change — the RED step must be
  observed.
- Legacy AsyncStorage keys (`HAS_ONBOARDED_KEY`, `LANGUAGE_KEY`) are deprecated
  in Phase 2 (T015) but not deleted. T042 tracks final removal as a follow-up
  PR.
- If `apps/mobile/services/logout-service.ts` does not expose a callable
  `signOut()` suitable for the retry screen (research.md § 5 assumes it does),
  treat the discrepancy as a T002-style investigation and file a sub-task — do
  not invent a new logout path.
