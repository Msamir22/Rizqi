/**
 * AsyncStorage key constants.
 *
 * Centralises every key used across the app so that readers/writers
 * are always in sync and typos become compile-time errors.
 *
 * @module storage-keys
 */

/** ISO timestamp when the user first launched the app. */
export const FIRST_USE_DATE_KEY = "@rizqi/first-use-date";

/**
 * Per-user onboarding-step cursor (feature 024).
 *
 * Full key format is `onboarding:<userId>:step` — this constant is only the
 * namespace prefix. Read/write goes through `services/onboarding-cursor-service.ts`
 * which handles the userId interpolation. Kept here only for discoverability
 * — there should be no direct AsyncStorage callers outside the cursor service.
 */
export const ONBOARDING_CURSOR_PREFIX = "onboarding";

// =============================================================================
// Logout Keys
// =============================================================================

/** Set to `"true"` before logout begins; removed after completion. Used for force-close recovery. */
export const LOGOUT_IN_PROGRESS_KEY = "@rizqi/logout-in-progress";

/**
 * AsyncStorage keys that MUST be cleared on logout.
 * Device-level keys are intentionally excluded so the user is not forced
 * through onboarding again on the same device.
 */
export const CLEARABLE_USER_KEYS: readonly string[] = [
  FIRST_USE_DATE_KEY,
  // Onboarding cursor is per-user; it persists across sign-out so a returning
  // user resumes at the right step (FR-011 / clarifications 2026-04-18).
] as const;
