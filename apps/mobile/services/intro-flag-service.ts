/**
 * Intro Flag Service
 *
 * AsyncStorage wrapper for device-scoped pre-auth flags that control the
 * intro / pitch experience and locale override.
 *
 * These flags are NOT user-specific and are NOT cleared on logout. They
 * survive sign-up / sign-out cycles because they represent device-level
 * preferences (FR-030).
 *
 * Architecture: Service Layer (Constitution IV) — plain async functions,
 * no React, no hooks.
 *
 * Error policy: every read returns a safe default (`false` / `null`) when
 * AsyncStorage rejects, every write logs + swallows. Callers that need to
 * surface a write failure can wrap in their own try/catch; the defaults
 * here exist so the pitch / language-switcher code paths never latch
 * `isLoading=true` forever on a transient storage hiccup.
 *
 * @module intro-flag-service
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  INTRO_LOCALE_OVERRIDE_KEY,
  INTRO_SEEN_KEY,
  PENDING_SIGNUP_LOCALE_KEY,
} from "@/constants/storage-keys";
import { logger } from "@/utils/logger";

// =============================================================================
// Types
// =============================================================================

/** Valid locale override values stored in AsyncStorage. */
export type IntroLocale = "en" | "ar";

export interface PendingSignupLocale {
  readonly email: string;
  readonly language: IntroLocale;
  readonly createdAt: string;
}

const VALID_LOCALES: ReadonlySet<IntroLocale> = new Set<IntroLocale>([
  "en",
  "ar",
]);

// =============================================================================
// Internal helpers
// =============================================================================

/** Convert the `unknown` caught value into a logger-ready payload. */
function errorPayload(error: unknown): Record<string, unknown> {
  return error instanceof Error ? { message: error.message } : { error };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePendingSignupLocale(raw: string): PendingSignupLocale | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const email = parsed.email;
    const language = parsed.language;
    const createdAt = parsed.createdAt;

    if (
      typeof email !== "string" ||
      !VALID_LOCALES.has(language as IntroLocale) ||
      typeof createdAt !== "string"
    ) {
      return null;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || Number.isNaN(Date.parse(createdAt))) {
      return null;
    }

    return {
      email: normalizedEmail,
      language: language as IntroLocale,
      createdAt,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Read the intro-seen flag.
 *
 * Returns `true` only when the stored value is exactly `"true"`.
 * Returns `false` for absent keys, unexpected values, or storage errors.
 */
export async function readIntroSeen(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(INTRO_SEEN_KEY);
    return value === "true";
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to read intro-seen flag",
      errorPayload(error)
    );
    return false;
  }
}

/**
 * Persist the intro-seen flag. Idempotent — writing `"true"` when already
 * present is a no-op at the storage layer. Best-effort: a write failure is
 * logged but not rethrown, so the pitch-completion code path is never
 * blocked by a transient storage error.
 */
export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, "true");
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to write intro-seen flag",
      errorPayload(error)
    );
  }
}

/**
 * Read the locale override chosen on a pre-auth surface.
 *
 * Returns the stored locale if it is a valid `"en"` | `"ar"` value, or
 * `null` when absent / invalid / on storage error. Callers treat `null`
 * as "use system locale".
 */
export async function readIntroLocaleOverride(): Promise<IntroLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(INTRO_LOCALE_OVERRIDE_KEY);
    if (raw === null) return null;
    return VALID_LOCALES.has(raw as IntroLocale) ? (raw as IntroLocale) : null;
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to read intro-locale-override",
      errorPayload(error)
    );
    return null;
  }
}

/**
 * Persist the locale override. Device-scoped — survives logout (FR-030).
 * There is intentionally no `clearIntroLocaleOverride` export; the override
 * persists forever. Best-effort: a write failure is logged but not
 * rethrown, so the language-switch UI interaction is never blocked.
 */
export async function setIntroLocaleOverride(lang: IntroLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_LOCALE_OVERRIDE_KEY, lang);
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to write intro-locale-override",
      errorPayload(error)
    );
  }
}

/**
 * Read the pending signup language marker.
 *
 * This is intentionally separate from the intro locale override. The override
 * affects pre-auth UI; this marker is written only after a signup request and
 * is the only value allowed to promote a pre-auth language into a new profile.
 */
export async function readPendingSignupLocale(): Promise<PendingSignupLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SIGNUP_LOCALE_KEY);
    return raw === null ? null : parsePendingSignupLocale(raw);
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to read pending-signup-locale",
      errorPayload(error)
    );
    return null;
  }
}

/**
 * Persist the one-shot language marker after a successful signup request.
 */
export async function setPendingSignupLocale(
  email: string,
  language: IntroLocale
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  try {
    await AsyncStorage.setItem(
      PENDING_SIGNUP_LOCALE_KEY,
      JSON.stringify({
        email: normalizedEmail,
        language,
        createdAt: new Date().toISOString(),
      } satisfies PendingSignupLocale)
    );
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to write pending-signup-locale",
      errorPayload(error)
    );
  }
}

/**
 * Clear the pending signup language marker after the matching authenticated
 * profile has either consumed it or proven it does not belong to a new profile.
 */
export async function clearPendingSignupLocale(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_SIGNUP_LOCALE_KEY);
  } catch (error: unknown) {
    logger.warn(
      "[intro-flag] Failed to clear pending-signup-locale",
      errorPayload(error)
    );
  }
}
