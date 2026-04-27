# Phase 0 — Research: Onboarding Restructure

**Feature**: 026-onboarding-restructure **Date**: 2026-04-23

This document resolves every NEEDS CLARIFICATION point in the plan's Technical
Context and documents architectural patterns that the implementation relies on.
Each section has a Decision + Rationale + Alternatives triad.

## 1. Atomic write for Currency confirmation

### Decision

**Implement a single outer `database.write()` wrapping all four mutations**
(cash account create, `preferred_currency`, `preferred_language`,
`onboarding_completed`) by extracting a non-writer helper from
`account-service.ts` and composing it inside the outer writer. This gives
genuine all-or-nothing semantics matching the spec's FR-014.

### Rationale

- FR-014 mandates "single atomic write … if any part fails, NO partial data MUST
  be left behind." A sequential two-write approach (current
  `profile-service.setPreferredCurrencyAndCreateCashAccount`) can leave
  `preferred_currency` + `onboarding_completed = true` set without a cash
  account if the second write fails. Since FR-012/FR-031 make
  `onboarding_completed` the routing signal, a partial state (flag `true` but no
  cash account) would route the user to the dashboard with a broken account list
  — exactly the failure mode the spec forbids.
- WatermelonDB's `database.write()` is a true transaction at the SQLite level —
  a single `database.write()` either commits all its inner mutations or rolls
  back the entire batch.
- WatermelonDB does NOT allow nested writers (writer-within-writer). The
  existing sequential approach in `profile-service.ts` documents this:
  _"Wrapping both in a single outer `database.write` caused a nested-write
  deadlock … observed at the currency step."_ The nested-writer issue comes from
  `ensureCashAccount` owning its own `database.write()` internally. If we call
  it from inside another `database.write()`, it deadlocks.
- **Resolution**: extract
  `createCashAccountWithinWriter(userId, currency, name?, accountsCollection)` —
  a pure creation helper that runs under a writer it was passed (or rather,
  operates on a collection it was passed after the caller opened a writer).
  Callers who need stand-alone behavior still use `ensureCashAccount`, which
  internally opens a writer and calls the helper.

### Alternatives considered

- **Accept best-effort atomicity** with explicit rollback on failure (e.g., flip
  `onboarding_completed` back to `false` if cash-account creation fails).
  Rejected: leaves a window where a concurrent read sees the partial state; adds
  complexity for error paths; fundamentally weaker than real transaction
  semantics.
- **Keep sequential writes and the AsyncStorage cursor as the recovery
  mechanism** (existing behavior). Rejected: the restructure explicitly removes
  the cursor (per the spec's "eliminated" list). Retaining it for this one edge
  case contradicts the simplification goal.
- **Defer atomicity to a later refactor**. Rejected: the routing invariant
  "onboarding_completed = true ⟹ cash account exists AND preferred_currency set
  AND preferred_language set" is foundational to FR-012. Without atomicity, the
  invariant can be violated during normal operation, not just in edge cases.

### Implementation shape

```ts
// apps/mobile/services/profile-service.ts (new function)
export async function confirmCurrencyAndOnboard(
  currency: CurrencyType
): Promise<{ readonly accountId: string }> {
  const profile = await getProfile();
  const userId = profile.userId;

  // The user's currently-active app language already reflects any switches made
  // on pitch, auth, or Currency screens via the shared LanguageSwitcherPill. Read
  // it OUTSIDE the writer to avoid I/O during the transaction.
  const currentLanguage = getCurrentLanguage(); // "en" | "ar"
  const preferredLanguage: PreferredLanguageCode =
    currentLanguage === "ar" ? "ar" : "en";

  let accountId = "";

  await database.write(async () => {
    // Mutation 1: create cash account (inline, no nested writer)
    const accountsCollection = database.get<Account>("accounts");
    const existing = await accountsCollection
      .query(/* same query as ensureCashAccount */)
      .fetch();
    const account =
      existing[0] ??
      (await accountsCollection.create((acc) => {
        acc.userId = userId;
        acc.name = CASH_ACCOUNT_NAME;
        acc.type = CASH_ACCOUNT_TYPE;
        acc.currency = currency;
        acc.balance = 0;
        acc.deleted = false;
      }));
    accountId = account.id;

    // Mutations 2–4: profile updates (single update() call)
    // preferred_currency is NOT NULL DEFAULT 'EGP', so we always overwrite.
    // preferred_language is NOT NULL DEFAULT 'en', so we always overwrite.
    // onboarding_completed defaults to false and is flipped true here — the
    // routing signal (FR-031).
    await profile.update((p) => {
      p.preferredCurrency = currency;
      p.preferredLanguage = preferredLanguage;
      p.onboardingCompleted = true;
    });
  });

  // AFTER the atomic write succeeds, apply i18n side-effect IF the profile's
  // stored language differs from the runtime language. In practice this is a
  // no-op during onboarding (we just wrote the runtime language to the profile),
  // but the branch is kept so the helper is safe to reuse from other code paths.
  if (getCurrentLanguage() !== preferredLanguage) {
    await changeLanguage(preferredLanguage);
  }

  // NOTE: the AsyncStorage `@rizqi/intro-locale-override` is NOT cleared here
  // (FR-030). It persists as a device-level language preference.

  return { accountId };
}
```

**Notes**:

- `changeLanguage` is an i18n + RTL side-effect, not a data write. It runs after
  the transaction commits; if it fails, the DB is still consistent and i18n will
  self-correct on next launch (the splash coordinator in `_layout.tsx` syncs
  i18n to `profile.preferredLanguage`).
- The routing gate (`routing-decision.ts`) keeps reading `onboarding_completed`
  — this function is what flips that flag to `true`. No changes to
  `routing-decision.ts` are needed.
- `preferred_currency` is `currency_type NOT NULL DEFAULT 'EGP'`; the write
  overwrites the default even if the user confirmed EGP. `preferred_language` is
  `preferred_language_code NOT NULL DEFAULT 'en'`; the write overwrites it with
  the current runtime language.

---

## 2. JSONB in WatermelonDB — `onboarding_flags` column

### Decision

**Follow the existing `profiles.notification_settings` precedent**: store as
JSONB on Supabase, as `string` (stringified JSON) in WatermelonDB, with
`JSON.parse()` in the model's getter.

### Rationale

- WatermelonDB has no native JSONB/object column type. The `@json` decorator
  exists but the Rizqi codebase doesn't use it (per-field manual parsing is the
  established pattern).
- `notification_settings` was added to the `profiles` table in an earlier
  migration and is stored exactly this way. `Profile.ts` defines:

  ```ts
  @field("notification_settings") notificationSettingsRaw?: string;

  get notificationSettings(): NotificationSettings | undefined {
    if (!this.notificationSettingsRaw) return undefined;
    try { return JSON.parse(this.notificationSettingsRaw); } catch { return undefined; }
  }
  ```

- Matching the precedent keeps the model consistent and avoids introducing a new
  pattern for the sake of one new column.

### Alternatives considered

- **Use WatermelonDB's `@json` decorator**. Rejected: inconsistent with the
  existing `notification_settings` pattern. Introducing a new access pattern
  alongside the existing one creates cognitive overhead for anyone reading
  `Profile.ts`.
- **Add two separate boolean columns instead of a JSONB**. Rejected per
  clarification Q1 — JSONB scales to future tooltip flags without new
  migrations.
- **A separate `onboarding_flags` table**. Rejected per clarification Q1 —
  overkill for 2 flags; adds sync complexity.

### Implementation shape

```ts
// packages/db/src/types.ts
export interface OnboardingFlags {
  readonly cash_account_tooltip_dismissed?: boolean;
  readonly voice_tooltip_seen?: boolean;
  // Future flags added here without schema changes.
}

// packages/db/src/models/base/base-profile.ts (auto-regenerated)
@field("onboarding_flags") onboardingFlagsRaw?: string;

// packages/db/src/models/Profile.ts
get onboardingFlags(): OnboardingFlags {
  if (!this.onboardingFlagsRaw) return {};
  try {
    return JSON.parse(this.onboardingFlagsRaw) as OnboardingFlags;
  } catch {
    return {};
  }
}
```

**Supabase migration (043)**:

```sql
ALTER TABLE profiles
  ADD COLUMN onboarding_flags JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN profiles.onboarding_flags
  IS 'Per-profile first-run tooltip dismissal markers. Boolean keys added
      without schema migrations. See specs/026-onboarding-restructure/
      data-model.md for the current key catalogue.';
```

**WatermelonDB migration entry** (`packages/db/src/migrations.ts`):

Bump schema version (currently 16) to 17. Add `addColumns` step for
`onboarding_flags` string column.

---

## 3. AsyncStorage patterns & keys

### Decision

**New keys follow the existing `@rizqi/` device-scoped prefix convention**:

- `@rizqi/intro-seen` (boolean as string: `"true"` / `"false"` / missing)
- `@rizqi/intro-locale-override` (string: `"en"` | `"ar"` | missing)

Both are **device-scoped**, NOT cleared on logout (inherited from
`storage-keys.ts` pattern — device-level keys intentionally survive logout so
returning users don't re-see intro content).

### Rationale

- Existing `storage-keys.ts` uses `@rizqi/first-use-date` (device-scoped) and
  `@rizqi/logout-in-progress` (device-scoped). Per-user keys use a different
  shape: `onboarding:<userId>:step` (with userId in the key).
- The pitch is pre-auth — there's no `userId` at write time. Device scope is the
  only reasonable scope.
- `CLEARABLE_USER_KEYS` in the existing file explicitly documents "device-level
  keys are intentionally excluded so the user is not forced through onboarding
  again on the same device." This matches FR-029 / FR-030 intent.

### Alternatives considered

- **Use a per-user AsyncStorage key** (`intro:<userId>:seen`). Rejected: the
  pitch is pre-auth; we'd have to write the flag only AFTER sign-up, which is
  too late — the pitch's point is to be skippable on subsequent app opens.
- **Store on the device's native settings (UserDefaults / SharedPreferences) via
  a separate module**. Rejected: introduces a new storage system for a single
  new flag. AsyncStorage is the established device-scoped storage.

### Implementation shape

```ts
// apps/mobile/constants/storage-keys.ts (additions)
/** Set to "true" once the user has completed OR explicitly skipped the pre-auth pitch on this device. */
export const INTRO_SEEN_KEY = "@rizqi/intro-seen";

/** Explicit language preference selected on any pre-auth surface (pitch, auth,
 *  or Currency step). Empty/missing ⟹ use device locale. Once written, it
 *  behaves as a device-level language preference (FR-030) and is NOT cleared
 *  on sign-up, sign-out, or any other event. */
export const INTRO_LOCALE_OVERRIDE_KEY = "@rizqi/intro-locale-override";

// Note: these keys are NOT added to CLEARABLE_USER_KEYS — they persist across logout.

// apps/mobile/services/intro-flag-service.ts (new module)
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  INTRO_SEEN_KEY,
  INTRO_LOCALE_OVERRIDE_KEY,
} from "@/constants/storage-keys";

export async function readIntroSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(INTRO_SEEN_KEY);
  return raw === "true";
}

export async function markIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(INTRO_SEEN_KEY, "true");
}

export async function readIntroLocaleOverride(): Promise<"en" | "ar" | null> {
  const raw = await AsyncStorage.getItem(INTRO_LOCALE_OVERRIDE_KEY);
  return raw === "en" || raw === "ar" ? raw : null;
}

export async function setIntroLocaleOverride(lang: "en" | "ar"): Promise<void> {
  await AsyncStorage.setItem(INTRO_LOCALE_OVERRIDE_KEY, lang);
}

// NOTE: no clearIntroLocaleOverride() export. The override is device-scoped
// and intentionally persists (FR-030). If a future feature genuinely needs
// to reset it, add the helper at that time.
```

---

## 4. Hardware back button (Android)

### Decision

Use React Native's
**`BackHandler.addEventListener("hardwareBackPress", handler)`** pattern. Scope
each listener to the surface that owns it via `useEffect`, returning a cleanup
function that removes the listener.

### Rationale

- `BackHandler` is the standard RN primitive for hardware back. No third-party
  dep.
- The codebase already uses this pattern (see
  `apps/mobile/components/budget/BudgetActionsSheet.tsx`).
- Each listener returns `true` to consume the event (prevent default exit/back)
  or `false` to allow default behavior.

### Surfaces & handlers

| Surface              | Back behavior                                   | Handler logic                                                                                              |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pitch slides (all 3) | Previous slide; slide 1 → exit app (default)    | If `currentIndex > 0` → call `carousel.prev()` + return `true`. Else return `false` (default exits app).   |
| Cash-account tooltip | Dismiss tooltip                                 | Set `onboarding_flags.cash_account_tooltip_dismissed = true` + hide tooltip. Return `true`.                |
| Mic-button tooltip   | Dismiss tooltip (X semantics, NOT "Try it now") | Set `onboarding_flags.voice_tooltip_seen = true` + hide tooltip. Do NOT open voice overlay. Return `true`. |
| Currency step        | No-op (blocked)                                 | Return `true` unconditionally.                                                                             |
| Auth screen          | Navigate to pitch if `!intro:seen`; else exit   | Use `router.back()` if pitch is on the stack, or `router.replace("/")` if not — fallback to default.       |

### Alternatives considered

- **Use `useFocusEffect` from `@react-navigation/native`** to scope listeners to
  focus events. Rejected: `expo-router` provides equivalent scoping via
  `useEffect` + route-level mounting; no need for an additional abstraction.
- **Global back handler at the route root** that dispatches based on current
  screen. Rejected: violates Single Responsibility. Each surface owns its own
  back behavior.

---

## 5. Tooltip / anchored-overlay primitive

### Decision

**Build a new `AnchoredTooltip` component in `components/ui/`** for the
first-run tooltips (cash-account + mic-button). The existing `Tooltip.tsx` is
text-only with auto-dismiss — insufficient for our needs (we require a dim
backdrop, a titled body, a primary action button, and optionally an X close
icon).

### Rationale

- Existing `Tooltip.tsx` is a text-label tooltip used by `ReadOnlyDropdown` and
  `MetalsHeroCard`. It fades in/out, has an arrow, but has no dim backdrop, no
  button, no icon.
- Our first-run tooltips (per mockups) have: dimmed dashboard backdrop, title +
  body card, arrow pointing at an anchored element, dismiss button(s). A
  genuinely different component.
- Building a new primitive is faster + more correct than trying to extend the
  existing one and risking regressions in `ReadOnlyDropdown` / `MetalsHeroCard`.

### Component API (sketch)

```tsx
interface AnchoredTooltipProps {
  readonly visible: boolean;
  /** The element to anchor to — a ref to a rendered View. */
  readonly anchorRef: React.RefObject<View>;
  /** Tooltip content. */
  readonly title: string;
  readonly body: string;
  readonly icon?: React.ReactNode; // small circular icon at top
  /** Primary button label + action. */
  readonly primaryLabel: string;
  readonly onPrimaryPress: () => void;
  /** Optional secondary close (X icon, top-right). Omit to hide. */
  readonly onClose?: () => void;
  /** Anchor side: tooltip sits above or below the anchor. Default "above". */
  readonly anchorSide?: "above" | "below";
}
```

Internals: measures the anchor via `anchorRef.measureInWindow` on open;
positions the tooltip using absolute coordinates; renders a dim backdrop layer
(slate-900 at 30% opacity) via `Modal` or absolutely-positioned `View` with
`z-index`. Android NativeWind v4 modal layout-collapse bug is a known risk — see
`docs/CODEMAPS` references or the project's Android overlay rule
(`.claude/rules/android-modal-overlay-pattern.md`) for the safe overlay pattern.

### Alternatives considered

- **Extend existing `Tooltip.tsx`** with new props (button, icon, backdrop).
  Rejected: would break the simpler tooltip's API and complicate its logic.
  Easier to have two components with clear Single Responsibility.
- **Use a third-party library** (e.g., `react-native-walkthrough-tooltip`).
  Rejected: no current dependency on one; this feature doesn't justify adding
  one; custom control over copy and animation matters.

---

## 6. Mid-app i18n language switching + startup-time seeding

### Decision

Use the existing `changeLanguage()` function
(`apps/mobile/i18n/changeLanguage.ts`). For the shared `LanguageSwitcherPill` on
pitch / auth / Currency surfaces, call `changeLanguage(newLang)` directly and
persist the override via `setIntroLocaleOverride(newLang)`.

**Also update `detectInitialLanguage()` in `apps/mobile/i18n/index.ts` to read
`INTRO_LOCALE_OVERRIDE_KEY` from AsyncStorage FIRST, falling back to device
locale, then to English.** This is required to prevent a visible language-flash
after an RTL-triggered reload (FR-002).

### Rationale

- `changeLanguage()` updates i18next AND calls `applyRTL()`. When switching
  **to/from Arabic**, `applyRTL()` triggers a full app reload (1–2s loading
  screen per the function's JSDoc). This is a platform constraint — React Native
  can't dynamically flip RTL without a reload.
- **Without the startup-time override read**, the reloaded app would initialize
  i18n to the device locale, render briefly in that locale, and only then apply
  the override when the pitch/auth screen mounts and calls `changeLanguage`.
  This is the "language flash" forbidden by FR-002.
- **With the startup-time override read**, `initI18n()` seeds i18next with the
  override value before any screen renders. The reloaded app renders in the
  user's chosen language immediately.
- For the pitch, this means: if a user is on slide 2 (English) and switches to
  Arabic, the app reloads, then re-renders from slide 1 (since we lose React
  state on reload), with i18n already set to Arabic at startup — no flash.
- For non-RTL switches (EN→EN, AR→AR, or switches that don't flip RTL
  direction), no reload — just a fast i18n switch. The override is still
  persisted so a future cold launch respects it.

### Edge case

- User switches language mid-pitch → reload happens → pitch restarts from slide
  1 in the new language (thanks to the startup-time override read). `intro-seen`
  is NOT yet set, so the pitch re-mounts correctly.
- If the user had reached slide 3 before switching → they lose progress and
  start over. This is acceptable; alternative (preserving slide index across
  reload) would require writing the slide index to AsyncStorage just for this
  edge case.

### Implementation shape

```ts
// apps/mobile/i18n/index.ts (detectInitialLanguage refactor)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { INTRO_LOCALE_OVERRIDE_KEY } from "@/constants/storage-keys";
import * as Localization from "expo-localization";

export async function detectInitialLanguage(): Promise<"en" | "ar"> {
  // 1. Device-scoped override (set by LanguageSwitcherPill on any pre-auth surface)
  const override = await AsyncStorage.getItem(INTRO_LOCALE_OVERRIDE_KEY);
  if (override === "en" || override === "ar") return override;

  // 2. Device locale
  const locales = Localization.getLocales();
  const deviceLang = locales[0]?.languageCode;
  if (deviceLang === "ar") return "ar";

  // 3. English fallback
  return "en";
}

// initI18n() must await detectInitialLanguage() before calling i18next.init(),
// so i18next is initialized with the correct language on the very first render.
```

### Alternatives considered

- **Persist the pitch's current slide index to AsyncStorage** so a mid-pitch
  language switch resumes at the same slide. Rejected: adds ephemeral state to
  persistent storage for a cosmetic improvement. Users switching language
  mid-pitch restart from slide 1 — fine.
- **Block language switching mid-pitch**. Rejected: user's legitimate need
  (picked wrong language on auto-detect).

---

## 7. Existing SMS permission prompt — keep it outside the queue

### Decision

**Keep the SMS prompt exactly where it is today** — rendered directly by
`(tabs)/index.tsx` via the existing `useSmsSync()` / `<SmsPermissionPrompt>`
wiring — and do NOT move it into a queue controlled by this feature. The new
cash-account tooltip renders independently, gated by the condition
`isFirstRunPending && !shouldShowPrompt && !onboarding_flags.cash_account_tooltip_dismissed`
so the two prompts visually sequence (SMS first, then cash-account) without
needing a shared orchestrator.

### Rationale

- The existing behavior verified in `apps/mobile/hooks/useSmsSync.ts`:
  `shouldShowPrompt = !wasPromptShown && !syncedBefore`, where `wasPromptShown`
  is keyed on `SMS_PROMPT_SHOWN_KEY` (set on dismiss — "Allow" or "Not Now") and
  `syncedBefore` is keyed on `SMS_HAS_SYNCED_KEY`. The prompt re-appears on
  every dashboard mount for Android users who have never dismissed and never
  synced. Preserving this is a hard requirement — moving it into a
  session-scoped queue would break this recurring visibility.
- The cash-account tooltip is NEW, per-profile, and one-shot. It lives in
  `onboarding_flags.cash_account_tooltip_dismissed` and is guarded by the
  session-scoped `isFirstRunPending` so it fires only for users who just
  completed the Currency step in this session.
- Using `!shouldShowPrompt` as a gating condition on the cash-account tooltip
  ensures the two never overlap visually (cash-account waits for SMS to be
  dismissed before appearing), without introducing a shared queue abstraction.
- The mic-button tooltip is also new — new key
  `onboarding_flags.voice_tooltip_seen` — and triggered by the voice step's
  action button, not by the dashboard mount. Fully independent.

### Implementation shape

```tsx
// apps/mobile/app/(tabs)/index.tsx (simplified)

// Existing — unchanged
const { shouldShowPrompt, dismissPrompt, /* ... */ } = useSmsSync();

// Existing — unchanged
<SmsPermissionPrompt visible={shouldShowPrompt} onDismiss={dismissPrompt} /* ... */ />

// NEW — renders independently when SMS prompt is NOT on screen
<CashAccountTooltip />
// Internally: guarded by isFirstRunPending && !shouldShowPrompt && !onboardingFlags.cash_account_tooltip_dismissed
```

The cash-account tooltip component reads `useFirstRunTooltip()`, `useSmsSync()`
(for `shouldShowPrompt` only — not consumed), and `useOnboardingFlags()` to
compute its own visibility. It calls `markFirstRunConsumed()` after dismissal so
subsequent renders in the same session don't re-evaluate.

### Alternatives considered

- **Single `FirstRunTooltipQueue` orchestrator that includes the SMS prompt**.
  Rejected: would require moving the SMS prompt's render site into the queue
  component. Breaks the SMS prompt's existing recurring-render behavior (it
  currently re-appears on every dashboard mount for undismissed-and-unsynced
  Android users), and couples an existing stable component to a new feature for
  no real benefit.
- **Migrate the SMS prompt state into `onboarding_flags` for consistency**.
  Rejected: out of scope. The SMS prompt is existing, working, unchanged. Its
  state lives wherever it lives today; we reuse the hook.

---

## 8. First-run tooltip trigger signal

### Decision

**Use a short-lived in-memory flag in a new `FirstRunTooltipContext`** (React
context) that the Currency-step handler sets to `true` after the atomic write
succeeds (just before navigating to the dashboard). The flag is read by the new
`CashAccountTooltip` component on dashboard mount, and cleared
(`markFirstRunConsumed()`) after that tooltip is dismissed.

### Rationale

- FR-020: "triggered specifically by the transition from Currency-step
  confirmation to dashboard, not by dashboard entry in general."
- Persisting this trigger in AsyncStorage would be wrong — it's a one-shot
  session signal, not persistent state.
- Using a router param (`/(tabs)?fromCurrency=true`) works but pollutes the URL
  and is easy to miss.
- React context is a clean, typed way to signal between sibling routes.

### Alternatives considered

- **Zustand or Redux global state**. Rejected: no Zustand/Redux in the codebase;
  adding a state library for one flag is overkill.
- **Route param**. Rejected: leaks intent into URLs; a user bookmarking or
  shortcut-sharing could re-trigger the flow unintentionally.
- **Persistent flag cleared on first read**. Rejected: a crash between set and
  read would prevent the user from seeing the first-run tooltips on relaunch —
  which is actually probably fine (they're already on dashboard, the ship has
  sailed), but cleaner to use in-memory.

### Implementation shape

```tsx
// apps/mobile/context/FirstRunTooltipContext.tsx (new)
interface FirstRunTooltipContextValue {
  readonly isFirstRunPending: boolean;
  readonly markFirstRunPending: () => void;
  readonly markFirstRunConsumed: () => void;
}

// Provider wraps the app layout.
// Currency-step handler: after confirmCurrencyAndOnboard resolves, call
//   markFirstRunPending() BEFORE router.replace("/(tabs)").
// CashAccountTooltip: read isFirstRunPending; if true AND !shouldShowPrompt
//   AND !onboarding_flags.cash_account_tooltip_dismissed → render; on dismiss,
//   setOnboardingFlag("cash_account_tooltip_dismissed", true) + markFirstRunConsumed().
```

---

## 9. Voice-entry flow: programmatic trigger from "Try it now"

### Decision

**Expose a small `openVoiceEntry()` function** that's the same code path as the
tab-bar mic button invokes. "Try it now" calls it directly after dismissing the
tooltip.

### Rationale

- The voice-entry flow is owned by an existing component/hook (triggered today
  by the mic FAB in the tab bar). We don't know its exact shape without reading
  that code, but the pattern is: the mic button has an `onPress` handler that
  opens the voice recording overlay.
- If the existing `onPress` handler is a private component method, we need to
  expose it as a shared service or hook. Likely a small refactor (extract to a
  service or a context provider).
- If it's already in a context or service (a `VoiceEntryProvider` or similar),
  we just import and call.

### Action item for implementation

Read `apps/mobile/components/` to find the mic FAB (likely in the tab bar
layout). If its handler is local, extract to `services/voice-entry-service.ts`
or a context. This is a small prerequisite refactor done at the start of
implementation, not a blocker.

### Alternatives considered

- **Simulate a tap on the mic button programmatically** (find ref, fire
  onPress). Rejected: fragile and hard to test.
- **Navigate to a voice-entry route**. Rejected: the voice entry is typically an
  overlay, not a route, in this codebase (per spec "no new voice-entry screen is
  introduced").

---

## 10. Splash / AppReadyGate coordinator in `_layout.tsx` and routing gate in `index.tsx`

### Decision

**No changes to `_layout.tsx` OR `routing-decision.ts` are required.** The
existing routing gate shipped with #226 already reads
`profile.onboardingCompleted` — which is the correct signal per FR-031 (see §5
in `data-model.md` for the rationale). Our atomic Currency-confirmation write
flips `onboarding_completed = true`, which the existing router already consumes.

The existing `AppReadyGate`:

- Waits for `initialSyncState !== "in-progress"` AND profile to load.
- Syncs i18n to `profile.preferredLanguage` after pull-sync.

Both behaviors remain valid for this feature.

### Rationale

- `preferred_currency` is `currency_type NOT NULL DEFAULT 'EGP'` (migration
  042). It ALWAYS has a value on a newly-inserted profile, so it can't
  distinguish "never onboarded" from "chose EGP." It's unusable as a routing
  signal.
- `onboarding_completed` starts `false` on insert and flips `true` inside the
  atomic write. It's the only signal that reliably tracks "has the user finished
  the Currency step." The existing router behavior from #226 is already correct
  for this feature.
- Verified against `apps/mobile/app/index.tsx` +
  `apps/mobile/utils/routing-decision.ts`: gate returns `null` while
  `initialSyncState === "in-progress"` or `isProfileLoading`, then reads
  `profile.onboardingCompleted` to decide onboarding vs. dashboard.
- Verified against `apps/mobile/i18n/index.ts`: `detectInitialLanguage()`
  currently uses device locale at launch. **This function MUST be updated to
  read `INTRO_LOCALE_OVERRIDE_KEY` first** (see §6 above) — that's the one
  change in the i18n startup path required by this feature.

### Files touched by this feature in the routing/startup path

| File                                      | Change                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/mobile/utils/routing-decision.ts`   | **None.** Signature and logic unchanged.                                        |
| `apps/mobile/app/index.tsx`               | **None.** Continues to read `profile.onboardingCompleted`.                      |
| `apps/mobile/app/_layout.tsx`             | **None** (beyond wrapping `FirstRunTooltipProvider` around the tree).           |
| `apps/mobile/i18n/index.ts`               | `detectInitialLanguage()` updated to read override first (§6).                  |
| `apps/mobile/services/profile-service.ts` | New `confirmCurrencyAndOnboard()` flips `onboarding_completed` atomically (§1). |

---

## 11. Dark mode testing strategy

### Decision

**Manual visual QA on real devices/emulators in system dark mode**, supplemented
by snapshot-like unit tests that verify theme token usage (not actual
rendering).

### Rationale

- Jest + React Native Testing Library can't test visual output reliably.
  Snapshot testing catches class-name regressions but not actual color
  rendering.
- Our implementation uses NativeWind `dark:` variants directly in className —
  correctness is a function of whether the right Tailwind classes are applied in
  both modes. A contrast regression would show up in manual QA but not in unit
  tests.
- **Unit-testable aspect**: assert that components include expected `dark:`
  class names. E.g.,
  `expect(element.props.className).toMatch(/dark:bg-slate-900/)`. This is
  shallow but catches accidental removal of dark variants.

### QA checklist (embedded in `quickstart.md`)

For each surface:

- Verify in light mode.
- Switch device to system dark mode.
- Verify no text is unreadable.
- Verify no icons disappear.
- Verify accent colors (gold, silver, orange chip, nileGreen) are still visible.

---

## Summary of resolved unknowns

| #   | Topic                                         | Status                                                                                                                             |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Atomic Currency write semantics               | ✅ Resolved — refactor to single outer `database.write()`                                                                          |
| 2   | JSONB in WatermelonDB                         | ✅ Resolved — follow `notification_settings` precedent                                                                             |
| 3   | AsyncStorage keys                             | ✅ Resolved — `@rizqi/intro-*` prefix, device-scoped                                                                               |
| 4   | Hardware back button                          | ✅ Resolved — `BackHandler` per-surface                                                                                            |
| 5   | Tooltip primitive                             | ✅ Resolved — new `AnchoredTooltip` component                                                                                      |
| 6   | i18n mid-app switching + startup-time seeding | ✅ Resolved — existing `changeLanguage()`, + `detectInitialLanguage()` reads override first to avoid post-RTL-reload flash         |
| 7   | SMS prompt handling                           | ✅ Resolved — keep SMS prompt outside the queue; cash-account tooltip gates itself on `!shouldShowPrompt`                          |
| 8   | Trigger signal for first-run tooltips         | ✅ Resolved — `FirstRunTooltipContext` in-memory flag                                                                              |
| 9   | Voice entry programmatic trigger              | ✅ Resolved — extract `openVoiceEntry()` as small refactor                                                                         |
| 10  | Routing gate + splash coordinator             | ✅ Resolved — NO changes to `routing-decision.ts` / `index.tsx` / `_layout.tsx`; existing `onboarding_completed` signal is correct |
| 11  | Dark mode testing                             | ✅ Resolved — manual QA + shallow class-name assertions                                                                            |

No NEEDS CLARIFICATION markers remain. Ready for Phase 1 (data model +
contracts + quickstart).
