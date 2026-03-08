/**
 * Auth-related constants.
 *
 * Separated from storage-keys.ts because AUTH_REDIRECT_URL is not a
 * storage key — it is an OAuth deep link scheme. Keeping auth plumbing
 * constants in their own module avoids conceptual coupling.
 *
 * @module auth-constants
 */

/** Deep link scheme used as the OAuth redirect target. */
export const AUTH_REDIRECT_URL = "astik://auth-callback";
