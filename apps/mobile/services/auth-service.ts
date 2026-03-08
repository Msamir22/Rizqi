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

// =============================================================================
// Constants
// =============================================================================

const OAUTH_TIMEOUT_MS = 30_000;

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
    const result = await linkIdentityWithProvider(provider);

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
    // TODO: Use a dedicated timeout sentinel instead of DISMISS to
    // distinguish user-initiated cancellation from timeouts.
    const browserResult = await Promise.race([
      WebBrowser.openAuthSessionAsync(result.url, AUTH_REDIRECT_URL),
      createTimeout(OAUTH_TIMEOUT_MS),
    ]);

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
    const { data: userData, error: getUserError } =
      await supabase.auth.getUser();
    if (getUserError) {
      // TODO: Replace with structured logging (e.g., Sentry)
      return { success: false, error: getHumanReadableError(getUserError) };
    }

    const identities = userData.user?.identities ?? [];
    if (identities.length === 0 || userData.user?.is_anonymous) {
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
 * Create a timeout promise that resolves with a dismiss-type result
 * to enforce the 30-second OAuth completion limit (SC-005).
 */
function createTimeout(ms: number): Promise<WebBrowser.WebBrowserResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ type: WebBrowserResultType.DISMISS });
    }, ms);
  });
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
