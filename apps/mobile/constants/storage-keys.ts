/**
 * AsyncStorage key constants.
 *
 * Centralises every key used across the app so that readers/writers
 * are always in sync and typos become compile-time errors.
 *
 * @module storage-keys
 */

/** Set to `"true"` after the user completes onboarding. */
export const HAS_ONBOARDED_KEY = "hasOnboarded";

/** ISO timestamp when the user first launched the app. */
export const FIRST_USE_DATE_KEY = "@astik/first-use-date";

/** User's preferred language: "en" or "ar". */
export const LANGUAGE_KEY = "@astik/language";

// =============================================================================
// Logout Keys
// =============================================================================

/** Set to `"true"` before logout begins; removed after completion. Used for force-close recovery. */
export const LOGOUT_IN_PROGRESS_KEY = "@astik/logout-in-progress";

/**
 * AsyncStorage keys that MUST be cleared on logout.
 * Device-level keys (e.g. `HAS_ONBOARDED_KEY`) are intentionally excluded
 * so the user is not forced through onboarding again on the same device.
 */
export const CLEARABLE_USER_KEYS: readonly string[] = [
  FIRST_USE_DATE_KEY,
  // LANGUAGE_KEY intentionally excluded — language preference persists across accounts
] as const;
