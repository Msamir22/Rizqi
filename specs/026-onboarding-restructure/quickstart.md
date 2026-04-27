# Quickstart — Onboarding Restructure

**Feature**: 026-onboarding-restructure **Audience**: The implementer picking
this up after `/speckit.plan` finishes.

This is the order-of-operations guide to land the feature. Each step cites the
spec FR(s) and contract section it implements.

---

## 0. Prerequisites

- On branch `026-onboarding-restructure`.
- Node + npm installed per repo README.
- Supabase CLI installed and authenticated if you plan to push the migration to
  a remote environment (local dev can work without this).
- Environment set up per the project's root `README.md` / `CLAUDE.md`.
- Read the spec: [`spec.md`](./spec.md).
- Read the plan: [`plan.md`](./plan.md).
- Skim the research and data-model: [`research.md`](./research.md),
  [`data-model.md`](./data-model.md).

---

## Phase A — Database schema (15 min)

**Goal**: Land the `onboarding_flags` JSONB column end-to-end (Supabase +
WatermelonDB + types) so downstream code can import from `@rizqi/db` cleanly.

### A.1 Write the migration

Create `supabase/migrations/043_add_onboarding_flags_to_profiles.sql` with the
SQL from
[`contracts/onboarding-flags-schema.md §6.1`](./contracts/onboarding-flags-schema.md).

### A.2 Run the migrate script

```bash
npm run db:migrate
```

This regenerates:

- `packages/db/src/schema.ts` (version bump to 17)
- `packages/db/src/models/base/base-profile.ts` (adds `onboardingFlagsRaw`
  field)
- `packages/db/src/supabase-types.ts`

### A.3 Add the WatermelonDB migration step manually

Edit `packages/db/src/migrations.ts` to add a step for `toVersion: 17` that
calls `addColumns` with the new `onboarding_flags` string column. See
[`data-model.md §1.4`](./data-model.md) for the exact shape.

### A.4 Add the Profile model getter + type

- In `packages/db/src/types.ts`: add the `OnboardingFlags` interface from
  [`contracts/onboarding-flags-schema.md §1`](./contracts/onboarding-flags-schema.md).
- In `packages/db/src/models/Profile.ts`: add the `onboardingFlags` getter that
  parses `onboardingFlagsRaw`. Follow the `notificationSettings` pattern already
  in the file.

### A.5 Verify

```bash
npm run -w @rizqi/db build   # or equivalent
```

Any TypeScript errors from importers now? Expected: `Profile.onboardingFlags`
should autocomplete in VS Code and return `OnboardingFlags`.

### A.6 Commit

Single commit: migration SQL + regenerated schema + manual model/type additions.
Clear commit message: `feat(026): add profiles.onboarding_flags JSONB column`.

**Implements**: FR-033a; data-model.md §1, §2, §10.

---

## Phase B — Services + AsyncStorage (30 min)

**Goal**: Build the service layer so the UI code in later phases just calls
functions.

### B.1 Storage keys

Edit `apps/mobile/constants/storage-keys.ts` to add `INTRO_SEEN_KEY` and
`INTRO_LOCALE_OVERRIDE_KEY` constants per
[`data-model.md §3.3`](./data-model.md). Do NOT add them to
`CLEARABLE_USER_KEYS`.

### B.2 Intro flag service

Create `apps/mobile/services/intro-flag-service.ts` implementing the 4 functions
from [`contracts/services.md §2`](./contracts/services.md): `readIntroSeen`,
`markIntroSeen`, `readIntroLocaleOverride`, `setIntroLocaleOverride`. Do NOT
export a `clearIntroLocaleOverride` helper — the override is a device-level
preference that must persist (FR-030).

Unit test: `apps/mobile/__tests__/services/intro-flag-service.test.ts` covering
round-trips, missing-key fallbacks, and persistence across mocked AsyncStorage
sessions.

### B.3 Voice entry service

Read existing tab-bar mic button logic (`apps/mobile/app/(tabs)/_layout.tsx` or
similar) to find the handler that opens voice entry today.

- If it's a local closure: extract into
  `apps/mobile/services/voice-entry-service.ts` with `openVoiceEntry()`. Update
  the mic button to call it.
- If it's already in a provider/context: expose a clean `openVoiceEntry` method
  and import it as needed.

**Implements**: research.md §9.

### B.4 Profile service — `setOnboardingFlag`

Add the new function to `apps/mobile/services/profile-service.ts` per
[`contracts/services.md §1.2`](./contracts/services.md). Unit-test the
read-merge-write behavior.

### B.5 Profile service — `confirmCurrencyAndOnboard`

Add the new function per
[`contracts/services.md §1.1`](./contracts/services.md). This is the atomic
Currency-confirmation write.

**Critical sub-task**: refactor `account-service.ts` so that the cash-account
creation logic can be used from inside an outer `database.write()`. Either:

- Extract a `createCashAccountInline(collection, userId, currency, name?)`
  helper that does NOT open a writer, and have `ensureCashAccount` call it from
  within its own writer (so stand-alone callers still work).
- OR rewrite `confirmCurrencyAndOnboard` to inline the account-creation query
  directly (copy the pattern from `ensureCashAccount`).

The first approach is cleaner (preserves DRY). See
[`research.md §1`](./research.md).

Unit test: `__tests__/services/profile-service.test.ts` covering:

- Happy path: all four mutations succeed; cash account returned;
  `onboarding_completed` flipped to `true`; `preferred_language` overwritten
  with `getCurrentLanguage()` result.
- Existing cash account path: no duplicate created, existing returned.
- Currency already set: idempotent (overwrite with same or new value).
- Language write: `preferred_language` is overwritten unconditionally with
  `getCurrentLanguage()` (NOT NULL DEFAULT 'en' column — no nullness check
  needed).
- Override persistence: assert AsyncStorage `@rizqi/intro-locale-override` is
  NOT modified by this function (FR-030).
- Failure path: mock the writer to throw; assert NO partial data persists AND
  `onboarding_completed` remains `false` (rollback atomicity).

**Implements**: FR-010, FR-011, FR-014; research.md §1; contracts/services.md
§1.

### B.6 Commit

`feat(026): add intro flag service, onboarding flag service, atomic currency confirmation`

---

## Phase C — Routing gate (NO-OP for this feature)

**Goal**: Confirm the existing routing gate (shipped with #226) is correct — NO
code changes to `routing-decision.ts` or `apps/mobile/app/index.tsx`.

### C.1 Why there's nothing to change

- `preferred_currency` is `currency_type NOT NULL DEFAULT 'EGP'` — always has a
  value, cannot be used as a routing signal (per FR-031).
- `onboarding_completed` is the correct signal: starts `false`, flipped `true`
  only inside `confirmCurrencyAndOnboard` (Phase B.5).
- The existing router already reads `profile.onboardingCompleted` and returns
  `"dashboard"` when it's `true`, `"onboarding"` when `false`.

### C.2 Verification step

Read both files to confirm they match the contract in
[`contracts/services.md §8`](./contracts/services.md):

- `apps/mobile/utils/routing-decision.ts` — `RoutingInputs` has
  `onboardingCompleted: boolean`.
- `apps/mobile/app/index.tsx` — passes `profile?.onboardingCompleted ?? false`
  to `getRoutingDecision`.

If either has drifted from this shape, restore it to the #226 behavior.

### C.3 Existing tests stay

`apps/mobile/__tests__/utils/routing-decision.test.ts` — no changes. Existing
cases (8 combinations of `syncState` × `onboardingCompleted ∈ {true, false}`)
remain valid.

### C.4 No commit needed for this phase

If verification passes, Phase C requires zero commits. Proceed to Phase D.

**Implements**: FR-012, FR-031 (verified via inspection, no code change);
data-model.md §5.

---

## Phase D — Currency step (20 min)

**Goal**: The old onboarding's 4-phase wizard gets reduced to a single Currency
step.

### D.1 Create `components/onboarding/CurrencyStep.tsx`

Copy from the existing `CurrencyPickerStep` as a starting point. Modify:

- **Top-corner `LanguageSwitcherPill`** (same component built in Phase E). Gives
  users who arrived in the wrong language a way to correct it before confirming
  (FR-013).
- **Hardware back blocker** (Android): `useEffect` with
  `BackHandler.addEventListener("hardwareBackPress", () => true)` while the
  screen is mounted + focused. Return `true` unconditionally to consume the
  event (FR-013a).
- Sign-out action visible and functional (wire to the existing logout service).
- On confirm: call
  `confirmCurrencyAndOnboard(currency, { onTransactionCommitted: () => markFirstRunPending() })`.
- No AsyncStorage cursor writes (they're gone).
- On success, `router.replace("/(tabs)")`.
- On failure, show error toast, stay on screen.

### D.2 Rewrite `apps/mobile/app/onboarding.tsx`

The new file is MUCH smaller — it just renders `<CurrencyStep />`. The
multi-phase state machine is gone.

Remove imports of `LanguagePickerStep` and `WalletCreationStep` (they're about
to be deleted).

### D.3 Delete deprecated components

- `apps/mobile/components/onboarding/LanguagePickerStep.tsx`
- `apps/mobile/components/onboarding/WalletCreationStep.tsx`

### D.4 Commit

`feat(026): single-step Currency onboarding replaces 4-phase wizard`

**Implements**: FR-012 to FR-016, FR-034, FR-035.

---

## Phase E — Pre-auth pitch (45 min)

**Goal**: Build the new 3-slide pitch carousel with language switcher.

### E.1 Hooks

Create:

- `apps/mobile/hooks/useIntroSeen.ts` — per
  [`contracts/services.md §5`](./contracts/services.md).
- `apps/mobile/hooks/useIntroLocaleOverride.ts` — per §6 of contracts.

### E.2 Components

Create the following components in `apps/mobile/components/onboarding/`:

- `LanguageSwitcherPill.tsx` — globe + language code corner affordance. On tap,
  shows a sheet to pick; on select, calls `setIntroLocaleOverride(lang)`.
- `PitchSlide.tsx` — shared slide shell (top bar, eyebrow, headline, subhead,
  mock frame container, pagination dots, CTA).
- `Slide1Voice.tsx`, `Slide2SMS.tsx`, `Slide2Offline.tsx`,
  `Slide3LiveMarket.tsx` — content-specific slides consuming `PitchSlide`.
- `PitchCarousel.tsx` — renders the 3 slides, picks Slide2SMS vs Slide2Offline
  by `Platform.OS`.

Hardware back: use `BackHandler.addEventListener` per
[`research.md §4`](./research.md).

### E.3 Update `detectInitialLanguage()` to read the override FIRST

In `apps/mobile/i18n/index.ts`, edit `detectInitialLanguage()` to:

1. Read `INTRO_LOCALE_OVERRIDE_KEY` from AsyncStorage.
2. If it returns `"en"` or `"ar"`, use that.
3. Otherwise fall back to device locale.
4. Otherwise fall back to English.

`initI18n()` MUST `await detectInitialLanguage()` before calling
`i18next.init()`. This is the fix for FR-002's "no language-flash after an
RTL-triggered reload." Without this step, the reloaded app renders briefly in
device locale before `LanguageSwitcherPill`'s override applies — a visible
flash.

Reference: [`research.md §6 Implementation shape`](./research.md).

### E.4 Wire the pitch to the app shell

- On app launch (in `_layout.tsx` or a parent route): if
  `!intro-seen && !authenticated`, navigate to the pitch route.
- After Skip or last-slide CTA: `markIntroSeen()` then navigate to auth.

A lightweight way: expose the pitch as a route (e.g.,
`apps/mobile/app/pitch.tsx`) and branch in the top-level route logic.

### E.5 i18n

Add every key from
[`contracts/i18n-keys.md §Namespace: onboarding`](./contracts/i18n-keys.md) to
both `locales/en/onboarding.json` and `locales/ar/onboarding.json`. Register in
`translation-schemas.ts`.

### E.6 Tests

- `__tests__/components/onboarding/PitchCarousel.test.tsx` — renders 3 slides;
  Platform.OS='ios' shows Offline slide; language switch renders new copy; skip
  and last-slide CTA both fire completion.
- `__tests__/i18n/detectInitialLanguage.test.ts` — override → "en"/"ar" wins;
  override missing + device locale "ar-EG" → "ar"; override missing + device
  locale "fr-FR" → "en"; override missing + device locale missing → "en".

### E.7 Commit

`feat(026): pre-auth pitch carousel with language switcher + override-first startup`

**Implements**: FR-001 to FR-006, FR-029, FR-030, FR-039 (pitch back);
data-model.md §3, §4.

---

## Phase F — Auth screen redesign (30 min)

**Goal**: Replace the existing FormView with the new welcome + tagline + pills +
form layout.

### F.1 Rewrite `apps/mobile/components/auth/FormView.tsx`

Follow the mockup at
`specs/026-onboarding-restructure/mockups/04-auth-light.png` and layout spec in
[`design/slides-concepts.md`](./design/slides-concepts.md).

Remove:

- The large shield-icon hero circle.
- The 3-trust-badges row (`TRUST_BADGES`).

Add (top to bottom):

- **`LanguageSwitcherPill`** in the top-start corner (FR-007) — REUSE the exact
  same component built in Phase E. Tapping it calls
  `setIntroLocaleOverride(lang)` + `changeLanguage(lang)`, same behavior as on
  the pitch. Verify this on auth by switching to Arabic and confirming the
  screen re-renders (or reloads on an RTL flip) in Arabic.
- Welcome title + tagline.
- 2×2 value-prop pill grid.
- `<SocialLoginButtons>` (unchanged — preserve OAuth icon!).
- Divider + EmailPasswordForm (unchanged).
- Trust microbar footer (lock + shield icons) with 1px top border separator.

### F.2 i18n

Add keys from
[`contracts/i18n-keys.md §Namespace: auth`](./contracts/i18n-keys.md) to both
locales. Remove `welcome_subtitle` and `trust_backed_up`.

### F.3 Test

Update `__tests__/components/auth/FormView.test.tsx` to assert the new elements
and absence of the old hero.

### F.4 Commit

`feat(026): auth screen redesign with pitch-continuity`

**Implements**: FR-007 to FR-011.

---

## Phase G — Dashboard first-run tooltips (35 min)

**Goal**: Add the new cash-account tooltip alongside the existing SMS prompt on
the dashboard. The SMS prompt stays where it is today — NO shared queue
component is introduced.

### G.1 Create `FirstRunTooltipContext`

Per [`data-model.md §4.1`](./data-model.md). Provider near the app root (wrap in
`_layout.tsx`). Default `isFirstRunPending: false`.

### G.2 Create `AnchoredTooltip` primitive

In `apps/mobile/components/ui/AnchoredTooltip.tsx`. Use the Android
absolute-overlay pattern (see `.claude/rules/android-modal-overlay-pattern.md`
in this repo) to avoid the NativeWind v4 Modal layout-collapse bug.

Props per [`research.md §5`](./research.md).

### G.3 Create `CashAccountTooltip.tsx`

A self-contained component rendered directly from `(tabs)/index.tsx` alongside
the existing SMS prompt.

Visibility logic (computed internally via hooks — no props from parent):

```tsx
const { isFirstRunPending, markFirstRunConsumed } = useFirstRunTooltip();
const { shouldShowPrompt } = useSmsSync(); // read-only — don't mutate
const onboardingFlags = useOnboardingFlags();

const visible =
  isFirstRunPending &&
  !shouldShowPrompt && // SMS prompt takes priority
  !onboardingFlags.cash_account_tooltip_dismissed;
```

Dismiss handler: `setOnboardingFlag("cash_account_tooltip_dismissed", true)`
then `markFirstRunConsumed()`. On Android, also intercept hardware back while
visible (`BackHandler`) and treat it as dismiss (FR-039).

### G.4 Wire into the dashboard

Edit `apps/mobile/app/(tabs)/index.tsx`:

- **Do NOT touch the existing `<SmsPermissionPrompt>` wiring.** `useSmsSync()` +
  the prompt render continue exactly as today. This preserves the prompt's
  existing recurring-render behavior for undismissed Android users.
- Add a single new line: `<CashAccountTooltip />` (after the SMS prompt render).
  Its self-gating logic handles everything.

### G.5 Wire the trigger

In `CurrencyStep`'s confirm handler: call
`confirmCurrencyAndOnboard(currency, { onTransactionCommitted: () => markFirstRunPending() })`
before navigation (Phase D.1 already does this — just verify here).

### G.6 Tests

- `__tests__/components/dashboard/CashAccountTooltip.test.tsx` — 4 cases per
  [`plan.md §Component tests`](./plan.md):
  1. `!isFirstRunPending` → not rendered.
  2. `isFirstRunPending && shouldShowPrompt === true` → not rendered (SMS prompt
     takes priority).
  3. `onboardingFlags.cash_account_tooltip_dismissed === true` → not rendered.
  4. All conditions satisfied → rendered; dismiss sets the flag + calls
     `markFirstRunConsumed()`.

### G.7 Commit

`feat(026): first-run cash-account tooltip`

**Implements**: FR-017 to FR-020, FR-039 (tooltip back).

---

## Phase H — OnboardingGuideCard refactor + mic tooltip (45 min)

**Goal**: Update the card to 4 steps, wire the mic tooltip, and change the voice
completion rule.

### H.1 Update `useOnboardingGuide.ts`

Per [`contracts/services.md §7`](./contracts/services.md):

- Drop `cash_account` step entirely.
- Rename `first_transaction` → voice-specific with `Q.where("source", "VOICE")`.
- Rename SMS step label.
- Add `onVoiceStepAction`, `isMicTooltipVisible`, `onMicTooltipTryItNow`,
  `onMicTooltipClose` to the returned state machine per §7.3.
- Hide SMS step on iOS (already happening for the SMS observer; extend to step
  list).

### H.2 Create `MicButtonTooltip.tsx`

Wrapper around `AnchoredTooltip`. Accepts `visible`, `onTryItNow`, `onClose`.
Internally calls neither `setOnboardingFlag` nor `openVoiceEntry` — those are
parent responsibilities via callbacks.

### H.3 Update `OnboardingGuideCard.tsx`

- Render the 4-step list using the new hook state.
- Add `MicButtonTooltip` render, gated by `isMicTooltipVisible`.
- Wire voice step action button to `onVoiceStepAction`.
- Wire tooltip exits to the hook callbacks.
- Update "X/Y" progress pill to reflect `totalSteps`.

### H.4 Tests

- `__tests__/hooks/useOnboardingGuide.test.ts` — 4 steps on Android, 3 on iOS;
  voice completion requires source='VOICE'; action state machine transitions.
- `__tests__/components/dashboard/MicButtonTooltip.test.tsx`.

### H.5 Commit

`feat(026): restructured OnboardingGuideCard with mic tooltip`

**Implements**: FR-022 to FR-027, FR-024a/b/c.

---

## Phase I — Dashboard skeleton fix (5 min)

### I.1 Edit `DashboardSkeleton.tsx`

Remove the `<OnboardingGuideCardSkeleton />` line. Leave the other skeletons in
place.

### I.2 Visual check

Cold-launch the app as a user who has dismissed the Setup Guide card. Observe no
layout jump above the fold.

### I.3 Commit

`fix(026): remove OnboardingGuideCardSkeleton slot from dashboard skeleton`

**Implements**: FR-028, SC-007.

---

## Phase J — Dark mode QA + RTL QA (30 min)

### J.1 Dark mode QA

For every new/modified surface, switch the device to system dark mode and
verify:

- Pitch Slide 1 (Voice) — text legible, mic pulse visible.
- Pitch Slide 2 (SMS — Android) — SMS bubble has sufficient contrast.
- Pitch Slide 2 (Offline — iOS) — all offline chrome legible.
- Pitch Slide 3 (Live Market) — gold/silver accents still visible.
- Auth screen — welcome title + pills + trust microbar.
- Currency step.
- Cash-account tooltip.
- Mic-button tooltip.
- Setup Guide card (expanded + collapsed states).
- Dashboard with skeleton removed (no flash).

Apply `dark:` variants per
[`design/slides-concepts.md` dark-mode token table](./design/slides-concepts.md).
Any missed pairing is a FR-036 violation — fix before considering the phase
complete.

### J.2 RTL QA

Switch language to Arabic. Walk through the full flow. Verify:

- Slides use `start-*` / `end-*` correctly (Skip appears on the logical "end"
  corner).
- Language switcher pill flips to the logical "start" corner.
- Tooltips' arrow positions flip correctly relative to anchored elements.
- No layout breaks (overflow, clipping).

**Implements**: FR-036, FR-037, FR-038, SC-008.

---

## Phase K — Integration walkthroughs (15 min)

Per [`plan.md §Testing Strategy`](./plan.md), run these manual walkthroughs:

1. **Fresh Android install** → pitch (SMS slide) → skip slide 2 → auth (language
   pill visible) → email sign-up → Currency (language pill visible, hardware
   back blocked) → confirm EGP → dashboard → SMS prompt → dismiss → cash-account
   tooltip appears → dismiss → Setup Guide card (4 steps, voice step has
   NEW+GO).
2. **Tap GO on voice step** → mic tooltip appears centered in tab bar → tap "Try
   it now" → tooltip dismisses AND voice overlay opens → cancel voice → return
   to dashboard → tap GO again → voice opens directly (no tooltip).
3. **Tap X on mic tooltip instead** (fresh install alt path) → tooltip
   dismisses, voice doesn't open, `voice_tooltip_seen=true` set → verify next GO
   tap opens voice directly.
4. **Fresh iOS install** → pitch (Offline slide instead of SMS) → auth →
   Currency → dashboard → NO SMS prompt → cash-account tooltip → Setup Guide
   card (3 steps, SMS hidden).
5. **Returning user (pitch seen)** → cold launch → lands on auth directly, no
   pitch.
6. **Already-onboarded user** → cold launch → dashboard directly (no Currency,
   no tooltips).
7. **Sign out on Currency step** → returns to pre-auth (pitch if `!intro:seen`,
   auth otherwise).
8. **Force-quit during slide 2** → relaunch → pitch restarts from slide 1 (no
   partial credit).
9. **Language switch on slide 1 EN→AR** → app reloads (RTL flip) → pitch
   restarts from slide 1 **in Arabic immediately** (no English flash) → auth
   renders in Arabic → Currency step renders in Arabic → confirm → verify
   `profile.preferred_language = "ar"` written atomically and AsyncStorage
   `@rizqi/intro-locale-override` STILL equals `"ar"` (not cleared).
10. **Android back-button on Currency step** → press hardware back → no-op (step
    remains).
11. **Android back-button on cash-account tooltip (when visible on its own)** →
    tooltip dismisses, flag persists.
12. **Dark mode walkthrough** → repeat #1 with system dark mode enabled.

Each walkthrough is a pass/fail gate for the corresponding spec user story
(US1–US5).

---

## Phase L — Business decisions update + final cleanup (10 min)

### L.1 Update `docs/business/business-decisions.md`

In §12.2 (profiles table), add a row for `onboarding_flags` (JSONB, NOT NULL,
DEFAULT `{}`). Reference spec 026 as the source.

### L.2 Verify `onboarding-cursor-service` is unused

Grep for callers. If none remain, leave the file in place (to be deleted in a
follow-up) but add a `@deprecated` JSDoc at the top pointing to this feature's
PR.

### L.3 Verify `setPreferredCurrencyAndCreateCashAccount` is unused

Same treatment. Mark `@deprecated`, schedule removal.

### L.4 Final spec check

- Re-read `spec.md` section by section, confirming every FR has at least one
  corresponding file/test in the PR.
- Verify every SC is testable with the test structure in place.

### L.5 Commit

`docs(026): update business-decisions.md; deprecate legacy services`

---

## Phase M — PR prep (10 min)

- Run `npm run lint` and `npm run typecheck` — both must pass.
- Run all tests: `npm test`. 80%+ coverage per project convention.
- Manually smoke-test on both Android and iOS simulators/emulators.
- Open PR against `main`; description links this spec and issue #246.

---

## Estimated total effort

~4.5 hours of focused work for an experienced React Native + Rizqi codebase
developer, plus QA passes (~1 hour). Buffer in: ~30 minutes per phase for
unexpected issues brings the realistic estimate to ~6 hours end-to-end.

If the voice-entry flow refactor in Phase B.3 turns out to be larger than
expected (it involves an existing component the feature doesn't fully own),
budget 30–60 additional minutes.

---

## Acceptance — feature ready for merge

✅ All FRs in `spec.md` have implementing code. ✅ All acceptance scenarios in
`spec.md` user stories pass when walked through manually. ✅ All new unit tests
pass; overall coverage ≥ 80%. ✅ TypeScript strict-mode compilation passes. ✅
Lint passes. ✅ Dark mode visually verified on every new/modified surface. ✅
RTL (Arabic) visually verified on every new/modified surface. ✅ Manual
walkthroughs (Phase K) all pass on both platforms. ✅ Migration 043 applied
cleanly (local + remote). ✅ Business-decisions.md §12.2 updated. ✅ No
regressions in existing flows (sign-in, dashboard, transaction add, budgets,
etc.) — smoke test.
