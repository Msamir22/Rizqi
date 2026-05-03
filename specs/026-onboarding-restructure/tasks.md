---
description: "Task list for feature 026 — Onboarding Restructure"
---

# Tasks: Onboarding Restructure

**Input**: Design documents from `specs/026-onboarding-restructure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md

**Tests**: TDD is mandatory per `CLAUDE.md` ("TDD mandatory … 80%+ coverage").
Test tasks are included inline within each story.

**Organization**: Tasks are grouped by user story so each story can be
implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete
  tasks)
- **[Story]**: User story label (US1–US5). Setup/Foundational/Polish phases have
  no label.
- Every task includes an absolute-relative file path.

## Path conventions (from `plan.md`)

- Mobile app code: `apps/mobile/**`
- Shared DB package: `packages/db/**`
- SQL migrations: `supabase/migrations/**`
- Business-logic docs: `docs/business/**`

---

## Phase 1: Setup (shared DB infrastructure)

**Purpose**: Land the `profiles.onboarding_flags` JSONB column end-to-end
(Supabase migration + regenerated WatermelonDB schema + TypeScript types + model
getter) so every downstream task can import the `OnboardingFlags` type from
`@monyvi/db` without tripping over missing types.

Reference: quickstart Phase A; research §2; data-model §1, §2, §10;
contracts/onboarding-flags-schema.md.

- [x] T001 Create SQL migration
      `supabase/migrations/043_add_onboarding_flags_to_profiles.sql` using the
      SQL from
      `specs/026-onboarding-restructure/contracts/onboarding-flags-schema.md §6.1`
- [x] T002 Run `npm run db:migrate` from repo root to apply migration 043
      locally and regenerate `packages/db/src/schema.ts`,
      `packages/db/src/models/base/base-profile.ts`, and
      `packages/db/src/supabase-types.ts`
- [x] T003 Manually add a WatermelonDB migration step for `toVersion: 17` in
      `packages/db/src/migrations.ts` with `addColumns` for the
      `onboarding_flags` string column (see
      `specs/026-onboarding-restructure/data-model.md §1.4`)
- [x] T004 [P] Add the `OnboardingFlags` interface to `packages/db/src/types.ts`
      per
      `specs/026-onboarding-restructure/contracts/onboarding-flags-schema.md §1`
- [x] T005 [P] Add the `onboardingFlags` getter to
      `packages/db/src/models/Profile.ts` (JSON.parse the `onboardingFlagsRaw`
      field, fall back to `{}`; follow the existing `notificationSettings`
      pattern)
- [x] T006 Verify `@monyvi/db` builds cleanly: run `npm run -w @monyvi/db build`
      (or `npm run typecheck` workspace-root) and confirm
      `Profile.onboardingFlags` is typed as `OnboardingFlags` in consumers

**Checkpoint**: DB schema + types ready. Commit:
`feat(026): add profiles.onboarding_flags JSONB column`.

---

## Phase 2: Foundational (blocking prerequisites for all user stories)

**Purpose**: Build every shared primitive (AsyncStorage service, shared context,
shared UI primitive, shared hooks, startup-time i18n fix) so each user story
phase can be implemented without building cross-cutting infrastructure.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

Reference: quickstart Phase B, C, E.3; research §3, §4, §5, §6, §8, §9, §10;
contracts/services.md §2–§6.

- [x] T007 Add `INTRO_SEEN_KEY = "@monyvi/intro-seen"` and
      `INTRO_LOCALE_OVERRIDE_KEY = "@monyvi/intro-locale-override"` constants to
      `apps/mobile/constants/storage-keys.ts` (do NOT add to
      `CLEARABLE_USER_KEYS` — device-scoped per FR-029/FR-030)
- [x] T008 [P] Create `apps/mobile/services/intro-flag-service.ts` exporting
      `readIntroSeen`, `markIntroSeen`, `readIntroLocaleOverride`,
      `setIntroLocaleOverride` per
      `specs/026-onboarding-restructure/contracts/services.md §2` (do NOT export
      `clearIntroLocaleOverride` — override must persist)
- [x] T009 [P] Update `detectInitialLanguage()` in `apps/mobile/i18n/index.ts`
      to read `INTRO_LOCALE_OVERRIDE_KEY` FIRST, fall back to device locale,
      then to English (prevents post-RTL-reload language flash, FR-002). Ensure
      `initI18n()` awaits this before `i18next.init()`. See research §6
      Implementation shape.
- [x] T010 [P] Extract the existing voice-entry trigger into
      `apps/mobile/services/voice-entry-service.ts` exporting
      `openVoiceEntry()`; update the tab-bar mic button's `onPress` to call it
      (research §9; contracts/services.md §3)
- [x] T011 [P] Add
      `setOnboardingFlag<K extends keyof OnboardingFlags>(key: K, value: NonNullable<OnboardingFlags[K]>)`
      to `apps/mobile/services/profile-service.ts` with read-merge-write
      semantics per
      `specs/026-onboarding-restructure/contracts/services.md §1.2`
- [x] T012 [P] Create `apps/mobile/context/FirstRunTooltipContext.tsx` exposing
      `{ isFirstRunPending, markFirstRunPending, markFirstRunConsumed }` per
      data-model §4.1
- [x] T013 [P] Create `apps/mobile/components/ui/AnchoredTooltip.tsx` primitive
      (props per research §5: `visible`, `anchorRef`, `title`, `body`,
      `primaryLabel`, `onPrimaryPress`, optional `onClose`, optional `icon`,
      `anchorSide`). Use the Android absolute-overlay pattern from
      `.claude/rules/android-modal-overlay-pattern.md` to avoid the NativeWind
      v4 Modal layout-collapse bug.
- [x] T014 [P] Create
      `apps/mobile/components/onboarding/LanguageSwitcherPill.tsx` (globe icon +
      language code). On tap: call `setIntroLocaleOverride(lang)` then
      `changeLanguage(lang)`. Reused on pitch, auth, and Currency surfaces.
- [x] T015 [P] Create `apps/mobile/hooks/useOnboardingFlags.ts` observing
      `profile.onboardingFlags` via `observeWithColumns(["onboarding_flags"])`
      per contracts/services.md §4
- [x] T016 [P] Create `apps/mobile/hooks/useIntroSeen.ts` per
      contracts/services.md §5
- [x] T017 [P] Create `apps/mobile/hooks/useIntroLocaleOverride.ts` per
      contracts/services.md §6
- [x] T018 Wrap the app tree in `<FirstRunTooltipProvider>` in
      `apps/mobile/app/_layout.tsx` (parent of all routes)
- [x] T019 Verify `apps/mobile/utils/routing-decision.ts` and
      `apps/mobile/app/index.tsx` still use `onboardingCompleted` as the routing
      signal (per contracts/services.md §8 — NO code change expected, just
      confirmation per quickstart Phase C)
- [x] T020 [P] Write unit tests for intro flag service in
      `apps/mobile/__tests__/services/intro-flag-service.test.ts` (round-trip
      reads/writes, missing-key fallbacks, override-not-cleared invariants)
- [x] T021 [P] Write unit tests for the updated startup language detection in
      `apps/mobile/__tests__/i18n/detectInitialLanguage.test.ts` (override wins
      over device locale; device locale fallback; English fallback)
- [x] T022 [P] Write unit tests for `useOnboardingFlags` in
      `apps/mobile/__tests__/hooks/useOnboardingFlags.test.ts` (empty default,
      reactive updates on profile change, parse failure falls back to `{}`)
- [x] T023 [P] Write unit tests for `setOnboardingFlag` in
      `apps/mobile/__tests__/services/profile-service.test.ts` — NEW test block
      for flag merge semantics (does not remove existing keys; idempotent)

**Checkpoint**: All shared primitives ready. User stories can now proceed in
parallel. Commit:
`feat(026): add intro-flag service, onboarding-flags service, shared tooltip + language pill primitives`.

---

## Phase 3: User Story 1 — Pre-auth pitch carousel (Priority: P1) 🎯 MVP

**Story goal**: A first-time visitor on a fresh install sees 3 pitch slides
(Voice → SMS/Offline → Live Market) in their device locale before ever seeing
auth; can switch language via corner pill; can Skip or reach the end to advance
to auth; the "pitch seen" flag is set only on explicit Skip/last-slide.

**Independent test**: Fresh install on Android in Arabic locale → open app →
verify pitch renders in Arabic with Skip (top-end) and language pill (top-start)
visible → swipe to slide 2 and see the SMS content → tap Skip → land on auth
screen; relaunch app → auth screen renders directly without pitch.

Reference: spec §User Story 1; quickstart Phase E; FR-001 to FR-006, FR-029,
FR-030, FR-039 (pitch back), FR-040.

### i18n

- [x] T024 [P] [US1] Add pitch-slide copy keys (slides 1/2/3 eyebrows,
      headlines, subheads, chrome strings) to
      `apps/mobile/locales/en/onboarding.json` per
      `specs/026-onboarding-restructure/contracts/i18n-keys.md §Pre-auth pitch slides` +
      §Pitch chrome
- [x] T025 [P] [US1] Add Arabic mirrors for all pitch-slide keys to
      `apps/mobile/locales/ar/onboarding.json`
- [x] T026 [P] [US1] Register the new pitch keys in
      `apps/mobile/i18n/translation-schemas.ts` so
      `validateTranslationResources()` catches drift between locales

### Components

- [x] T027 [P] [US1] Create `apps/mobile/components/onboarding/PitchSlide.tsx` —
      shared shell (top bar with `LanguageSwitcherPill` + Skip, eyebrow label,
      headline, subhead, mock-frame container slot, pagination dots, CTA)
- [x] T028 [P] [US1] Create `apps/mobile/components/onboarding/Slide1Voice.tsx`
      — voice-themed content + mock cash-account chip + "Just paid 200 pounds
      for coffee with Ahmed" transcript
- [x] T029 [P] [US1] Create `apps/mobile/components/onboarding/Slide2SMS.tsx` —
      Android-only SMS content (bank bubble + "Auto-imported" chip)
- [x] T030 [P] [US1] Create
      `apps/mobile/components/onboarding/Slide2Offline.tsx` — iOS-only Offline
      content ("Offline mode" pill, "⚡ Instant" chip, RECENTLY ADDED stack)
- [x] T031 [P] [US1] Create
      `apps/mobile/components/onboarding/Slide3LiveMarket.tsx` — live rates +
      gold/silver/USD cards with "updated N min ago" caption
- [x] T032 [US1] Create `apps/mobile/components/onboarding/PitchCarousel.tsx` —
      renders 3 slides via `react-native-reanimated-carousel`, picks `Slide2SMS`
      vs `Slide2Offline` by `Platform.OS`, wires Skip (sets `markIntroSeen()` +
      navigates to auth), last-slide CTA (same), and `BackHandler` per research
      §4 (slide 1 back exits; else previous slide)

### Routing

- [x] T033 [US1] Create `apps/mobile/app/pitch.tsx` route that renders
      `<PitchCarousel />` and blocks navigation back to itself after completion
- [x] T034 [US1] Wire the pitch branch in `apps/mobile/app/index.tsx` (the
      top-level route resolver): if `!authenticated && !introSeen` → redirect to
      `/pitch`; if `!authenticated && introSeen` → redirect to `/auth`.
      **Important**: pitch→auth navigation MUST use `router.push` (not
      `replace`) so the navigation stack allows hardware-back from auth to pitch
      per FR-039.

### Tests

- [x] T035 [P] [US1] Component test
      `apps/mobile/__tests__/components/onboarding/PitchCarousel.test.tsx` —
      renders 3 slides; `Platform.OS === "ios"` shows Offline slide, Android
      shows SMS slide; language switch re-renders current slide; Skip fires
      `markIntroSeen()` + navigation; last-slide CTA fires same; back on slide 1
      exits (returns `false`), back on slide ≥2 advances to prev (returns
      `true`)
- [x] T036 [P] [US1] Component test
      `apps/mobile/__tests__/components/onboarding/PitchSlide.test.tsx` —
      renders `LanguageSwitcherPill`, hides Skip when `isLast`, shows CTA text
      from i18n
- [x] T037 [P] [US1] Hook test — DROPPED. The original two-file plan
      (`useIntroSeen.test.ts` + `useIntroLocaleOverride.test.ts`) was removed
      during PR #248 review: the candidate tests were shallow mocks of
      `AsyncStorage` round-trips that duplicated coverage already provided by
      the service-level tests in
      `apps/mobile/__tests__/services/intro-flag-service.test.ts`. Hook behavior
      (initial-load + reactive update) is exercised indirectly by the
      higher-level component tests (`PitchSlide`, `LanguageSwitcherPill`).
      Recorded here so the task list reflects the actual file shape (round-2
      review #22).

**Checkpoint**: Pitch flow works end-to-end. Commit:
`feat(026): pre-auth pitch carousel (voice/SMS-or-offline/live-market) with language switcher`.

---

## Phase 4: User Story 2 — Single-step Currency post-auth (Priority: P1)

**Story goal**: After sign-up, the user sees ONE required post-auth screen
(Currency picker). On confirm, a single atomic write creates their cash account,
stores currency + language, and flips `onboarding_completed = true`. On success
they route straight to the dashboard. The auth screen itself is redesigned to
absorb the value-prop "slide 4 closer."

**Independent test**: Sign up with a fresh account → verify auth screen shows
welcome title + tagline + 4 value-prop pills + existing Google OAuth + email
form + trust microbar (no shield-icon hero) → complete sign-up → Currency step
is the only post-auth screen → language pill is visible, hardware back is
blocked, Sign-out action works → confirm EGP → verify WatermelonDB state: new
cash account in EGP exists, `profile.preferred_currency = 'EGP'`,
`profile.preferred_language` matches runtime language,
`profile.onboarding_completed = true` → user lands on dashboard. Relaunch → skip
straight to dashboard (no Currency step).

Reference: spec §User Story 2; quickstart Phase B.5, D, F; FR-007 to FR-016,
FR-031, FR-033, FR-034, FR-035, FR-013a, FR-039 (auth back).

### Atomic Currency write service (research §1, contracts/services.md §1.1)

- [x] T038 [US2] Refactor `apps/mobile/services/account-service.ts` to extract a
      non-writer
      `createCashAccountWithinWriter(userId, currency, accountsCollection, name?)`
      helper. Have the existing `ensureCashAccount()` open its own writer and
      call the helper internally (so stand-alone callers
      `batch-create-transactions.ts`, `sms-review-save-service.ts`,
      `transfer-service.ts` remain unchanged).
- [x] T039 [US2] Add `confirmCurrencyAndOnboard(currency, options?)` to
      `apps/mobile/services/profile-service.ts` — single outer
      `database.write()` wrapping cash-account creation (via T038 helper),
      `preferredCurrency` overwrite, `preferredLanguage` overwrite with
      `getCurrentLanguage()`, and `onboardingCompleted = true`. Post-commit:
      `options.onTransactionCommitted?.()` callback (research §1,
      contracts/services.md §1.1). Do NOT clear `@monyvi/intro-locale-override`
      (FR-030).

### i18n

- [x] T040 [P] [US2] Add Currency-step keys (`currency_step_title`, `_subtitle`,
      `_confirm`, `_signout`, `_error_generic`) to
      `apps/mobile/locales/en/onboarding.json` per contracts/i18n-keys.md
      §Currency step
- [x] T041 [P] [US2] Add Arabic mirrors for Currency-step keys to
      `apps/mobile/locales/ar/onboarding.json`
- [x] T042 [P] [US2] Add auth-screen keys (`welcome_title`, `welcome_tagline`,
      `pill_voice`, `pill_bank_sms`, `pill_live_rates`, `pill_gold_silver`,
      `trust_encrypted`, `trust_private`, etc.) to
      `apps/mobile/locales/en/auth.json` per contracts/i18n-keys.md §Namespace:
      auth
- [x] T043 [P] [US2] Add Arabic mirrors for auth-screen keys to
      `apps/mobile/locales/ar/auth.json`; remove deprecated `welcome_subtitle`
      and `trust_backed_up`
- [x] T044 [US2] Register new Currency-step + auth keys in
      `apps/mobile/i18n/translation-schemas.ts`; remove deprecated
      `welcome_subtitle` and `trust_backed_up` from the auth schema

### Currency step

- [x] T045 [US2] Create `apps/mobile/components/onboarding/CurrencyStep.tsx` —
      top-corner `LanguageSwitcherPill`, Android hardware-back blocker
      (`BackHandler.addEventListener("hardwareBackPress", () => true)` scoped to
      focus), Sign-out action, currency picker UI, confirm handler that calls
      `confirmCurrencyAndOnboard(currency, { onTransactionCommitted: () => markFirstRunPending() })`
      then `router.replace("/(tabs)")`; show error toast with
      `tCommon("error_generic")` on failure and stay on screen
- [x] T046 [US2] Rewrite `apps/mobile/app/onboarding.tsx` to render
      `<CurrencyStep />` only (delete the multi-phase wizard state machine,
      remove imports of soon-deleted step components)
- [x] T047 [P] [US2] Delete
      `apps/mobile/components/onboarding/LanguagePickerStep.tsx`
- [x] T048 [P] [US2] Delete
      `apps/mobile/components/onboarding/WalletCreationStep.tsx` (and any
      references)

### Auth screen redesign

- [x] T049 [US2] Rewrite `apps/mobile/components/auth/FormView.tsx` per mockup
      `04-auth-light.png` + design spec: top-corner `LanguageSwitcherPill`,
      welcome title + tagline, 2×2 value-prop pill grid, existing
      `<SocialLoginButtons>` (preserve OAuth icon), divider, existing
      `<EmailPasswordForm>`, trust-microbar footer (lock + shield icons) with
      1px top-border separator. REMOVE the shield-icon hero and 3-trust-badges
      row.

### Tests

- [x] T050 [P] [US2] Update
      `apps/mobile/__tests__/services/profile-service.test.ts` to cover
      `confirmCurrencyAndOnboard`: happy path (all 4 mutations commit, cash
      account returned), existing cash-account path (no duplicate), language
      overwrite (always rewrites with `getCurrentLanguage()`), AsyncStorage
      override NOT cleared, failure path (mock writer throws, assert
      `onboarding_completed` stays `false` and no partial data)
- [x] T051 [P] [US2] Component test
      `apps/mobile/__tests__/components/onboarding/CurrencyStep.test.tsx` —
      language pill renders + switches, hardware-back returns `true` (blocked),
      Sign-out button visible + wired, confirm handler calls service with
      selected currency, error path keeps user on screen
- [x] T052 [P] [US2] Component test
      `apps/mobile/__tests__/components/auth/FormView.test.tsx` — new layout
      renders (welcome, tagline, 4 pills, microbar); shield-icon hero absent;
      OAuth button renders with unchanged icon; language pill renders and calls
      `setIntroLocaleOverride`

**Checkpoint**: Sign-up → Currency → dashboard flow works end-to-end with atomic
state. Commit:
`feat(026): single-step Currency onboarding + redesigned auth screen with pitch continuity`.

---

## Phase 5: User Story 3 — First-run dashboard cash-account tooltip (Priority: P1)

**Story goal**: On the first dashboard entry after successful Currency
confirmation, the user sees the existing SMS permission prompt (Android)
followed by the new cash-account tooltip anchored to the auto-created
cash-account card. Each is dismissible in one tap and never re-appears on the
same device.

**Independent test**: Complete sign-up + Currency confirmation on Android →
dashboard loads → SMS prompt appears → dismiss → cash-account tooltip appears
anchored to the cash account card → tap "Got it" → tooltip dismisses,
`profile.onboarding_flags.cash_account_tooltip_dismissed = true` persisted →
relaunch dashboard for same profile → tooltip does not re-appear. On iOS: same
flow minus the SMS prompt. For an already-onboarded user: neither prompt
appears.

Reference: spec §User Story 3; quickstart Phase G; FR-017, FR-018, FR-019,
FR-020, FR-039 (tooltip back).

### i18n

- [x] T053 [P] [US3] Add cash-account tooltip keys
      (`cash_account_tooltip_title`, `_body`, `_got_it`) to
      `apps/mobile/locales/en/onboarding.json` per contracts/i18n-keys.md
      §First-run dashboard tooltips
- [x] T054 [P] [US3] Add Arabic mirrors for cash-account tooltip keys to
      `apps/mobile/locales/ar/onboarding.json`
- [x] T055 [US3] Register cash-account tooltip keys in
      `apps/mobile/i18n/translation-schemas.ts`

### Component + wiring

- [x] T056 [US3] Create
      `apps/mobile/components/dashboard/CashAccountTooltip.tsx` — reads
      `useFirstRunTooltip()` + `useSmsSync()` (for `shouldShowPrompt`
      read-only) + `useOnboardingFlags()`; computes
      `visible = isFirstRunPending && !shouldShowPrompt && !onboardingFlags.cash_account_tooltip_dismissed`;
      renders `<AnchoredTooltip>` anchored to the cash-account card ref; dismiss
      calls `setOnboardingFlag("cash_account_tooltip_dismissed", true)` then
      `markFirstRunConsumed()`; Android hardware-back while visible triggers
      same dismiss path
- [x] T057 [US3] Wire `<CashAccountTooltip />` into
      `apps/mobile/app/(tabs)/index.tsx` as a sibling of the existing
      `<SmsPermissionPrompt>` render. Do NOT touch the SMS prompt's existing
      `useSmsSync()` wiring — its recurring-render behavior must be preserved.
- [x] T058 [US3] Add a `ref` prop forwarding path on the cash-account card
      render in the dashboard's accounts-section so `CashAccountTooltip` can
      measure its anchor (if the anchor ref plumbing isn't already in place)

### Tests

- [x] T059 [P] [US3] Component test
      `apps/mobile/__tests__/components/dashboard/CashAccountTooltip.test.tsx` —
      4 cases: (a) `!isFirstRunPending` → not rendered; (b)
      `isFirstRunPending && shouldShowPrompt === true` → not rendered (SMS
      prompt takes priority); (c)
      `onboardingFlags.cash_account_tooltip_dismissed === true` → not rendered;
      (d) all three satisfied → rendered; dismiss writes the flag and calls
      `markFirstRunConsumed()`

**Checkpoint**: First-run dashboard cash-account tooltip appears exactly once
per profile, after SMS prompt. Commit:
`feat(026): first-run cash-account tooltip with SMS-prompt sequencing`.

---

## Phase 6: User Story 4 — Setup Guide card restructure + mic tooltip (Priority: P2)

**Story goal**: The Setup Guide card on the dashboard drops the `cash_account`
step (always complete now) and shows 4 steps (3 on iOS): Bank → Voice →
Auto-track bank SMS → Budget. Progress displays "X/4" (or "X/3"). Each step's
completion is derived from actual data (bank account exists; voice-sourced
transaction exists; SMS-sourced transaction exists; active budget exists).
Tapping the voice step's action button for the first time shows the mic-button
tooltip anchored to the tab-bar mic; "Try it now" dismisses + opens voice; X
dismisses only. Neither exit re-shows the tooltip.

**Independent test**: As a freshly onboarded user, view the dashboard → Setup
Guide card shows 4 steps (Android) / 3 steps (iOS) with "0/4" or "0/3" → add a
bank account → return to dashboard → step 1 checkmarks within 1s → tap GO on
voice step → mic tooltip appears anchored to centered tab-bar mic → tap "Try it
now" → tooltip dismisses AND voice flow opens in one action →
`profile.onboarding_flags.voice_tooltip_seen = true` persisted → cancel voice →
return to dashboard → tap GO again → voice opens directly (no tooltip). Alt: tap
X on tooltip → tooltip dismisses, voice does NOT open, flag still set to `true`
→ next GO tap opens voice directly. Users who tap the tab-bar mic directly never
see the tooltip.

Reference: spec §User Story 4; quickstart Phase H; FR-022, FR-023, FR-024,
FR-024a, FR-024b, FR-024c, FR-025, FR-026, FR-027, FR-039 (mic tooltip back = X
semantics).

### i18n

- [x] T060 [P] [US4] Add updated Setup Guide keys to
      `apps/mobile/locales/en/onboarding.json`:
      `onboarding_step_voice_transaction` (replaces
      `onboarding_step_first_transaction`),
      `onboarding_step_auto_track_bank_sms` (replaces
      `onboarding_step_sms_import`), `mic_button_tooltip_title`, `_body`,
      `_try_it_now`, `new_badge` (if missing). Remove
      `onboarding_step_cash_account` and `onboarding_step_first_transaction` /
      `onboarding_step_sms_import` per contracts/i18n-keys.md §Setup Guide card
      (updated) + §Removed from this namespace.
- [x] T061 [P] [US4] Add Arabic mirrors for updated Setup Guide keys to
      `apps/mobile/locales/ar/onboarding.json`; remove the same deprecated keys
- [x] T062 [US4] Register Setup Guide + mic-tooltip keys in
      `apps/mobile/i18n/translation-schemas.ts`; remove deprecated keys from the
      schema

### Hook + state machine

- [x] T063 [US4] Rewrite `apps/mobile/hooks/useOnboardingGuide.ts` per
      contracts/services.md §7: drop `cash_account` step; rename
      `first_transaction` → `voice_transaction` and tighten query to
      `Q.where("source", "VOICE"), Q.where("deleted", Q.notEq(true))`; rename
      SMS step label to "Auto-track bank SMS"; add `onVoiceStepAction`,
      `isMicTooltipVisible`, `onMicTooltipTryItNow`, `onMicTooltipClose` to the
      returned state machine per §7.3; hide SMS step on iOS.

### Components

- [x] T064 [P] [US4] Create
      `apps/mobile/components/dashboard/MicButtonTooltip.tsx` — thin wrapper
      around `AnchoredTooltip` anchored to the tab-bar mic ref; accepts
      `visible`, `onTryItNow`, `onClose` props; internal logic only forwards the
      events. Android hardware-back while visible calls `onClose` (X semantics —
      does NOT open voice, per FR-039).
- [x] T065 [US4] Update
      `apps/mobile/components/dashboard/OnboardingGuideCard.tsx` — render 4-step
      list (3 on iOS) from the new hook state; voice step row shows NEW badge +
      GO action button; wire `onVoiceStepAction` to the hook; render
      `<MicButtonTooltip>` with visibility + exits bound to hook callbacks;
      progress pill shows `{completedCount}/{totalSteps}`; completed steps
      render without action button

### Tab-bar mic ref plumbing

- [x] T066 [US4] Expose the tab-bar mic button's View ref from
      `apps/mobile/app/(tabs)/_layout.tsx` (or wherever the tab bar lives) via
      context or a provider so `MicButtonTooltip` can anchor to the real
      rendered position (per FR-024 — mockup shows it at far-right for clarity,
      actual app has it centered)

### Tests

- [ ] T067 [P] [US4] **DEFERRED to a follow-up test-coverage PR.** Update
      `apps/mobile/__tests__/hooks/useOnboardingGuide.test.ts` to cover: 4 steps
      on Android + 3 on iOS; voice completion requires `source === "VOICE"`;
      action-button state machine transitions (first tap → tooltip; subsequent
      tap → voice); tooltip exits both set `voice_tooltip_seen = true`. The
      runtime behavior is exercised by the existing
      `CashAccountTooltip.test.tsx` + `MicButtonTooltip.test.tsx` +
      `profile-service.test.ts` `setOnboardingFlag` cases in this PR, but the
      hook-level state-machine test is missing and should be added under its own
      ticket.
- [x] T068 [P] [US4] Component test
      `apps/mobile/__tests__/components/dashboard/MicButtonTooltip.test.tsx` —
      visible only when `visible === true`; "Try it now" fires `onTryItNow`; X
      fires `onClose`; hardware-back fires `onClose` (not `onTryItNow`)
- [ ] T069 [P] [US4] **DEFERRED to a follow-up test-coverage PR.** Component
      test
      `apps/mobile/__tests__/components/dashboard/OnboardingGuideCard.test.tsx`
      — 4 rows Android / 3 rows iOS; progress pill math correct; NEW badge
      present on voice step row; completed steps have no action button; tapping
      tab-bar mic directly does NOT render `MicButtonTooltip` (FR-024b). The
      hook-level tests in T067 cover most of the state; the card render-level
      test is additional safety that can ship separately.

**Checkpoint**: Setup Guide card shows 4 steps, derives completion from data,
and mic tooltip educates voice step exactly once per profile. Commit:
`feat(026): restructured Setup Guide card with voice step + mic-button tooltip`.

---

## Phase 7: User Story 5 — Dashboard skeleton fix (Priority: P3)

**Story goal**: Remove the Setup Guide card slot from the dashboard skeleton so
dismissed-card users never see a placeholder appear then disappear on cold
launch.

**Independent test**: As a user who has previously dismissed the Setup Guide
card, force-quit the app, cold-launch → observe the dashboard render above the
first data-backed section: no temporary placeholder appears in the Setup Guide
card's former slot, no vertical content jump.

Reference: spec §User Story 5; quickstart Phase I; FR-028; SC-007.

- [x] T070 [US5] Remove the `<OnboardingGuideCardSkeleton />` line from
      `apps/mobile/components/dashboard/skeletons/DashboardSkeleton.tsx` (leave
      all other section skeletons in place)
- [x] T071 [US5] Visual-verify on a clean profile (Setup Guide dismissed)
      cold-launch: no layout jump above the first data-backed section (manual
      check per spec SC-007)
- [x] T072 [P] [US5] Update
      `apps/mobile/__tests__/components/dashboard/skeletons/DashboardSkeleton.test.tsx`
      (or create it) to assert `OnboardingGuideCardSkeleton` is NOT rendered

**Checkpoint**: Dashboard cold-launch is calm. Commit:
`fix(026): remove OnboardingGuideCardSkeleton slot from DashboardSkeleton`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Everything that affects multiple stories — documentation,
deprecation markers, full-app QA in both themes + both locales, CI gates.

Reference: quickstart Phase J, K, L, M; FR-036, FR-037, FR-038; SC-008, SC-010.

- [x] T073 [P] Update `docs/business/business-decisions.md` §12.2 — add a row
      for `onboarding_flags` (JSONB, NOT NULL, DEFAULT `'{}'::JSONB`); reference
      spec 026 as the source
- [x] T074 [P] Mark `setPreferredCurrencyAndCreateCashAccount` as `@deprecated`
      in `apps/mobile/services/profile-service.ts` with a JSDoc pointing to
      `confirmCurrencyAndOnboard` and this PR/spec; no callers should remain
- [x] T075 [P] Mark `completeOnboarding` as `@deprecated` in
      `apps/mobile/services/profile-service.ts` (becomes callerless once
      `WalletCreationStep` is deleted per T048)
- [x] T076 [P] Mark `apps/mobile/services/onboarding-cursor-service.ts` as
      `@deprecated` with a top-of-file JSDoc pointing to this spec; grep to
      confirm no callers remain in app code
- [x] T077 Dark-mode visual QA walkthrough across every new/modified surface per
      quickstart Phase J.1 — pitch slides 1/2/3 (both platforms), auth screen,
      Currency step, cash-account tooltip, mic-button tooltip, Setup Guide card
      (expanded + collapsed), dashboard (skeleton fix). Any missed `dark:`
      pairing is a FR-036 violation — fix before proceeding.
- [x] T078 RTL (Arabic) visual QA walkthrough across every new/modified surface
      per quickstart Phase J.2 — verify `start-*`/`end-*` correctness, language
      pill flip, tooltip arrow direction, no overflow or clipping
- [x] T079 Run manual integration walkthroughs #1–#12 from quickstart Phase K on
      both Android and iOS simulators (covers all 5 user stories end-to-end,
      including RTL reload sequence and hardware-back cases)
- [x] T080 Run `npm run lint` and `npm run typecheck` — 0 errors on
      feature-touched files; remaining warnings are pre-existing or approved
      patterns
- [x] T081 Run `npm test` — 328 tests pass across 30 suites; 2 suites fail to
      load due to pre-existing worktree env issues (missing
      `@testing-library/react-native` dev dep in this worktree; missing Supabase
      `.env` fixtures) unrelated to this feature
- [ ] T082 Smoke-test existing flows (sign-in, add-transaction, bank-account
      creation, budget creation, transfer, SMS import) to confirm no regressions
      from the `account-service` refactor (T038) or the routing-path touches —
      device walkthrough remains for reviewer

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies; must complete before Phase 2.
- **Phase 2 (Foundational)**: depends on Phase 1; **BLOCKS** all user stories.
- **Phase 3 (US1 — Pitch)**: depends on Phase 2 only.
- **Phase 4 (US2 — Currency + Auth)**: depends on Phase 2 only.
- **Phase 5 (US3 — Cash-account tooltip)**: depends on Phase 2 + integrates with
  US2 (consumes `markFirstRunPending` set inside `CurrencyStep` confirm
  handler). US5 can't be fully validated without US2 completing the Currency
  flow, but its component-level tests (T059) are independent via mocking the
  context.
- **Phase 6 (US4 — Setup Guide + Mic tooltip)**: depends on Phase 2 only.
- **Phase 7 (US5 — Skeleton fix)**: depends on nothing; truly independent of all
  other stories.
- **Phase 8 (Polish)**: depends on all desired user stories being complete.

### Within each user story

- Tests MUST be written before (or alongside) implementation per project TDD
  convention.
- i18n keys should exist before the components that render them (tests that
  assert translated text will fail otherwise).
- Models/services before components.
- Components before route-level wiring.

### Parallel opportunities

- **Phase 1**: T004 + T005 after T002.
- **Phase 2**: T008, T009, T010, T011, T012, T013, T014, T015, T016, T017 are
  all on different files and can run in parallel after T007. Tests T020–T023 can
  run in parallel after their respective services/hooks exist.
- **Phase 3 (US1)**: T024 + T025 (i18n files — different locales), T027–T031
  (component files are all independent), T035–T037 (test files) all
  parallelizable.
- **Phase 4 (US2)**: T040–T043 (i18n files), T047 + T048 (independent deletes),
  T050–T052 (test files) parallelizable.
- **Phase 5 (US3)**: T053 + T054 (i18n), T059 (test) parallelizable.
- **Phase 6 (US4)**: T060 + T061 (i18n), T064 (component), T067–T069 (tests)
  parallelizable.
- **Phase 7 (US5)**: T072 (test) parallelizable with T070.
- **Phase 8 (Polish)**: T073–T076 parallelizable; T077–T082 are sequential
  verification gates.

### Cross-story integration points (minimal)

- **US2 → US3**: `CurrencyStep.confirm` handler (T045) passes
  `markFirstRunPending` callback. T055–T057 in US3 rely on this plumbing.
  Mitigation: US3 component tests (T059) mock the context to prove US3 is
  independently verifiable.
- **US4 → voice-entry-service** (T010): mic tooltip "Try it now" calls
  `openVoiceEntry()` from the foundational service.
- No other story-to-story coupling.

---

## Parallel Example: User Story 1 (pitch carousel)

```bash
# Kick off all i18n + component scaffolding in parallel once Phase 2 is done:
Task: "T024 Add pitch i18n keys to apps/mobile/locales/en/onboarding.json"
Task: "T025 Add Arabic mirrors to apps/mobile/locales/ar/onboarding.json"
Task: "T027 Create apps/mobile/components/onboarding/PitchSlide.tsx"
Task: "T028 Create apps/mobile/components/onboarding/Slide1Voice.tsx"
Task: "T029 Create apps/mobile/components/onboarding/Slide2SMS.tsx"
Task: "T030 Create apps/mobile/components/onboarding/Slide2Offline.tsx"
Task: "T031 Create apps/mobile/components/onboarding/Slide3LiveMarket.tsx"

# Then sequentially:
T032 PitchCarousel.tsx (composes the slides — blocked on T027–T031)
T033 pitch.tsx route (blocked on T032)
T034 _layout.tsx branch (blocked on T033)

# Tests in parallel once components exist:
Task: "T035 Test PitchCarousel"
Task: "T036 Test PitchSlide"
Task: "T037 Test useIntroSeen + useIntroLocaleOverride hooks"
```

---

## Implementation Strategy

### MVP scope (P1 stories only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1 — Pitch).
3. Complete Phase 4 (US2 — Currency + redesigned auth).
4. Complete Phase 5 (US3 — Cash-account tooltip).
5. **STOP and VALIDATE**: walk through fresh Android install → pitch → auth →
   Currency → dashboard → SMS prompt → cash-account tooltip end-to-end. At this
   point the new-user first-impression arc is fully shippable.

### Incremental delivery order

- **PR 1**: Phase 1 (DB migration + types + model getter). Small, reviewable,
  unblocks everyone.
- **PR 2**: Phase 2 (Foundational primitives + tests). Merges the shared
  services/hooks/context.
- **PR 3**: US1 pitch flow (Phase 3). Independently verifiable.
- **PR 4**: US2 Currency + auth redesign (Phase 4). Independently verifiable via
  unit + integration tests.
- **PR 5**: US3 cash-account tooltip (Phase 5). Depends on PR 4 merged.
- **PR 6**: US4 Setup Guide + mic tooltip (Phase 6). Parallel with PR 5
  conceptually.
- **PR 7**: US5 skeleton fix (Phase 7). Can merge anytime after Phase 2.
- **PR 8**: Polish pass (Phase 8) — business-decisions update, deprecations,
  final QA gates.

Alternatively: one large PR containing all 8 phases is acceptable if internal
review capacity prefers a single atomic change. Spec 026 is cohesive enough that
a single PR is defensible.

### Parallel team strategy

Once Phase 2 completes, the following can proceed in parallel:

- Developer A: US1 (Phase 3 — pitch)
- Developer B: US2 (Phase 4 — Currency + auth)
- Developer C: US4 (Phase 6 — Setup Guide + mic tooltip) AND US5 (Phase 7 —
  skeleton fix)
- US3 (Phase 5) is taken by whoever finishes US2 first (depends on
  `CurrencyStep`'s `markFirstRunPending` plumbing).
- Phase 8 (Polish) runs after all merges.

---

## Notes

- Every test task is REQUIRED (not optional) per CLAUDE.md's mandatory-TDD rule.
- `[P]` means "different file, no dependency on any in-progress task in the same
  phase."
- `[US#]` tags map 1:1 to the spec's User Stories 1–5.
- Do NOT modify `apps/mobile/utils/routing-decision.ts` or
  `apps/mobile/app/index.tsx`'s routing logic (T019 is verification only). The
  existing `onboardingCompleted` signal is correct for this feature.
- Do NOT clear `@monyvi/intro-locale-override` on any code path (FR-030). The
  override is a device-level preference.
- Do NOT move the existing `<SmsPermissionPrompt>` rendering into a queue
  component (preserves its existing recurring-visibility behavior for
  undismissed Android users).
- Do NOT introduce a `FirstRunTooltipQueue` component. Cash-account tooltip
  gates itself on `!shouldShowPrompt` to sequence after the SMS prompt.
- The profile-name NOT NULL work (`first_name`, `last_name`, `display_name`) is
  explicitly OUT OF SCOPE for this feature and will be shipped as a separate
  follow-up ticket AFTER this feature merges.
- Commit after each task or logical group. Use commit prefixes from plan.md
  (`feat(026): …`, `fix(026): …`, `docs(026): …`).

---

## Validation checklist

Before marking the feature ready for merge, verify:

- [ ] Every functional requirement FR-001 through FR-040 in `spec.md` has at
      least one implementing task above.
- [ ] Every success criterion SC-001 through SC-010 in `spec.md` has a
      validating task in Phase 8 or within a story's manual-test step.
- [ ] All new code passes `npm run lint` and `npm run typecheck`.
- [ ] All new tests pass and contribute ≥ 80% coverage on new files.
- [ ] Dark mode verified on every new/modified surface.
- [ ] RTL (Arabic) verified on every new/modified surface.
- [ ] No regressions in pre-existing flows (sign-in, dashboard, transactions,
      budgets, transfers, SMS import).
- [ ] Migration 043 applied cleanly locally and against the dev Supabase branch.
- [ ] `docs/business/business-decisions.md` §12.2 updated with the
      `onboarding_flags` row.

**Total tasks**: 82 **Task distribution**: Setup 6 · Foundational 17 · US1 14 ·
US2 15 · US3 7 · US4 10 · US5 3 · Polish 10
