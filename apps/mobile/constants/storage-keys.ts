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

// =============================================================================
// Sign-Up Prompt Keys & Thresholds
// =============================================================================

/** ISO timestamp when the user first launched the app. */
export const FIRST_USE_DATE_KEY = "@astik/first-use-date";

/** ISO timestamp when the urgency prompt was last dismissed via "Skip". */
export const SIGNUP_PROMPT_DISMISSED_AT_KEY =
  "@astik/signup-prompt-dismissed-at";

/** Transaction count when the urgency prompt was last dismissed via "Skip". */
export const SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY =
  "@astik/signup-prompt-dismissed-tx-count";

/** Set to `"true"` when user taps "Never show this again". */
export const SIGNUP_PROMPT_NEVER_SHOW_KEY = "@astik/signup-prompt-never-show";

/** Minimum transaction count to trigger the urgency prompt. */
export const SIGNUP_TX_THRESHOLD = 50;

/** Minimum days since first use to trigger the urgency prompt. */
export const SIGNUP_DAYS_THRESHOLD = 10;

/** Additional transactions after dismiss before re-triggering. */
export const SIGNUP_COOLDOWN_TX = 50;

/** Additional days after dismiss before re-triggering. */
export const SIGNUP_COOLDOWN_DAYS = 10;
