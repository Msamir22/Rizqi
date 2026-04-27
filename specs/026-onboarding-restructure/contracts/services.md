# Service Contracts — Onboarding Restructure

**Feature**: 026-onboarding-restructure **Date**: 2026-04-23

Authoritative signatures for all service functions this feature adds or
modifies. Consumers (hooks, screens) import from the module paths listed. Any
deviation from these contracts requires a spec/plan amendment.

---

## 1. `services/profile-service.ts` (modified)

### 1.1 NEW: `confirmCurrencyAndOnboard`

**Replaces**: `setPreferredCurrencyAndCreateCashAccount` (the current two-write
approach).

```ts
/**
 * Atomically confirms the user's currency choice and completes onboarding.
 *
 * Performs a SINGLE WatermelonDB transaction (`database.write`) that:
 *   1. Creates a default cash account in the chosen currency (idempotent — if
 *      one already exists for this user + currency, no duplicate is created).
 *   2. Writes `preferred_currency` on the profile row.
 *   3. OVERWRITES `preferred_language` on the profile row with the user's
 *      currently-active app language (from `getCurrentLanguage()`). Because
 *      `profiles.preferred_language` is NOT NULL DEFAULT 'en', it always has
 *      a value — this step overwrites the default unconditionally.
 *   4. Flips `onboarding_completed` to true. THIS IS THE ROUTING SIGNAL
 *      (FR-031). The existing `routing-decision.ts` reads this column.
 *
 * All four mutations commit together or none commits (spec FR-014).
 *
 * Side-effects AFTER the transaction (NOT part of the atomic unit):
 *   - If the profile's stored language differs from the runtime language
 *     (shouldn't happen during normal onboarding, but the branch is defensive),
 *     calls `changeLanguage(newLang)` to update i18next + trigger `applyRTL`.
 *     A failure here is logged but does not affect the DB commit — i18n
 *     self-corrects on next launch.
 *   - Sets `FirstRunTooltipContext.isFirstRunPending = true` via a callback
 *     passed by the caller (decoupled so the service has no React context
 *     dependency).
 *   - The AsyncStorage `@rizqi/intro-locale-override` is NOT cleared
 *     (FR-030 — it persists as a device-level language preference).
 *
 * @param currency - Supported currency code. Validated by the DB enum.
 * @param options.onTransactionCommitted - Optional callback invoked after
 *   successful commit but before the function returns; used by the Currency
 *   step screen to flip the FirstRunTooltipContext flag.
 * @returns The created (or pre-existing) cash account ID.
 * @throws Error if the transaction fails (caller shows error toast + stays
 *   on Currency step). Nothing is persisted.
 */
export async function confirmCurrencyAndOnboard(
  currency: CurrencyType,
  options?: { onTransactionCommitted?: () => void }
): Promise<{ readonly accountId: string }>;
```

**Internal flow**:

```ts
// Pseudocode
const profile = await getProfile();

// Read the user's currently-active app language. This already reflects any
// switches made on pitch, auth, or Currency screens via the shared
// LanguageSwitcherPill (which calls changeLanguage + setIntroLocaleOverride).
const runtimeLanguage = getCurrentLanguage(); // "en" | "ar"
const languageToSet: PreferredLanguageCode =
  runtimeLanguage === "ar" ? "ar" : "en";

let accountId = "";

await database.write(async () => {
  // (1) Find or create cash account inline (no nested writer)
  const accountsCollection = database.get<Account>("accounts");
  const existing = await accountsCollection
    .query(
      Q.where("type", CASH_ACCOUNT_TYPE),
      Q.where("user_id", profile.userId),
      Q.where("currency", currency),
      Q.where("deleted", Q.notEq(true))
    )
    .fetch();
  const account =
    existing[0] ??
    (await accountsCollection.create((a) => {
      a.userId = profile.userId;
      a.name = CASH_ACCOUNT_NAME;
      a.type = CASH_ACCOUNT_TYPE;
      a.currency = currency;
      a.balance = 0;
      a.deleted = false;
    }));
  accountId = account.id;

  // (2)(3)(4) Profile updates in a single .update() call.
  // Both preferred_currency and preferred_language are NOT NULL with DB-level
  // defaults, so we overwrite unconditionally. onboarding_completed flips here.
  await profile.update((p) => {
    p.preferredCurrency = currency;
    p.preferredLanguage = languageToSet;
    p.onboardingCompleted = true;
  });
});

// Post-commit side-effects. Typically a no-op in normal onboarding — we just
// wrote the runtime language to the profile, so they already match. Defensive
// branch for code paths where the function is called with state drift.
if (getCurrentLanguage() !== languageToSet) {
  try {
    await changeLanguage(languageToSet);
  } catch (err) {
    logger.warn("onboarding.currency.changeLanguage.failed", err);
  }
}
options?.onTransactionCommitted?.();

return { accountId };
```

### 1.2 NEW: `setOnboardingFlag`

```ts
/**
 * Idempotently merges a single key into `profile.onboarding_flags`.
 *
 * Reads the current JSON, merges the new key (additive — never omits existing
 * keys), and writes the stringified result. All inside a single database.write.
 *
 * @param flagKey - A known key from OnboardingFlags interface. Typed to
 *   prevent typos at compile time.
 * @param value - The boolean value to set. Typically `true` for dismissals.
 * @throws Error if the profile row cannot be loaded or the write fails.
 */
export async function setOnboardingFlag<K extends keyof OnboardingFlags>(
  flagKey: K,
  value: NonNullable<OnboardingFlags[K]>
): Promise<void>;
```

**Internal flow**:

```ts
const profile = await getProfile();
const current = profile.onboardingFlags; // getter returns parsed JSON
const next = { ...current, [flagKey]: value };
await database.write(async () => {
  await profile.update((p) => {
    p.onboardingFlagsRaw = JSON.stringify(next);
  });
});
```

### 1.3 UNCHANGED (still exported, still called by non-onboarding code)

- `setPreferredLanguage(language)` — used by Settings screen; unchanged.
- `completeOnboarding()` — called today from the legacy `WalletCreationStep`.
  **Deprecation target**: once the new flow ships, this function has no callers.
  Can be removed in a follow-up; safe to leave in place for now (idempotent,
  no-op on already-complete profiles).

### 1.4 REMOVED (after feature lands)

- `setPreferredCurrencyAndCreateCashAccount` — replaced by
  `confirmCurrencyAndOnboard`. Remove once no callers remain.

---

## 2. `services/intro-flag-service.ts` (NEW)

```ts
/**
 * Device-scoped AsyncStorage IO for the pre-auth pitch flags.
 *
 * These keys are device-level, NOT per-user — intentionally NOT cleared on
 * logout (see constants/storage-keys.ts). All reads/writes MUST go through
 * this module; no direct AsyncStorage callers allowed elsewhere.
 *
 * @module intro-flag-service
 */

/** Returns true iff the user has previously completed/skipped the pitch on this device. */
export async function readIntroSeen(): Promise<boolean>;

/** Marks the pitch as seen. Idempotent — safe to call multiple times. */
export async function markIntroSeen(): Promise<void>;

/** Returns the explicit language override set during the pitch, or null if none. */
export async function readIntroLocaleOverride(): Promise<"en" | "ar" | null>;

/** Persists an explicit language override selected during the pitch, auth
 *  screen, or Currency step. Behaves as a device-level preference (FR-030) —
 *  never cleared by normal feature code paths. */
export async function setIntroLocaleOverride(lang: "en" | "ar"): Promise<void>;

// NOTE: no clearIntroLocaleOverride() export. The override is device-scoped
// and intentionally persists across sign-up / sign-out / any other event
// (FR-030). If a future feature genuinely needs to reset it, add the helper
// at that time.
```

**Error handling**: each function catches AsyncStorage errors and logs them via
`logger.warn`; reads return safe defaults (`false` / `null`) on failure. Writes
propagate errors so callers can surface a toast if the write was critical.

---

## 3. `services/voice-entry-service.ts` (likely NEW — see research §9)

```ts
/**
 * Programmatically opens the voice-entry overlay — the same flow triggered by
 * the mic button in the bottom tab bar.
 *
 * Called by MicButtonTooltip's "Try it now" handler to dismiss the tooltip
 * and immediately enter the voice flow.
 *
 * If the voice flow logic currently lives inside a component (e.g., the tab
 * layout), extract it here as part of this feature's first implementation step.
 */
export function openVoiceEntry(): void;
```

**Implementation notes**:

- If the existing mic FAB's `onPress` is a local closure inside a layout
  component, refactor to a module-level function or a provider. Prefer the
  service function approach unless the existing pattern is a provider (in which
  case extend the provider and expose via context).
- Should be synchronous (void) from the caller's perspective; any async setup
  (permissions, etc.) is internal to the voice flow.

---

## 4. `hooks/useOnboardingFlags.ts` (NEW)

```ts
/**
 * Observes the current user's profile.onboarding_flags as a reactive,
 * parsed object. Re-renders the consuming component when any flag changes.
 *
 * Returns an empty object `{}` while the profile is loading or if the JSON
 * parse fails (matches the getter's safe fallback).
 */
export function useOnboardingFlags(): OnboardingFlags;
```

**Internal behavior**: observes the profile via WatermelonDB's
`observeWithColumns(["onboarding_flags"])`; parses `onboardingFlagsRaw` each
emission; returns the parsed object. Follows the same pattern as `useProfile` +
`useOnboardingGuide`.

---

## 5. `hooks/useIntroSeen.ts` (NEW)

```ts
/**
 * Subscribes to the device-scoped pitch-seen flag. Re-renders when the
 * underlying AsyncStorage key changes (e.g., when the user completes the pitch).
 *
 * Returns:
 *   - `isSeen` — current boolean state (defaults to false until the initial read completes).
 *   - `isLoading` — true while the initial AsyncStorage read is in flight.
 */
export function useIntroSeen(): {
  readonly isSeen: boolean;
  readonly isLoading: boolean;
};
```

**Implementation**: reads `@rizqi/intro-seen` on mount; AsyncStorage doesn't
natively emit change events, so the hook exposes a re-read via a bus pattern OR
the single caller just re-mounts as part of navigation. Simplest: one read on
mount, since the flag is only read at app-launch time and during the pitch
screen lifecycle.

---

## 6. `hooks/useIntroLocaleOverride.ts` (NEW)

```ts
/**
 * Observes and updates the device-scoped language override from the pitch.
 *
 * Returns:
 *   - `override` — "en" | "ar" | null (null means "fall back to device locale").
 *   - `setOverride(lang)` — writes the override. Also calls `changeLanguage(lang)`
 *     so the UI updates immediately.
 */
export function useIntroLocaleOverride(): {
  readonly override: "en" | "ar" | null;
  readonly setOverride: (lang: "en" | "ar") => Promise<void>;
  readonly isLoading: boolean;
};
```

---

## 7. `hooks/useOnboardingGuide.ts` (MODIFIED)

### 7.1 Changes

- **Remove `cash_account` step entry** — always-complete after Currency
  confirmation; redundant.
- **Rename `first_transaction` → `voice_transaction`** and change the completion
  query from `Q.where("deleted", Q.notEq(true))` (count > 0) to
  `Q.where("deleted", Q.notEq(true)), Q.where("source", "VOICE")`. i18n key
  updates too.
- **Rename SMS step label** from `onboarding_step_sms_import` to
  `onboarding_step_auto_track_bank_sms`.
- **Add `handleVoiceStepAction()` callback** exported by the hook and consumed
  by the card — on first tap, shows mic tooltip; on subsequent taps, calls
  `openVoiceEntry()` directly.

### 7.2 Output shape (updated)

```ts
interface UseOnboardingGuideResult {
  readonly steps: readonly OnboardingStep[]; // 4 on Android, 3 on iOS (SMS hidden)
  readonly completedCount: number;
  readonly totalSteps: number; // 4 or 3
  readonly isDismissed: boolean;
  readonly isLoading: boolean;
  readonly isAllComplete: boolean;
  readonly dismiss: () => Promise<void>;
  /** NEW: callback for the voice step's action button. */
  readonly onVoiceStepAction: () => void;
  /** NEW: whether the mic tooltip is currently visible, bound to state machine. */
  readonly isMicTooltipVisible: boolean;
  /** NEW: callbacks for the mic tooltip's exits. */
  readonly onMicTooltipTryItNow: () => void;
  readonly onMicTooltipClose: () => void;
}
```

### 7.3 Voice-step action state machine

```text
                   ┌────────────────────────┐
                   │ onVoiceStepAction      │
                   │ (user tapped GO)       │
                   └─────┬──────────────────┘
                         │
                         ├─ flags.voice_tooltip_seen === true ─→ openVoiceEntry()
                         │
                         └─ flags.voice_tooltip_seen !== true ─→ isMicTooltipVisible = true

isMicTooltipVisible === true:
   ┌── onMicTooltipTryItNow ──→ setOnboardingFlag("voice_tooltip_seen", true)
   │                             + openVoiceEntry()
   │                             + isMicTooltipVisible = false
   │
   └── onMicTooltipClose ─────→ setOnboardingFlag("voice_tooltip_seen", true)
                                 + isMicTooltipVisible = false
```

---

## 8. `utils/routing-decision.ts` (**UNCHANGED** — no modifications by this feature)

The existing routing gate from #226 is already correct for this feature.
`preferred_currency` is `currency_type NOT NULL DEFAULT 'EGP'` and cannot be
used as the routing signal (FR-031). The router reads `onboarding_completed`,
which is flipped `true` inside `confirmCurrencyAndOnboard` (§1.1). No edits to
`routing-decision.ts` or `apps/mobile/app/index.tsx` are needed.

### 8.1 Existing signature (for reference)

```ts
export type InitialSyncState = "in-progress" | "success" | "failed" | "timeout";
export type RoutingOutcome = "loading" | "dashboard" | "onboarding" | "retry";

export interface RoutingInputs {
  readonly syncState: InitialSyncState;
  /** From profile.onboardingCompleted — the routing signal (FR-031). */
  readonly onboardingCompleted: boolean;
}

export function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome;
```

### 8.2 Existing decision logic (unchanged)

```ts
export function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome {
  if (inputs.syncState === "in-progress") return "loading";
  if (inputs.onboardingCompleted) return "dashboard";
  if (inputs.syncState !== "success") return "retry";
  return "onboarding";
}
```

### 8.3 Existing caller (unchanged) in `apps/mobile/app/index.tsx`

```ts
const { profile, isLoading: isProfileLoading } = useProfile();
const onboardingCompleted = profile?.onboardingCompleted ?? false;

const outcome = getRoutingDecision({
  syncState: initialSyncState,
  onboardingCompleted,
});
```

### 8.4 Existing test suite (unchanged)

`apps/mobile/__tests__/utils/routing-decision.test.ts` remains valid; no new
test cases required for this feature's routing changes (there are none).

---

## 9. Error handling contracts

Each service surface failures consistently:

| Service                                    | Failure mode            | Caller's expected UI response                                                                                                                                         |
| ------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirmCurrencyAndOnboard`                | Rejects with Error      | Currency step shows a toast with `tCommon("error_generic")`; stays on Currency step; enables retry. NO partial data left behind.                                      |
| `setOnboardingFlag`                        | Rejects with Error      | Tooltip caller logs the failure and proceeds to hide the tooltip anyway (UX-first; flag will be written on next dismiss attempt or on sync). Optionally show a toast. |
| `markIntroSeen` / `setIntroLocaleOverride` | Rejects with Error      | Log warn; proceed. A failure here means the pitch re-appears next launch — annoying but not broken.                                                                   |
| `openVoiceEntry`                           | N/A (void, synchronous) | Voice flow owns its own error UX.                                                                                                                                     |

---

## 10. Backward-compatibility notes

- `setPreferredCurrencyAndCreateCashAccount` — callers (only `onboarding.tsx`'s
  old currency handler) are replaced by `confirmCurrencyAndOnboard`. Remove the
  old function once no callers exist.
- `completeOnboarding` — still used by the soon-to-be-removed
  `WalletCreationStep`. Will have no callers after the restructure lands. Safe
  to leave or remove in a follow-up.
- `onboarding-cursor-service` — callers in the old `onboarding.tsx` are gone.
  The service and its AsyncStorage key can be deleted in a follow-up; leaving in
  place is harmless (no one writes to it, reads return null).
