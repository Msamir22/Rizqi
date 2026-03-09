/**
 * useOAuthFlow — Simplified OAuth Sign-In Hook
 *
 * Encapsulates the OAuth sign-in flow:
 * 1. Call `signInWithOAuth` to open the browser-based OAuth flow
 * 2. Handle success/error/cancellation results
 *
 * No identity linking or conflict detection — all users go through
 * signInWithOAuth directly.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook — centralizes orchestration logic (SRP)
 * - Why: Keeps SocialLoginButtons purely presentational. All sequencing
 *   and error handling lives here.
 * - SOLID: DIP — depends on service functions, not UI implementation
 *
 * @module useOAuthFlow
 */

import { useState, useCallback } from "react";

import { signInWithOAuth } from "@/services/auth-service";
import type { OAuthProvider } from "@/services/supabase";

// =============================================================================
// Types
// =============================================================================

interface OAuthFlowState {
  /** The provider currently loading, or null if idle. */
  readonly loadingProvider: OAuthProvider | null;
  /** User-facing error message from the last attempt. */
  readonly error: string | null;
  /** Initiate the OAuth flow for a given provider. */
  readonly handleOAuth: (provider: OAuthProvider) => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useOAuthFlow(
  onSuccess: () => void,
  onError: (errorMessage: string) => void
): OAuthFlowState {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = useCallback(
    async (provider: OAuthProvider): Promise<void> => {
      if (loadingProvider) return; // Prevent double-tap

      setLoadingProvider(provider);
      setError(null);

      try {
        const result = await signInWithOAuth(provider);

        if (result.success) {
          onSuccess();
          return;
        }

        // Cancellation — silent, don't show error
        if (result.errorCode === "cancelled") {
          return;
        }

        // All other errors — surface to the user
        setError(result.error);
        onError(result.error);
      } catch {
        const message = "Something went wrong. Please try again.";
        setError(message);
        onError(message);
      } finally {
        setLoadingProvider(null);
      }
    },
    [loadingProvider, onSuccess, onError]
  );

  return {
    loadingProvider,
    error,
    handleOAuth,
  };
}
