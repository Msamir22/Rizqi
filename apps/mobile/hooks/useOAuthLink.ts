/**
 * useOAuthLink — OAuth Linking Hook
 *
 * Encapsulates the OAuth orchestration logic previously inlined in
 * SocialLoginButtons. Manages loading state, in-flight guards, and
 * delegates to auth-service.ts.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook (Constitution IV — service extraction)
 * - Why: Components should not contain business logic. This hook
 *   handles the entire press → OAuth → result cycle.
 * - SOLID: SRP — hook only manages OAuth link flow state.
 *
 * @module useOAuthLink
 */

import type { OAuthProvider } from "@/services/supabase";
import { useCallback, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface UseOAuthLinkOptions {
  /** Called when OAuth completes successfully. */
  readonly onSuccess: () => void;
  /** Called when OAuth fails. Receives a user-friendly error message. */
  readonly onError: (errorMessage: string) => void;
}

interface UseOAuthLinkResult {
  /** Initiate an OAuth link for the given provider. */
  readonly handleOAuthPress: (provider: OAuthProvider) => Promise<void>;
  /** Which provider is currently loading (null if none). */
  readonly loadingProvider: OAuthProvider | null;
  /** Whether any OAuth flow is in progress. */
  readonly isAnyLoading: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useOAuthLink({
  onSuccess,
  onError,
}: UseOAuthLinkOptions): UseOAuthLinkResult {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null
  );

  // Synchronous ref guard to prevent double-tap race conditions.
  // The state `loadingProvider` drives UI (spinner), but state updates are
  // batched/async and can miss rapid successive taps.
  const isInFlightRef = useRef(false);

  const handleOAuthPress = useCallback(
    async (provider: OAuthProvider): Promise<void> => {
      if (isInFlightRef.current) return;
      isInFlightRef.current = true;

      setLoadingProvider(provider);
      try {
        // Lazy-import to keep the consumer's bundle footprint minimal
        const { initiateOAuthLink } = await import("@/services/auth-service");
        const result = await initiateOAuthLink(provider);

        if (result.success) {
          onSuccess();
        } else {
          onError(result.error);
        }
      } catch {
        onError("Something went wrong. Please try again.");
      } finally {
        setLoadingProvider(null);
        isInFlightRef.current = false;
      }
    },
    [onSuccess, onError]
  );

  return {
    handleOAuthPress,
    loadingProvider,
    isAnyLoading: loadingProvider !== null,
  };
}
