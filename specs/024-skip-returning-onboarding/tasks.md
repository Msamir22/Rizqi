---
description:
  "Dependency-ordered task list for feature 024-skip-returning-onboarding"
---

# Tasks: Skip Onboarding for Returning Users

**Input**: Design documents from `/specs/024-skip-returning-onboarding/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅,
contracts/profile-service.ts ✅, quickstart.md ✅, mockups/ ✅ **Last
rewritten**: 2026-04-18 (reflects simplified data model — per-step progress
moved to AsyncStorage, `slides_viewed` column removed, `preferred_language` enum
column added)

**Tests**: Included per Monyvi Constitution + project TDD mandate in
`CLAUDE.md`. All test tasks below are REQUIRED — write them first, ensure they
FAIL, then implement (RED → GREEN → REFACTOR).

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing. Shared foundational pieces (migration, services,
SyncProvider extension, pure routing function) are in Phase 2 so each story's
phase only contains its own incremental delta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete
  tasks)
- **[Story]**: Maps to user stories from spec.md (US1/US2/US3/US4)
- Include exact file paths in descriptions

## Path Conventions

Monyvi mobile monorepo:

- Mobile app code: `apps/mobile/`
- Shared WatermelonDB package: `packages/db/`
- Tests colocated at `apps/mobile/__tests__/`
- Migrations at `supabase/migrations/`
- Docs at `docs/`

---

## Phase 1: Setup (Pre-Implementation Gates) — ALL RESOLVED

- [x] T001 ✅ Retry-screen mockup approved (2026-04-18). Variant 2 "Status
      Card". Assets at
      `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png` and
      `.html`.
- [x] T002 ✅ Per-step storage location decided: AsyncStorage, keyed by userId.
      No `handle_new_user()` trigger investigation required since
      `preferred_currency` seeding no longer interacts with the routing gate.

---

## Phase 2: Foundational (Blocking Prerequisites) 🔒

**Purpose**: Core infrastructure and primitives every user story depends on. NO
user story work can begin until this phase is complete.

**⚠️ CRITICAL**: T003–T019 must all be green before starting Phase 3.

### Schema & Database

- [ ] T003 Write migration file
      `supabase/migrations/040_add_preferred_language_to_profiles.sql`. Body:
      create the `preferred_language_code` enum (`'en' | 'ar'`, lowercase), then
      `ALTER TABLE profiles ADD COLUMN preferred_language preferred_language_code NOT NULL DEFAULT 'en'`.
      Exact SQL in data-model.md § 7.
- [ ] T004 Run `npm run db:push` then `npm run db:migrate` from repo root; stage
      and commit the regenerated `packages/db/src/schema.ts`,
      `packages/db/src/migrations.ts`, `packages/db/src/supabase-types.ts`, and
      `packages/db/src/models/base/base-profile.ts` alongside the migration file
      (single commit per Constitution VII).

### Pure routing-decision function (used by US1, US2, US3, US4)

- [ ] T005 [P] Write unit tests for `getRoutingDecision` in
      `apps/mobile/__tests__/utils/routing-decision.test.ts`. Cover the 4
      outcomes (`loading`, `dashboard`, `onboarding`, `retry`) × 4 sync states
      (`in-progress`, `success`, `failed`, `timeout`) ×
      `onboardingCompleted: true | false`. Must FAIL before T006.
- [ ] T006 Implement `getRoutingDecision(inputs: RoutingInputs): RoutingOutcome`
      and `buildRoutingDecisionLog(inputs, outcome): RoutingDecisionLog` in
      `apps/mobile/utils/routing-decision.ts` matching
      `specs/024-skip-returning-onboarding/contracts/profile-service.ts`.
- [ ] T007 [P] Write unit test for `buildRoutingDecisionLog` shape in
      `apps/mobile/__tests__/utils/routing-decision-log.test.ts`. Assert the
      payload has exactly `outcome`, `onboardingCompleted`, and `syncState` — no
      PII fields.

### Onboarding cursor service — AsyncStorage wrapper (used by US2, US3)

- [ ] T008 [P] Write unit tests for
      `apps/mobile/__tests__/services/onboarding-cursor-service.test.ts`. Mock
      `AsyncStorage` (e.g., via
      `@react-native-async-storage/async-storage/jest/async-storage-mock`).
      Cover `readOnboardingStep` (absent → null), `writeOnboardingStep` (correct
      key format `onboarding:<userId>:step`, correct value),
      `clearOnboardingStep` (removes the key, idempotent). Must FAIL before
      T009.
- [ ] T009 Implement `apps/mobile/services/onboarding-cursor-service.ts` with
      `readOnboardingStep`, `writeOnboardingStep`, `clearOnboardingStep`
      matching contracts. Use a single private `keyFor(userId)` helper for key
      construction.

### Profile service (used by US2)

- [ ] T010 [P] Write unit tests for
      `apps/mobile/__tests__/services/profile-service.test.ts`. Mock
      `database.write`, `ensureCashAccount`, `clearOnboardingStep`, and the
      `changeLanguage` i18n helper. Cover:
  - `setPreferredLanguage(language)` — writes `profiles.preferred_language`,
    invokes `changeLanguage`.
  - `setPreferredCurrencyAndCreateCashAccount(currency)` — writes currency +
    creates account, single atomic `database.write`, returns accountId.
  - `completeOnboarding(userId)` — writes `onboarding_completed = true`, then
    clears the cursor. Verify idempotency. Must FAIL before T011.
- [ ] T011 Implement `apps/mobile/services/profile-service.ts` exporting the
      three mutations. All mutations funnel through `database.write()`.
      `completeOnboarding` awaits the DB write first, then invokes
      `clearOnboardingStep(userId)` — an error in the clear is logged but not
      re-thrown (per contract).

### Profile observation hook (used by US1)

- [ ] T012 [P] Write unit tests for `useProfile` in
      `apps/mobile/__tests__/hooks/useProfile.test.ts`. Verify: observes first
      non-deleted profile row, exposes `{ profile, isLoading }`, unsubscribes on
      unmount. Must FAIL before T013.
- [ ] T013 Implement
      `useProfile(): { profile: Profile | null; isLoading: boolean }` in
      `apps/mobile/hooks/useProfile.ts` using the
      `database.get("profiles").query(Q.where("deleted", false), Q.take(1)).observe()`
      pattern already used by `usePreferredCurrency`.

### SyncProvider extension — initialSyncState + retry + 20s timeout (used by US1, US4)

- [ ] T014 Write unit tests for the new `initialSyncState` state machine
      (`in-progress → success | failed | timeout`), the 20-second timeout race,
      and the `retryInitialSync()` function in
      `apps/mobile/__tests__/providers/SyncProvider.test.tsx`. Must FAIL before
      T015.
- [ ] T015 Extend `apps/mobile/providers/SyncProvider.tsx`: add
      `initialSyncState` and `retryInitialSync` to `SyncContextValue`, race the
      existing `initialSync()` against a 20-second `setTimeout`, and resolve the
      state accordingly. Keep `isInitialSync` intact for backward compatibility
      with `InitialSyncOverlay`.

### i18n strings (used by US4 retry screen)

- [ ] T016 [P] Add keys `sync_failed_title`, `sync_failed_description` to
      `apps/mobile/locales/en/common.json` and
      `apps/mobile/locales/ar/common.json`. Confirm `retry` and `sign_out`
      already exist; reuse.

### Documentation (Constitution II)

- [ ] T017 [P] Update `docs/business/business-decisions.md` with: (a) the 4-step
      onboarding flow (Language mandatory, Slides skippable, Currency mandatory
      no-skip, Cash-account confirmation); (b) `preferred_currency` (existing)
      and `preferred_language` (new) as server-authoritative; (c) per-step
      progress stored in AsyncStorage keyed by userId; (d) retirement of
      `HAS_ONBOARDED_KEY` / `LANGUAGE_KEY`.

### Cleanup — delete legacy AsyncStorage keys (FR-015)

- [ ] T018 [P] Delete `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY` exports from
      `apps/mobile/constants/storage-keys.ts`. Also delete the unused constants
      if they appear in any other constants file. Grep the repo; expect all
      remaining references to be inside `apps/mobile/app/index.tsx` and
      `apps/mobile/app/onboarding.tsx`, both of which will be rewritten in Phase
      3 and Phase 4 to not import them. Do NOT delete the imports yet — T020 and
      T026 will handle that together with the rewrites.
- [ ] T019 [P] Grep for any non-obvious consumers of `LANGUAGE_KEY` (e.g., i18n
      startup path in `apps/mobile/i18n/`). If the i18n init reads the language
      from AsyncStorage, update it to read from `profile.preferred_language`
      (via a fresh pull-sync on sign-in) or to fall back to device locale +
      `'en'` default if there is no authenticated user yet. Document any
      discovered consumer in a code comment for the reviewer.

**Checkpoint**: Foundation ready — user story implementation can begin. US1 and
US2 are both P1 and can proceed in parallel.

---

## Phase 3: User Story 1 - Returning user lands on dashboard without re-onboarding (Priority: P1) 🎯 MVP

**Goal**: Return user with `onboarding_completed = true` lands on dashboard — no
onboarding shown.

**Independent Test**: Seed a Supabase profile with
`onboarding_completed = true`, `preferred_language = 'en'`,
`preferred_currency = 'EGP'`, and a matching cash account. Sign in clean. Expect
`InitialSyncOverlay` → `/(tabs)`.

### Tests for User Story 1

- [ ] T020 [P] [US1] Write integration test in
      `apps/mobile/__tests__/app/index.test.tsx`: mount `<Index />` with
      `SyncProvider` state stubbed to `initialSyncState='success'` and
      `useProfile` returning an already-onboarded profile; assert redirect to
      `/(tabs)`. Must FAIL before T022.
- [ ] T021 [P] [US1] Write integration test: mount `<Index />` with
      `initialSyncState='in-progress'`; assert `InitialSyncOverlay` rendered and
      no redirect issued. Add case for `onboardingCompleted=false` +
      `syncState='success'` → redirect to `/onboarding`. Must FAIL before T022.

### Implementation for User Story 1

- [ ] T022 [US1] Rewrite `apps/mobile/app/index.tsx`: remove the
      `HAS_ONBOARDED_KEY` AsyncStorage read entirely; import `useSync`,
      `useProfile`, `getRoutingDecision`, and `buildRoutingDecisionLog`; render
      based on the routing outcome — `loading` → render nothing
      (`InitialSyncOverlay` in `_layout.tsx` covers the UI), `dashboard` →
      `<Redirect href="/(tabs)" />`, `onboarding` →
      `<Redirect href="/onboarding" />`, `retry` → render `<RetrySyncScreen />`
      (component ships in US4; for now, render a placeholder and mark with
      `TODO:` comment pointing to T034).
- [ ] T023 [US1] Emit
      `logger.info("onboarding.routing.decision", buildRoutingDecisionLog(...))`
      once per evaluation in `apps/mobile/app/index.tsx` (FR-014). Payload must
      match T007's contract.

**Checkpoint**: US1 independently testable. Retry screen is placeholder until
US4.

---

## Phase 4: User Story 2 - New user completes the full onboarding flow (Priority: P1)

**Goal**: Brand-new user completes Language → Slides → Currency → Cash-account
confirmation; flag flips to `true` AND cursor clears on completion.

**Independent Test**: Sign up new user; complete the 4-step flow; verify
`profiles.onboarding_completed = true` and `onboarding:<userId>:step` is absent
from AsyncStorage; re-launch → straight to dashboard.

### Tests for User Story 2

- [ ] T024 [P] [US2] Write integration test in
      `apps/mobile/__tests__/app/onboarding.test.tsx`: drive the onboarding
      state machine through all 4 phases with stubbed `profile-service` and
      `onboarding-cursor-service`; assert the correct profile mutation AND
      cursor write happens at each transition; assert the cursor is cleared and
      `completeOnboarding` is invoked on final dismiss. Must FAIL before T026.
- [ ] T025 [P] [US2] Write unit test asserting `CurrencyPickerStep` renders
      WITHOUT a Skip button and that Continue is only enabled once a currency is
      selected. File:
      `apps/mobile/__tests__/components/onboarding/CurrencyPickerStep.test.tsx`.
      Must FAIL before T027.

### Implementation for User Story 2

- [ ] T026 [US2] Rewrite `apps/mobile/app/onboarding.tsx`:
  1. Delete `AsyncStorage.setItem(HAS_ONBOARDED_KEY, "true")` and
     `AsyncStorage.getItem(LANGUAGE_KEY)`. Delete the `checkLanguagePreference`
     useEffect entirely — initial phase now comes from the cursor.
  2. On mount, resolve `userId` via `getCurrentUserId()` and read
     `readOnboardingStep(userId)` → map `null` to `"language"`, otherwise use
     the cursor value. Set initial `phase` accordingly.
  3. `handleLanguageSelected(language)`:
     `await profile-service.setPreferredLanguage(language)` (which internally
     calls `changeLanguage()`), then
     `await writeOnboardingStep(userId, "slides")`, then `setPhase("carousel")`.
  4. `handleCarouselFinish`: `await writeOnboardingStep(userId, "currency")`,
     then `setPhase("currency-picker")`. Delete the `HAS_ONBOARDED_KEY` write.
  5. `handleCurrencySelected(currency)`:
     `await profile-service.setPreferredCurrencyAndCreateCashAccount(currency)`,
     then `await writeOnboardingStep(userId, "cash-account")`, then
     `setPhase("wallet-creation")`. (Renaming the phase string is NOT required
     for US2 but the component name `WalletCreationStep` stays.)
  6. Delete `handleCurrencyPickerSkip` — dead code after T027.
  7. `handleGoToApp` (called on WalletCreationStep completion):
     `await profile-service.completeOnboarding(userId)` (which atomically flips
     the flag and clears the cursor), then navigate to `/(tabs)`.
- [ ] T027 [US2] Remove the `onSkip` prop declaration, the Skip
      `TouchableOpacity`, and the `FALLBACK_CURRENCY` constant from
      `apps/mobile/components/onboarding/CurrencyPickerStep.tsx`. The
      `detectCurrencyFromTimezone` pre-selection behavior is retained but now
      only drives which item appears at the top of the picker. Disable the
      Continue button until a currency is selected.
- [ ] T028 [US2] Modify
      `apps/mobile/components/onboarding/LanguagePickerStep.tsx` if needed:
      verify its `onLanguageSelected` callback passes the typed
      `SupportedLanguage` ("en" | "ar") up to the parent (`onboarding.tsx`)
      which then calls `setPreferredLanguage`. If the current shape differs,
      adjust the prop type. (Component likely needs no behavior change — only
      type tightening.)
- [ ] T029 [US2] Modify
      `apps/mobile/components/onboarding/WalletCreationStep.tsx`: the existing
      `setPreferredCurrency` hook call inside its `useEffect` becomes redundant
      now that T026 step 5 persists currency + creates account via
      `profile-service`. Remove the
      `usePreferredCurrency().setPreferredCurrency` call and the related import.
      `WalletCreationStep` no longer needs to write anything — it just displays
      success/error based on whether the account already exists.

**Checkpoint**: US2 independently functional. The full flow persists all state
correctly and the flag+cursor transitions match FR-011.

---

## Phase 5: User Story 3 - User resumes partial onboarding at the step they left off (Priority: P2)

**Goal**: User who quit mid-flow resumes at the correct step; different accounts
on the same device have isolated cursors.

**Independent Test**: For each of the 3 seed cursor states, assert the correct
starting phase. Plus a two-user test: sign in as User A, progress to `"slides"`,
sign out, sign in as User B, verify B starts at `"language"`, complete B's flow,
sign back in as A, verify A resumes at `"slides"`.

### Tests for User Story 3

- [ ] T030 [P] [US3] Extend `apps/mobile/__tests__/app/onboarding.test.tsx` with
      a new `describe("resume logic", ...)` block. Seed each of the 3 cursor
      states (`"slides"`, `"currency"`, `"cash-account"`) and assert the initial
      rendered phase. Must FAIL if the initial-phase logic regresses.
- [ ] T031 [P] [US3] Add a dedicated integration test for the userId-namespacing
      contract: two mocked authenticated sessions, assert the cursor reads and
      writes use different AsyncStorage keys. Can live in
      `apps/mobile/__tests__/services/onboarding-cursor-service.test.ts` as an
      integration-style test.

### Implementation for User Story 3

- [ ] T032 [US3] Verify that the initial-phase derivation implemented in T026
      step 2 handles all 3 resume states. If any mapping is missing or defaults
      to "language" incorrectly, fix it. Specifically: cursor `"slides"` → phase
      `"carousel"`, cursor `"currency"` → phase `"currency-picker"`, cursor
      `"cash-account"` → phase `"wallet-creation"`. (On the cash-account resume,
      the existing cash account is already in the DB; `WalletCreationStep` must
      detect this and skip re-creation — the `ensureCashAccount` idempotency
      already covers it.)

**Checkpoint**: US3 functional. Partial resume works for all 3 seeded states and
is isolated per user.

---

## Phase 6: User Story 4 - Slow or failed initial sync does not fall through to onboarding (Priority: P2)

**Goal**: User sees retry screen (not onboarding) when pull-sync fails or times
out.

**Independent Test**: Throttle network / stub sync failure; expect overlay for
20s then `RetrySyncScreen`. Retry recovers to dashboard. Sign out returns to
`/auth`.

### Tests for User Story 4

- [ ] T033 [P] [US4] Extend `apps/mobile/__tests__/app/index.test.tsx`: mount
      `<Index />` with `initialSyncState='failed'`; assert `RetrySyncScreen`
      rendered (not onboarding). Repeat for `'timeout'`. Must FAIL before T035.
- [ ] T034 [P] [US4] Unit test for `RetrySyncScreen` in
      `apps/mobile/__tests__/components/RetrySyncScreen.test.tsx`: renders both
      Retry and Sign-out actions, invokes injected callbacks on press. Must FAIL
      before T035.

### Implementation for User Story 4

- [ ] T035 [US4] Create `apps/mobile/components/ui/RetrySyncScreen.tsx`
      implementing the approved V2 "Status Card" mockup at
      `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png` +
      `.html`. Structure (from approved HTML):
  - Full-screen dark container (slate-900 bg) with a centered card (slate-800
    bg, 16pt radius, subtle drop shadow, ~342pt wide, 24pt internal padding,
    centered both axes).
  - Card contents top-to-bottom: 48pt red icon tile (red-400 cloud-offline icon
    on red-500/12% bg, 12pt radius) → 20pt gap → "Sync failed" pill chip
    (red-400 text on red-500/15% bg, 999pt radius) → 16pt gap → headline (22pt
    Inter bold, slate-25) → 12pt gap → body (14pt Inter regular, slate-400) →
    24pt gap → two buttons side-by-side (12pt gap): **LEFT** ghost Sign out —
    **RIGHT** primary Retry.
  - Below card: 24pt gap, helper line "Still not working? Check your internet
    connection." (12pt slate-500).
  - **OMIT** the Stitch-generated top-app-bar (Close X + "Sync Status" title).
    The retry screen has no valid close destination; only Retry and Sign out are
    legitimate.
  - i18n keys from T016. No hardcoded strings.
  - Palette constants only from `apps/mobile/constants/colors.ts`.
  - NativeWind v4 crash avoidance: no `shadow-*` / `opacity-*` /
    `bg-color/opacity` on `TouchableOpacity` / `Pressable` — use inline `style`
    for button shadow/elevation, see `WalletCreationStep.tsx` lines 230-241 for
    the pattern.
  - Props: `{ onRetry: () => void; onSignOut: () => void; }`, both non-optional.
- [ ] T036 [US4] Wire `RetrySyncScreen` into `apps/mobile/app/index.tsx` —
      remove the placeholder from T022, render
      `<RetrySyncScreen onRetry={retryInitialSync} onSignOut={handleSignOut} />`
      when the routing outcome is `retry`.
- [ ] T037 [US4] Wire Sign-out handler in `apps/mobile/app/index.tsx` to the
      existing `signOut()` helper from `apps/mobile/services/logout-service.ts`
      (see research.md § 6 for the reuse path). After sign-out, `AuthGuard` in
      `_layout.tsx` handles the redirect to `/auth`. If the logout service does
      not expose a callable `signOut()` suitable for direct invocation, file a
      sub-investigation rather than inventing a new logout path — do not bypass
      the structured logout flow.
- [ ] ~~T038 [US4] Extend `apps/mobile/__tests__/app/index.test.tsx` with two
      full-flow integration tests: (a) `initialSyncState='failed'` → tap Retry →
      stub sync resolves → dashboard; (b) `failed` → tap Sign out → session
      cleared, redirected to `/auth`.~~ **Deferred to follow-up:** the unit
      coverage landed in PR #238 (`__tests__/app/index.test.tsx` pins all six
      routing outcomes including the retry-screen branch, and
      `__tests__/components/RetrySyncScreen.test.tsx` pins the Retry / Sign-out
      button wiring). A full cold-start Retry→dashboard flow belongs in the
      Detox/Maestro E2E harness, which has not landed on this branch. Follow-up
      ticket will track this once the E2E harness scaffold is in.

**Checkpoint**: All four user stories independently functional. Feature behavior
complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Grep for any remaining runtime reads of `HAS_ONBOARDED_KEY` or
      `LANGUAGE_KEY`
      (`grep -r "HAS_ONBOARDED_KEY\|LANGUAGE_KEY" apps/mobile/ --exclude-dir=__tests__ --exclude=storage-keys.ts`).
      Expect zero matches. If any surface, they are regressions; fix before
      merging.
- [ ] T040 [P] Run `npx tsc --noEmit` from repo root — zero type errors.
- [ ] T041 [P] Run `npm run lint` from `apps/mobile/` — zero errors/warnings on
      changed files.
- [ ] T042 [P] Run the full Jest suite (`npm --workspace apps/mobile test`) —
      all tests pass.
- [ ] T043 Walk through the manual verification checklist in
      `specs/024-skip-returning-onboarding/quickstart.md` on real devices (iOS +
      Android) and tick each item.
- [ ] T044 Verify in Sentry (or local `DEBUG=1` log output) that exactly one
      `onboarding.routing.decision` event fires per app launch, payload matches
      T007's contract.
- [ ] T045 Run `/speckit.analyze` for a final cross-check of spec ↔ plan ↔ tasks
      ↔ code alignment before merging.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Both blockers resolved on 2026-04-18. No longer blocks
  Phase 2 or Phase 6.
- **Phase 2 (Foundational)**: Must complete before Phases 3–6 begin. T003–T019
  are blocking.
- **Phase 3 (US1)**: Depends on Phase 2. Can run in parallel with Phase 4.
- **Phase 4 (US2)**: Depends on Phase 2. Can run in parallel with Phase 3.
- **Phase 5 (US3)**: Depends on T026 (US2) because the initial-phase derivation
  is implemented there.
- **Phase 6 (US4)**: Depends on Phase 2. T036 depends on T022 (US1 placeholder
  must already exist in `index.tsx`). Can otherwise run in parallel with Phases
  3–5.
- **Phase 7 (Polish)**: All tasks depend on Phases 3–6 completing.

### Within-Phase Dependencies

- Schema: **T003 → T004** (strict).
- Routing decision: **T005 → T006 → T007** (TDD: test FAILS first, then
  implement; log test depends on the log helper existing in T006).
- Cursor service: **T008 → T009** (TDD).
- Profile service: **T010 → T011** (TDD). T011 depends on T009 (profile-service
  imports `clearOnboardingStep`).
- Profile hook: **T012 → T013** (TDD).
- SyncProvider: **T014 → T015** (TDD).
- US1: **T020, T021 → T022, T023** (TDD).
- US2: **T024, T025 → T026, T027, T028, T029**; within implementation **T027,
  T028, T029 can run in parallel** (different files); **T026 depends on T027
  (Skip button removed) + T028 (typed callback) + T029 (redundant hook
  removed)**.
- US3: **T030, T031 → T032** (TDD).
- US4: **T033, T034 → T035**; **T036 depends on T022 and T035**; **T038 depends
  on T036 and T037**.

### Parallel Opportunities

**Phase 2**: Five contributors can run TDD-RED tasks in parallel — T005 ∥ T008 ∥
T010 ∥ T012 ∥ T014. Then their implementations T006/T007 ∥ T009 ∥ T011 ∥ T013 ∥
T015 can run simultaneously. T016 (i18n), T017 (docs), T018 (legacy key delete),
T019 (i18n-startup audit) all also run in parallel.

**Phases 3 and 4** in parallel if two contributors: Dev A owns `index.tsx`
(US1), Dev B owns `onboarding.tsx` + the three onboarding components (US2). No
file conflicts.

**Phase 6** runs in parallel with Phases 3/4/5 except for T036 which touches
`index.tsx` after T022.

**Phase 7** tasks T039–T042 are all [P].

---

## Parallel Example: Phase 2 TDD RED tasks

```bash
Dev A: T005  tests/utils/routing-decision.test.ts
Dev B: T008  tests/services/onboarding-cursor-service.test.ts
Dev C: T010  tests/services/profile-service.test.ts
Dev D: T012  tests/hooks/useProfile.test.ts
Dev E: T014  tests/providers/SyncProvider.test.tsx
```

## Parallel Example: US1 + US2 + US4 concurrently

```bash
Dev A (US1):  T020, T021 → T022, T023
Dev B (US2):  T024, T025 → T027, T028, T029 → T026
Dev C (US4):  T033, T034 → T035 → T036 (after T022) → T037, T038
```

---

## Implementation Strategy

### MVP = US1 + US2 combined

US1 alone is not demo-worthy — today's onboarding writes AsyncStorage, not the
server flag, so a new user would complete the flow and then be sent back to
onboarding on next launch. Ship **Phases 1 + 2 + 3 + 4** together as the MVP.

### Incremental delivery after MVP

1. **MVP (US1 + US2)**: returning users skip onboarding; new users complete the
   4-step flow with server-persisted state. Deploy/demo.
2. **US3**: partial-resume polish. Deploy/demo.
3. **US4**: retry-screen safeguard for slow/failed syncs. Deploy/demo.

### Stop points

- After **T023**: US1 testable against pre-seeded profile. Checkpoint.
- After **T029**: MVP feature-complete. Pause and validate end-to-end manually
  before Phase 5.
- After **T038**: feature-complete. Run polish phase.

---

## Notes

- [P] markers indicate file-level independence.
- Every implementation task has a corresponding TDD test task that precedes it
  and must FAIL first.
- Do not commit implementation without its test. Do not commit test code that
  already passes without an implementation change — the RED step must be
  observed.
- Legacy AsyncStorage keys are **deleted**, not deprecated (FR-015, confirmed
  2026-04-18).
- If `apps/mobile/services/logout-service.ts` does not expose a callable
  `signOut()` suitable for the retry screen, treat the discrepancy as a
  T037-blocking sub-task — do not invent a new logout path.
- Sign-out inside the happy-path onboarding steps and back/forward navigation
  between steps are out of scope — tracked as
  [#242](https://github.com/Msamir22/Monyvi/issues/242) and
  [#243](https://github.com/Msamir22/Monyvi/issues/243).
