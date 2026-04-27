/**
 * Onboarding Cursor Service
 *
 * @deprecated Feature 026 replaced the multi-step onboarding wizard with a
 *   single Currency step that atomically writes currency + language +
 *   onboarding_completed. This service is retained only for defensive cursor
 *   cleanup inside `confirmCurrencyAndOnboard`. No new callers should be added.
 *   See specs/026-onboarding-restructure/.
 *
 * AsyncStorage wrapper for the per-user onboarding-step cursor used by the
 * onboarding screen to resume at the right step after an interrupted session.
 *
 * The cursor is LOCAL-ONLY — it never syncs to Supabase. Partial progress
 * does not survive reinstall or cross devices. This is the accepted
 * trade-off in the simplified design (see spec FR-008, data-model.md § 3).
 *
 * Key format: `onboarding:<userId>:step`
 * Values: one of "language" | "slides" | "currency" | "cash-account", or
 * absent (= start at "language").
 *
 * Architecture: Service Layer (Constitution IV) — plain async functions,
 * no React, no hooks.
 *
 * @module onboarding-cursor-service
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// =============================================================================
// Types
// =============================================================================

/**
 * The valid cursor values. Each corresponds to the next-unfinished
 * onboarding step.
 */
export type OnboardingStep =
  | "language"
  | "slides"
  | "currency"
  | "cash-account";

const VALID_STEPS: ReadonlySet<OnboardingStep> = new Set<OnboardingStep>([
  "language",
  "slides",
  "currency",
  "cash-account",
]);

// =============================================================================
// Helpers
// =============================================================================

/** Build the AsyncStorage key for a given user. */
function keyFor(userId: string): string {
  return `onboarding:${userId}:step`;
}

/** Narrow an arbitrary string to `OnboardingStep | null`. */
function parseStep(value: string | null): OnboardingStep | null {
  if (value === null) return null;
  return VALID_STEPS.has(value as OnboardingStep)
    ? (value as OnboardingStep)
    : null;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Read the cursor for a given user.
 *
 * Returns `null` if the cursor is absent or its stored value is not one of
 * the four valid steps. Callers MUST treat `null` as "start at language"
 * per FR-004.
 */
export async function readOnboardingStep(
  userId: string
): Promise<OnboardingStep | null> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return parseStep(raw);
}

/**
 * Persist the next-unfinished step for a given user. Called on every
 * forward transition between onboarding phases (FR-008).
 */
export async function writeOnboardingStep(
  userId: string,
  step: OnboardingStep
): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), step);
}

/**
 * Remove the cursor. Called from `completeOnboarding` as part of the
 * end-of-flow clear (FR-011). Idempotent: removing an absent key is a no-op.
 */
export async function clearOnboardingStep(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
}
