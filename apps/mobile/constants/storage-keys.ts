/**
 * AsyncStorage key constants.
 *
 * Centralises every key used across the app so that readers/writers
 * are always in sync and typos become compile-time errors.
 *
 * @module storage-keys
 */

/**
 * @deprecated Use `profiles.onboarding_completed` (WatermelonDB) instead.
 * Retained for one release cycle to support pre-release devices that may still
 * write this key. Removal tracked in follow-up GitHub issue.
 */
export const HAS_ONBOARDED_KEY = "hasOnboarded";

/** ISO timestamp when the user first launched the app. */
export const FIRST_USE_DATE_KEY = "@rizqi/first-use-date";

/**
 * @deprecated Use `profiles.preferred_language` (WatermelonDB) instead.
 * Retained for one release cycle to support pre-release devices that may still
 * write this key. Removal tracked in follow-up GitHub issue.
 */
export const LANGUAGE_KEY = "@rizqi/language";

// =============================================================================
// Logout Keys
// =============================================================================

/** Set to `"true"` before logout begins; removed after completion. Used for force-close recovery. */
export const LOGOUT_IN_PROGRESS_KEY = "@rizqi/logout-in-progress";

/**
 * AsyncStorage keys that MUST be cleared on logout.
 * Device-level keys (e.g. `HAS_ONBOARDED_KEY`) are intentionally excluded
 * so the user is not forced through onboarding again on the same device.
 */
export const CLEARABLE_USER_KEYS: readonly string[] = [
  FIRST_USE_DATE_KEY,
  // LANGUAGE_KEY intentionally excluded — language preference persists across accounts
] as const;
