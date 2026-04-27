# Implementation Plan: Onboarding Restructure

**Branch**: `026-onboarding-restructure` | **Date**: 2026-04-23 | **Spec**:
[`./spec.md`](./spec.md) **Input**: Feature specification from
`specs/026-onboarding-restructure/spec.md`

## Summary

Restructure the onboarding experience from a 4-step post-auth wizard (language →
slides → currency → cash-account confirmation) into:

- **Pre-auth** (device-scoped): 3 pitch slides (Voice → SMS/Offline → Live
  Market) with auto-detected language, globe-icon language switcher, Skip
  affordance, and platform-divergent Slide 2 (SMS on Android, Offline on iOS).
  Persistence via AsyncStorage (`@rizqi/intro-seen`,
  `@rizqi/intro-locale-override`).
- **Auth screen**: redesigned to absorb the old "slide 4 closer" — welcome +
  tagline + value-prop pills + existing Google OAuth + email/password form +
  trust microbar footer with top-border separator.
- **Post-auth** (single required step): Currency picker. On confirmation, a
  single WatermelonDB `database.write()` writes `preferred_currency`, creates
  the cash account, overwrites `preferred_language` with the runtime app
  language, and flips `onboarding_completed = true` — with the known
  WatermelonDB no-nested-writer constraint resolved by extracting an inline
  `createCashAccountWithinWriter` helper.
- **First-run dashboard tooltips**: SMS permission popup stays where it is today
  (rendered by `(tabs)/index.tsx` via existing `useSmsSync()` — unchanged,
  recurring-render behavior preserved). The new per-profile cash-account tooltip
  renders independently, gated on
  `isFirstRunPending && !shouldShowPrompt && !onboarding_flags.cash_account_tooltip_dismissed`
  so it visually sequences after the SMS prompt without a shared queue
  abstraction.
- **OnboardingGuideCard**: restructured from 5 steps to 4 (Bank → Voice →
  Auto-track bank SMS → Budget), with new voice-only completion rule and
  first-tap-only mic-button tooltip that opens voice.
- **Dashboard skeleton fix**: remove `OnboardingGuideCardSkeleton` slot from
  `DashboardSkeleton` to eliminate cold-launch layout shift.
- **Dark mode**: implemented via NativeWind `dark:` variants on every
  new/modified surface; no separate dark mockups.
- **Schema**: add `profiles.onboarding_flags` JSONB column (migration `043`);
  `profiles.slides_viewed` was already dropped by migration 041 (no-op for this
  feature).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode; workspace-wide) **Primary
Dependencies**: React Native + Expo (managed workflow), Expo Router (file-based
routing), NativeWind v4 (Tailwind for RN), WatermelonDB (SQLite), Supabase JS
(auth + sync), i18next + react-i18next, expo-localization,
react-native-reanimated, react-native-reanimated-carousel (existing pitch
carousel) **Storage**: WatermelonDB (local, source of truth for user-facing
data) + Supabase PostgreSQL (remote sync) + AsyncStorage (device-scoped flags
only) **Testing**: Jest + React Native Testing Library (per project convention;
existing `__tests__` folders under `apps/mobile/`) **Target Platform**: iOS 15+
(Expo baseline), Android 7+ (Android API 24+) **Project Type**: Mobile monorepo
— primary changes in `apps/mobile/`; one migration in `supabase/migrations/`;
auto-regenerated WatermelonDB schema in `packages/db/src/` **Performance
Goals**: 60fps on pitch carousel and tooltip render; Setup Guide card step
completion reflection ≤ 1s after the triggering data write (per SC-006); no
perceivable layout shift on cold launch for dismissed-card users (per SC-007)
**Constraints**: Offline-first (all writes go through WatermelonDB first, sync
is non-blocking); dark mode correctness required on every new/modified surface
(FR-036/037/038); RTL correctness in Arabic; no third-party analytics SDK
introduced (telemetry scoped out per clarification Q2) **Scale/Scope**: ~12 new
or substantially modified files in `apps/mobile`; 1 new SQL migration; 1 new
column in one table; 0 new routes (existing routes are updated in place); ~30
new i18n keys across two locales

## Constitution Check

_GATE: Re-checked post-design (Phase 1). All principles pass._

| Principle                                 | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Offline-First Data Architecture**    | ✅ PASS | All user-facing writes (preferred_currency, preferred_language, onboarding_completed, onboarding_flags) go through WatermelonDB first; Supabase sync is non-blocking. Device-scoped `intro:seen` and `intro:locale_override` live in AsyncStorage (no user context at pre-auth time — correct scope). New `profiles.onboarding_flags` column includes `created_at`, `updated_at`, `deleted`, `user_id` via profile row membership (inherited — no new table). |
| **II. Documented Business Logic**         | ✅ PASS | `docs/business/business-decisions.md` §12.2, §12.3, §12.4 already updated (2026-04-22 decision entry). This plan adds `onboarding_flags` column description; will update business-decisions.md in the same PR.                                                                                                                                                                                                                                                |
| **III. Type Safety (NON-NEGOTIABLE)**     | ✅ PASS | All new code uses strict TS. New `OnboardingFlags` type shape defined in `packages/db/src/types.ts`. Zod runtime validation for any auth payload parsing in the merged FormView (inherited from existing). No `any`, no non-null assertions, explicit return types.                                                                                                                                                                                           |
| **IV. Service-Layer Separation**          | ✅ PASS | Atomic Currency confirmation lives in `apps/mobile/services/profile-service.ts` (extended). Tooltip dismissal via a new `apps/mobile/services/onboarding-flags-service.ts`. Components only observe and render; hooks handle subscriptions; services own writes. No `Alert.alert()` in services.                                                                                                                                                              |
| **V. Premium UI with Consistent Theming** | ✅ PASS | NativeWind only; no hardcoded hex in JSX (tokens from `apps/mobile/tailwind.config.js`); dark mode via `dark:` variants (FR-036); no `isDark` ternaries in className; no `shadow-*`/`opacity-*`/`bg-color/opacity` on `TouchableOpacity`/`Pressable` (NativeWind v4 bug avoided — inline `style` for shadow on buttons). Schema-driven UI for Setup Guide card (completion state derived from data, not separate flags).                                      |
| **VI. Monorepo Package Boundaries**       | ✅ PASS | Changes concentrated in `apps/mobile/`. One schema/model edit in `packages/db/`. No new cross-package imports. Dependency direction (`apps/ → packages/logic → packages/db`) preserved.                                                                                                                                                                                                                                                                       |
| **VII. Local-First Migrations**           | ✅ PASS | New migration `supabase/migrations/043_add_onboarding_flags_to_profiles.sql` (JSONB column). No Supabase MCP `apply_migration`/`execute_sql` used. Run `npm run db:migrate` to regenerate WatermelonDB schema, types, and local watermelon migration. Commit migration + regenerated schema together.                                                                                                                                                         |

**No violations. No complexity justifications needed.**

## Project Structure

### Documentation (this feature)

```text
specs/026-onboarding-restructure/
├── plan.md              # This file
├── research.md          # Phase 0 — architectural research findings
├── data-model.md        # Phase 1 — schema + AsyncStorage + entity shapes
├── quickstart.md        # Phase 1 — implementation bootstrap + verification
├── contracts/           # Phase 1 — service signatures, i18n keys, JSON shapes
│   ├── services.md
│   ├── i18n-keys.md
│   └── onboarding-flags-schema.md
├── spec.md              # Feature spec (already written)
├── checklists/
│   └── requirements.md  # Spec quality checklist (already written)
├── design/
│   └── slides-concepts.md  # Design artifact
└── mockups/             # PNG mockups + README (already saved)
```

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── _layout.tsx                         # MODIFIED — wraps tree in FirstRunTooltipProvider (splash coordinator unchanged)
│   ├── index.tsx                           # UNCHANGED — existing routing gate reads profile.onboardingCompleted (correct signal per FR-031)
│   ├── onboarding.tsx                      # REWRITTEN — reduced to Currency step only (was 4-phase wizard)
│   ├── auth.tsx                            # MODIFIED — uses restructured FormView; adds LanguageSwitcherPill in top corner
│   └── (tabs)/
│       └── index.tsx                       # MODIFIED — renders new CashAccountTooltip alongside existing SmsPermissionPrompt; DashboardSkeleton fix. SMS prompt wiring UNCHANGED.
├── components/
│   ├── auth/
│   │   └── FormView.tsx                    # REWRITTEN — welcome + tagline + pills + Google OAuth + form + trust microbar footer
│   ├── onboarding/
│   │   ├── PitchCarousel.tsx               # NEW — 3-slide pitch with platform-divergent Slide 2
│   │   ├── PitchSlide.tsx                  # NEW — single-slide presentational (shared by all 3 slides)
│   │   ├── Slide1Voice.tsx                 # NEW — Voice content
│   │   ├── Slide2SMS.tsx                   # NEW — SMS content (Android)
│   │   ├── Slide2Offline.tsx               # NEW — Offline content (iOS)
│   │   ├── Slide3LiveMarket.tsx            # NEW — Live rates + gold/silver content
│   │   ├── LanguageSwitcherPill.tsx        # NEW — globe icon + language code corner affordance
│   │   ├── CurrencyStep.tsx                # NEW or REFACTORED — renames + simplifies existing CurrencyPickerStep
│   │   ├── LanguagePickerStep.tsx          # REMOVED — no longer a separate step
│   │   └── WalletCreationStep.tsx          # REMOVED — replaced by first-run tooltip
│   ├── dashboard/
│   │   ├── OnboardingGuideCard.tsx         # MODIFIED — 4 steps (drop cash_account), voice completion rule, new voice-step tooltip trigger
│   │   ├── CashAccountTooltip.tsx          # NEW — anchored first-run tooltip for auto-created cash account. Self-gated on isFirstRunPending && !shouldShowPrompt && !onboarding_flags.cash_account_tooltip_dismissed. SMS prompt stays outside this component.
│   │   ├── MicButtonTooltip.tsx            # NEW — anchored tooltip for voice discovery, triggered by card action button
│   │   └── skeletons/
│   │       └── DashboardSkeleton.tsx       # MODIFIED — remove OnboardingGuideCardSkeleton slot
│   └── ui/
│       └── AnchoredTooltip.tsx             # NEW (or reuse existing if present) — generic tooltip primitive with arrow, dim backdrop, anchor layout
├── hooks/
│   ├── useOnboardingGuide.ts               # MODIFIED — drop cash_account step; voice completion checks source='VOICE'; "sms" step relabeled "Auto-track bank SMS"
│   ├── useIntroSeen.ts                     # NEW — observe + set `@rizqi/intro-seen`
│   ├── useIntroLocaleOverride.ts           # NEW — observe + set `@rizqi/intro-locale-override`
│   ├── useOnboardingFlags.ts               # NEW — observe profile.onboardingFlags JSONB
│   └── useFirstRunTooltip.ts               # NEW — consumer hook for FirstRunTooltipContext (isFirstRunPending + markFirstRunPending/Consumed)
├── services/
│   ├── profile-service.ts                  # MODIFIED — atomic confirmCurrencyAndOnboard(); setOnboardingFlag(key)
│   ├── intro-flag-service.ts               # NEW — AsyncStorage IO for `@rizqi/intro-seen` + `@rizqi/intro-locale-override`
│   ├── onboarding-cursor-service.ts        # DEPRECATED — stop reading; schedule deletion once all callers migrated
│   └── account-service.ts                  # Potentially MODIFIED — see research.md §3.4 (nested-write mitigation)
├── utils/
│   └── routing-decision.ts                 # UNCHANGED — existing { syncState, onboardingCompleted } signature is correct for this feature (see research §10)
├── constants/
│   └── storage-keys.ts                     # MODIFIED — add INTRO_SEEN_KEY + INTRO_LOCALE_OVERRIDE_KEY
├── locales/
│   ├── en/
│   │   ├── onboarding.json                 # MODIFIED — new keys: pitch slides copy, Currency step copy, tooltip copy
│   │   ├── common.json                     # MODIFIED — any shared new keys
│   │   └── auth.json                       # MODIFIED — welcome title, tagline, value-prop pill labels, trust microbar
│   └── ar/                                 # Mirrors en/
└── __tests__/
    ├── utils/routing-decision.test.ts      # UNCHANGED — existing cases remain valid
    ├── services/intro-flag-service.test.ts # NEW
    ├── services/profile-service.test.ts    # MODIFIED — confirmCurrencyAndOnboard atomicity
    ├── hooks/useOnboardingGuide.test.ts    # NEW or MODIFIED
    ├── hooks/useOnboardingFlags.test.ts    # NEW
    └── components/
        ├── onboarding/PitchCarousel.test.tsx     # NEW
        ├── auth/FormView.test.tsx                # MODIFIED
        ├── dashboard/CashAccountTooltip.test.tsx # NEW — visibility gating with SMS-prompt guard
        └── dashboard/MicButtonTooltip.test.tsx   # NEW

packages/db/
├── src/
│   ├── schema.ts                           # REGENERATED — profiles gets onboarding_flags: string (JSONB on Supabase, stringified JSON in WMDB)
│   ├── migrations.ts                       # MODIFIED — manual addColumn entry for onboarding_flags
│   ├── models/
│   │   ├── Profile.ts                      # MODIFIED — add onboardingFlags getter (JSON.parse pattern like notificationSettings)
│   │   └── base/base-profile.ts            # REGENERATED — @field('onboarding_flags') onboardingFlagsRaw?
│   ├── types.ts                            # MODIFIED — add OnboardingFlags type
│   └── supabase-types.ts                   # REGENERATED

supabase/
└── migrations/
    └── 043_add_onboarding_flags_to_profiles.sql  # NEW — ADD COLUMN profiles.onboarding_flags JSONB NOT NULL DEFAULT '{}'::JSONB

docs/
└── business/
    └── business-decisions.md               # MODIFIED — §12.2 profiles table gets onboarding_flags row added
```

**Structure Decision**: Mobile monorepo with changes concentrated in
`apps/mobile/` (UI, routing, services, hooks), a single additive migration in
`supabase/migrations/`, and auto-regenerated schema + types in `packages/db/`.
No changes in `packages/logic/` or `apps/api/` — this is a purely front-end +
mobile-DB feature.

## Implementation Strategy

### Key architectural decisions (summary — see `research.md` for full rationale)

1. **Atomic Currency confirmation write semantics** (FR-014 reality):
   - WatermelonDB does NOT allow nested writers (the existing
     `setPreferredCurrencyAndCreateCashAccount` is two sequential
     `database.write()` calls because `ensureCashAccount` owns its own writer —
     nesting causes deadlock).
   - **Resolution**: refactor to a single outer `database.write()` that wraps
     all four mutations (cash account create, preferred_currency,
     preferred_language overwrite, onboarding_completed = true). Extract a
     non-writer
     `createCashAccountWithinWriter(userId, currency, accountsCollection)`
     helper in `account-service.ts`, called from inside the outer
     `database.write()`. This gives genuine atomicity (all four writes commit
     together or none commit) matching FR-014's "single atomic write" language.
   - Caller-migration check: `ensureCashAccount`'s other callers
     (`batch-create-transactions.ts`, `sms-review-save-service.ts`,
     `transfer-service.ts`) continue to use the existing writer-owning
     `ensureCashAccount` public API — they don't change. The refactor only
     exposes the inline helper for use inside an outer writer.
   - Fallback if the refactor is too invasive: keep sequential writes but add
     explicit rollback (flip `onboarding_completed` back to `false`) when
     cash-account creation fails. This keeps the routing invariant
     "onboarding_completed = true ⟹ cash account exists."

2. **Routing gate (`routing-decision.ts`): NO CHANGES**.
   - The existing input `{ syncState, onboardingCompleted }` is correct for this
     feature.
   - Rationale: `preferred_currency` is `currency_type NOT NULL DEFAULT 'EGP'`,
     so it always has a value and can't distinguish "never onboarded" from
     "chose EGP." `onboarding_completed` starts `false` and is flipped `true`
     only inside the atomic Currency-confirmation write (FR-031). The existing
     router behavior is already what this feature needs.
   - The atomic write in `confirmCurrencyAndOnboard` (decision #1 above) is what
     enables this unchanged router to work — it guarantees
     `onboarding_completed = true` implies a valid post-onboarding profile
     state.

3. **AsyncStorage flag discipline**:
   - Keys follow the existing `@rizqi/` device-scoped prefix convention:
     `@rizqi/intro-seen` (boolean), `@rizqi/intro-locale-override` (string: "en"
     | "ar" | null).
   - Both are device-scoped (not cleared on logout or sign-up — intentional,
     spec FR-029/FR-030).
   - `intro-locale-override` is written by the shared `LanguageSwitcherPill`
     wherever it renders (pitch, auth, Currency step) and is also read at app
     startup by `detectInitialLanguage()` in `i18n/index.ts` — this is the one
     i18n-init change required by this feature (prevents a post-RTL-reload
     language flash, FR-002).
   - All IO goes through the new `intro-flag-service.ts` (no direct AsyncStorage
     callers elsewhere).

4. **Onboarding flags JSONB column** (FR-033a):
   - Supabase column: `onboarding_flags JSONB NOT NULL DEFAULT '{}'::JSONB`.
   - WatermelonDB column (stringified):
     `{ name: "onboarding_flags", type: "string", isOptional: false }` with
     default '{}' in migration.
   - Model access: `Profile.onboardingFlags` getter that parses the string and
     returns typed `OnboardingFlags`. Follows the existing
     `notificationSettings` precedent.
   - Known keys at launch: `cash_account_tooltip_dismissed: boolean`,
     `voice_tooltip_seen: boolean`. Future flags added without schema changes.

5. **First-run tooltip rendering** (FR-017 / FR-020) — NO shared queue:
   - SMS permission prompt continues to render exactly where it does today
     (`(tabs)/index.tsx` via `useSmsSync()` + `<SmsPermissionPrompt>`). Its
     recurring-render behavior for undismissed-and-unsynced Android users is
     preserved — moving it would break existing behavior.
   - Cash-account tooltip is a NEW independent component (`CashAccountTooltip`)
     with its own visibility logic:
     ```text
     visible = isFirstRunPending
             && !shouldShowPrompt                // wait for SMS prompt to clear (Android)
             && !onboarding_flags.cash_account_tooltip_dismissed
     ```
     This gating ensures the two prompts visually sequence without a shared
     orchestrator.
   - `isFirstRunPending` is an in-memory React Context
     (`FirstRunTooltipContext`) value set by the Currency-step handler after the
     atomic write succeeds and cleared when the cash-account tooltip is
     dismissed. Force-quit trade-off is acceptable (user is already onboarded;
     tooltip is educational).

6. **Mic-button tooltip trigger** (FR-024 / FR-024a / FR-024b):
   - Lives in `MicButtonTooltip.tsx`, rendered conditionally by
     `OnboardingGuideCard` when the voice step's action button is tapped.
   - Trigger guard: `profile.onboardingFlags?.voice_tooltip_seen !== true`.
   - On EITHER dismissal path ("Try it now" OR X close), the flag is set to
     `true`. "Try it now" additionally routes to the existing voice-entry flow
     (tap the tab-bar mic button programmatically or call the same entry
     function directly).
   - Direct tap on the tab-bar mic button does NOT route through this tooltip
     (existing behavior preserved; no intercept added).

7. **OnboardingGuideCard step list refactor**:
   - Remove `cash_account` step entirely (always completes after Currency
     confirmation).
   - Rename `first_transaction` step → "Try voice transaction" AND change
     completion query from `count > 0` to `source = 'VOICE'`.
   - Rename SMS step label from "Enable SMS auto-import" (existing) to
     "Auto-track bank SMS" (finalized in Q-label clarification).
   - Progress pill: `completedCount / totalSteps` where totalSteps is 4
     (Android) or 3 (iOS; SMS step hidden).

8. **Dashboard skeleton fix** (FR-028):
   - Delete the `<OnboardingGuideCardSkeleton />` line from
     `DashboardSkeleton.tsx` so the skeleton render has no reserved slot for the
     Setup Guide card. All other section skeletons preserved.

9. **Hardware back button handling** (FR-039 / FR-040 / FR-013a):
   - Android only. On pitch slides, use a `BackHandler` listener that advances
     to the previous slide unless on slide 1 (allow default exit behavior).
   - On tooltips: intercept back with `BackHandler` to trigger the equivalent
     dismiss path (X close semantics for mic tooltip; "Got it" for cash
     tooltip). Ensure the listener is scoped to when the tooltip is visible
     only.
   - **On the Currency step (FR-013a): install a `BackHandler` listener that
     returns `true` unconditionally to block back navigation.** The step is
     required; users exit only via Sign out or successful confirmation.
   - On the auth screen: default expo-router back is fine (navigates to pitch if
     previous route; otherwise exits — matches FR-039).

10. **i18n contract**:
    - All new user-facing strings are keys in `onboarding.json` and `auth.json`,
      mirrored in `en/` and `ar/`.
    - `translation-schemas.ts` MUST be updated to include the new keys so
      `validateTranslationResources()` catches drift between locales.
    - RTL: pitch slides layout uses NativeWind `start-*`/`end-*` logical
      properties; icons that have directional meaning (arrows) flip in RTL per
      existing app convention.

11. **Dark mode coverage** (FR-036 / FR-037 / FR-038):
    - Every new component has `dark:` variant pairs applied per the token table
      in `design/slides-concepts.md`.
    - Visual QA in dark mode is part of the Definition of Done before shipping
      (not a separate pass); dev workflow runs in system dark mode for 50%+ of
      manual testing sessions.

### Phase 0 research topics (resolved in `research.md`)

1. Existing WatermelonDB atomic-write pattern (nested-writer constraint, how to
   refactor `ensureCashAccount`)
2. JSONB-in-WatermelonDB pattern via the existing `notification_settings`
   precedent
3. Hardware back button patterns in React Native / Expo Router
4. Tooltip / anchored-overlay primitive — does one exist in the codebase, or do
   we build new?
5. i18n: mid-app language switching behavior (reload on RTL flip, how it affects
   pre-auth slides)
6. Existing SMS permission prompt: how its "seen" state is currently tracked (so
   we don't duplicate it in `onboarding_flags`)
7. First-run tooltip trigger signal: in-memory session flag vs route param vs
   provider?
8. Voice-entry flow entry points — programmatic trigger from "Try it now"?
9. Splash / AppReadyGate coordinator in `_layout.tsx` — does it need updates for
   the new routing-gate field?

### Phase 1 outputs (resolved in `data-model.md`, `contracts/*`, `quickstart.md`)

- Data model: profiles.onboarding_flags schema, AsyncStorage key shapes,
  `OnboardingFlags` TS type. Routing-gate input shape is UNCHANGED — see
  decision #2 in the Implementation Strategy above.
- Contracts: service function signatures (`confirmCurrencyAndOnboard`,
  `setOnboardingFlag`, `setSetupGuideCompleted`, `markIntroSeen`,
  `readIntroLocaleOverride`, `setIntroLocaleOverride`), i18n key namespaces,
  JSON shapes for `onboarding_flags`.
- Quickstart: step-by-step bootstrap for an implementer — migration first,
  regenerate schema, leave `routing-decision` UNCHANGED (per research §10),
  rewire `onboarding.tsx` to single Currency step, rewrite `FormView`, update
  `OnboardingGuideCard` and `useOnboardingGuide`, add the independent
  `CashAccountTooltip` + `MicButtonTooltip` components (NOT a shared queue — SMS
  prompt stays on its existing render path), test in light + dark + Android +
  iOS.

## Testing Strategy

Following the project's TDD-encouraged convention. Per spec, 80%+ coverage is
mandatory (per CLAUDE.md).

### Unit tests (Jest + RTL)

- `utils/routing-decision.test.ts` — **unchanged**. Existing cases (combinations
  of `syncState ∈ {in-progress, success, failed, timeout}` ×
  `onboardingCompleted ∈ {true, false}`) remain valid — this feature does not
  modify the routing-decision signature.
- `services/intro-flag-service.test.ts` — 6 cases: read before write returns
  null; write + read round-trips; write idempotency; logout does NOT clear the
  keys (per existing CLEARABLE_USER_KEYS exclusion).
- `services/profile-service.test.ts` — update existing
  `setPreferredCurrencyAndCreateCashAccount` test to cover the new single-write
  atomicity; add cases for `setOnboardingFlag` (JSON merge semantics,
  idempotent).
- `hooks/useOnboardingGuide.test.ts` — 4 steps visible on Android, 3 on iOS;
  voice step uses `source='VOICE'` query; each step transitions from incomplete
  → complete on data change; auto-dismisses when all complete.
- `hooks/useOnboardingFlags.test.ts` — observe profile, parse JSON, return typed
  shape; default empty object; reactive to profile changes.
- `hooks/useIntroSeen.test.ts`, `hooks/useIntroLocaleOverride.test.ts` —
  AsyncStorage observation + update.

### Component tests (Jest + RTL)

- `components/onboarding/PitchCarousel.test.tsx` — renders 3 slides; swipe
  navigation; slide 2 content differs by `Platform.OS`; Skip tap and last-slide
  CTA both fire the completion callback; language switch re-renders current
  slide.
- `components/auth/FormView.test.tsx` — updated layout (welcome + tagline +
  pills + OAuth + form + microbar); absent shield-icon hero; Google OAuth button
  unchanged.
- `components/dashboard/OnboardingGuideCard.test.tsx` — 4-step rendering on
  Android, 3-step on iOS; voice step with NEW badge + GO button; first tap on GO
  shows mic tooltip; completed step renders without action button.
- `components/dashboard/CashAccountTooltip.test.tsx` — 4 cases: (1) hidden when
  `!isFirstRunPending`; (2) hidden when `shouldShowPrompt === true` (SMS prompt
  visible); (3) hidden when `cash_account_tooltip_dismissed === true`; (4)
  visible when all three conditions satisfied, and dismiss writes the flag +
  calls `markFirstRunConsumed()`.
- `components/dashboard/MicButtonTooltip.test.tsx` — visibility guarded by
  `voice_tooltip_seen`; "Try it now" fires dismiss + voice open; X fires dismiss
  only; both set the flag.

### Integration / end-to-end sanity (manual)

Documented in `quickstart.md`:

- Fresh install (Android) → pitch slides in device locale → switch to Arabic on
  slide 1 → observe RTL reload → pitch restarts from slide 1 in Arabic with NO
  flash of English → skip on slide 2 → auth (rendered in Arabic, language pill
  visible) → sign-up → Currency step (rendered in Arabic, language pill visible,
  hardware back blocked) → confirm EGP → dashboard with SMS popup → dismiss →
  cash-account tooltip appears → dismiss → Setup Guide card visible in Arabic.
- Fresh install (iOS) → same flow minus the SMS popup; Slide 2 shows Offline
  content.
- Returning user (same device, different account) → pitch skipped on cold launch
  → auth → sign-in → dashboard.
- Returning user (already onboarded) → pitch skipped → auth → dashboard direct
  (no Currency step, no first-run tooltips).
- Dark mode on each screen (system dark + manual toggle).
- Arabic: RTL correctness on pitch slides, auth, Currency step, tooltips, card.
- Sign-out from Currency step: clears local session, returns to pitch (if device
  hasn't seen it) or auth.
- On Android, press hardware back while on the Currency step → no-op (step
  remains; no exit).
- On Android, press hardware back while only the cash-account tooltip is visible
  → tooltip dismisses + `cash_account_tooltip_dismissed = true` persisted.
- Force-quit during slide 2: slides re-appear from start on relaunch (FR-005).

## Operational Notes

- **No telemetry**: per clarification Q2, no new structured logs or analytics
  events for the pitch funnel beyond what's already emitted by
  `onboarding.routing.decision`. SC-003 and SC-004 verified via internal
  walkthrough per the softened criteria.
- **No new routes**: all changes happen in existing routes (`/`, `/onboarding`,
  `/auth`, `/(tabs)/index`). `expo-router` config does not change.
- **No new third-party dependencies**: the feature is fully buildable with the
  existing dependency set.
- **Business-decisions update**: §12.2 (profiles table) gets a row for
  `onboarding_flags`; §12.3 already reflects the new profile creation flow.
- **Deprecation of onboarding-cursor-service**: stop reading from it in
  `onboarding.tsx` (which no longer has multi-step phases to resume). The
  service's callers (if any remain) should be removed or migrated. The
  AsyncStorage key `onboarding:<userId>:step` can be left in place on existing
  devices (harmless); no forced cleanup.

## Complexity Tracking

_No constitution violations — this section is empty by design._

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| _(none)_  | _(none)_   | _(none)_                             |
