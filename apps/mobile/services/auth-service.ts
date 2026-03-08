/**
 * Auth Service — OAuth Flow Orchestration
 *
 * Single-responsibility service that handles the browser-based OAuth flow
 * for converting anonymous users to provider-linked accounts.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service-Layer Separation (Constitution IV)
 * - Why: OAuth orchestration involves browser interaction, network calls,
 *   and error handling — none of which belongs in components or hooks.
 * - SOLID: SRP — this service only handles OAuth identity linking flows.
 *
 * @module auth-service
 */

import * as WebBrowser from "expo-web-browser";
import { WebBrowserResultType } from "expo-web-browser";

import {
  linkIdentityWithProvider,
  supabase,
  type OAuthProvider,
} from "@/services/supabase";
import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { AUTH_REDIRECT_URL } from "@/constants/auth-constants";

// Ensure the browser auth session can complete on warm start
WebBrowser.maybeCompleteAuthSession();

// =============================================================================
// Types
// =============================================================================

interface OAuthSuccessResult {
  readonly success: true;
}

interface OAuthErrorResult {
  readonly success: false;
  readonly error: string;
}

type OAuthResult = OAuthSuccessResult | OAuthErrorResult;

/**
 * Sentinel type to distinguish OAuth timeout from user-initiated
 * browser cancellation.
 */
interface TimeoutSentinel {
  readonly type: "TIMEOUT";
}

type BrowserOrTimeout = WebBrowser.WebBrowserResult | TimeoutSentinel;

// =============================================================================
// Constants
// =============================================================================

const OAUTH_TIMEOUT_MS = 30_000;

const UNEXPECTED_RESPONSE_ERROR =
  "Unexpected response from server. Please try again.";

// =============================================================================
// Response Validators
// =============================================================================

/**
 * Validates the response from `linkIdentityWithProvider()`.
 * Ensures the result is an object with either { url: string } or { error }.
 *
 * Architecture & Design Rationale:
 * - Pattern: Fail-Fast Validation at Service Boundary
 * - Why: External SDK responses can change between versions. Validating
 *   the shape at the boundary prevents silent data corruption downstream.
 * - SOLID: SRP — validation is isolated from orchestration logic.
 */
function validateLinkIdentityResult(
  result: unknown
): { valid: true; data: { url: string } | { error: unknown } } | { valid: false; message: string } {
  if (result === null || result === undefined || typeof result !== "object") {
    return { valid: false, message: UNEXPECTED_RESPONSE_ERROR };
  }

  const record = result as Record<string, unknown>;

  // Error path: { error: ... }
  if ("error" in record && record.error !== null && record.error !== undefined) {
    return { valid: true, data: { error: record.error } };
  }

  // Success path: { url: string }
  if ("url" in record && typeof record.url === "string" && record.url.length > 0) {
    return { valid: true, data: { url: record.url } };
  }

  return { valid: false, message: UNEXPECTED_RESPONSE_ERROR };
}

/**
 * Validates the response from `supabase.auth.getUser()`.
 * Ensures the user object has the expected shape with identities array
 * and is_anonymous flag.
 */
function validateGetUserData(
  userData: unknown
): { valid: true; user: { identities: ReadonlyArray<{ id: string }>; is_anonymous: boolean } } | { valid: false; message: string } {
  if (userData === null || userData === undefined || typeof userData !== "object") {
    return { valid: false, message: UNEXPECTED_RESPONSE_ERROR };
  }

  const data = userData as Record<string, unknown>;
  const user = data.user;

  if (user === null || user === undefined || typeof user !== "object") {
    return { valid: false, message: UNEXPECTED_RESPONSE_ERROR };
  }

  const userRecord = user as Record<string, unknown>;

  // identities must be an array
  if (!Array.isArray(userRecord.identities)) {
    return { valid: false, message: UNEXPECTED_RESPONSE_ERROR };
  }

  // is_anonymous must be a boolean
  if (typeof userRecord.is_anonymous !== "boolean") {
    return { valid: false, message: UNEXPECTED_RESPONSE_ERROR };
  }

  return {
    valid: true,
    user: {
      identities: userRecord.identities as ReadonlyArray<{ id: string }>,
      is_anonymous: userRecord.is_anonymous,
    },
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Initiate the full OAuth identity-linking flow for a given provider.
 *
 * 1. Calls `linkIdentityWithProvider()` to get the OAuth URL from Supabase
 * 2. Opens the URL in the system browser via `expo-web-browser`
 * 3. Waits for the redirect back to the app via `AUTH_REDIRECT_URL`
 *
 * On success, Supabase's `onAuthStateChange` fires automatically in
 * `AuthContext`, updating `isAnonymous` to `false`.
 *
 * @param provider - The OAuth provider to link
 * @returns Result indicating success or failure with error message
 */
export async function initiateOAuthLink(
  provider: OAuthProvider
): Promise<OAuthResult> {
  try {
    const rawResult = await linkIdentityWithProvider(provider);

    // Validate linkIdentity response shape
    const linkValidation = validateLinkIdentityResult(rawResult);
    if (!linkValidation.valid) {
      return { success: false, error: linkValidation.message };
    }

    const result = linkValidation.data;

    if ("error" in result) {
      // TODO: Replace with structured logging (e.g., Sentry)
      return {
        success: false,
        error: getHumanReadableError(result.error),
      };
    }

    // Open the OAuth URL in the system browser with timeout.
    // The second argument tells openAuthSessionAsync to intercept the
    // redirect to AUTH_REDIRECT_URL and close the browser automatically.
    const browserResult: BrowserOrTimeout = await Promise.race([
      WebBrowser.openAuthSessionAsync(result.url, AUTH_REDIRECT_URL),
      createTimeout(OAUTH_TIMEOUT_MS),
    ]);

    // Check for timeout sentinel first (distinct from user cancellation)
    if (isTimeoutSentinel(browserResult)) {
      return {
        success: false,
        error: "Sign-in took too long. Please try again.",
      };
    }

    if (
      browserResult.type === WebBrowserResultType.CANCEL ||
      browserResult.type === WebBrowserResultType.DISMISS
    ) {
      return { success: false, error: "Sign-in was cancelled." };
    }

    // After linkIdentity completes server-side, the local session JWT still
    // has is_anonymous=true. Force a session refresh so onAuthStateChange
    // fires with the updated user profile (is_anonymous=false).
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      // TODO: Replace with structured logging (e.g., Sentry)
      return { success: false, error: getHumanReadableError(refreshError) };
    }

    // Verify the identity was actually linked. Supabase returns a 302 redirect
    // even when linkIdentity fails with 422 (e.g. "Identity is already linked
    // to another user"), so the browser reports success. We must check the
    // user's identities to confirm the link actually happened.
    const { data: rawUserData, error: getUserError } =
      await supabase.auth.getUser();
    if (getUserError) {
      // TODO: Replace with structured logging (e.g., Sentry)
      return { success: false, error: getHumanReadableError(getUserError) };
    }

    // Validate getUser response shape
    const userValidation = validateGetUserData(rawUserData);
    if (!userValidation.valid) {
      return { success: false, error: userValidation.message };
    }

    const { user } = userValidation;
    if (user.identities.length === 0 || user.is_anonymous) {
      return {
        success: false,
        error:
          "This account is already linked to another user. Please try a different account.",
      };
    }

    return { success: true };
  } catch (error: unknown) {
    // TODO: Replace with structured logging (e.g., Sentry)
    return { success: false, error: getHumanReadableError(error) };
  }
}

// =============================================================================
// Private Helpers
// =============================================================================

/**
 * Create a timeout promise that resolves with a dedicated sentinel
 * to distinguish OAuth timeouts from user-initiated cancellations.
 */
function createTimeout(ms: number): Promise<TimeoutSentinel> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ type: "TIMEOUT" });
    }, ms);
  });
}

/**
 * Type guard for the timeout sentinel.
 */
function isTimeoutSentinel(
  result: BrowserOrTimeout
): result is TimeoutSentinel {
  return "type" in result && result.type === "TIMEOUT";
}

/**
 * Translate Supabase errors into user-friendly text.
 *
 * Uses `AuthError.code` for API errors (stable across SDK versions)
 * and `isAuthRetryableFetchError` for network-level failures.
 *
 * Architecture & Design Rationale:
 * - Pattern: Strategy (code-based dispatch replaces fragile string matching)
 * - SOLID: Open/Closed — add new `case` branches without modifying existing logic
 */
function getHumanReadableError(error: unknown): string {
  // Network-level failures (no response from server)
  if (isAuthRetryableFetchError(error)) {
    return "No internet connection. Please check your network and try again.";
  }

  // API-level errors with structured error codes
  if (isAuthError(error) && error.code) {
    switch (error.code) {
      case "identity_already_exists":
        return "This account is already linked to another user. Please use a different account.";
      case "request_timeout":
      case "hook_timeout":
      case "hook_timeout_after_retry":
        return "Sign-in took too long. Please try again.";
      default:
        return "Something went wrong during sign-in. Please try again.";
    }
  }

  return "Something went wrong during sign-in. Please try again.";
}

export type { OAuthProvider, OAuthResult };
