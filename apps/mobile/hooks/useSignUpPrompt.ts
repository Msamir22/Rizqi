/**
 * useSignUpPrompt — Urgency Prompt Visibility Hook
 *
 * Thin React wrapper around signup-prompt-service.ts.
 * Manages component state and delegates all persistence/query logic
 * to the service layer.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook + Service Layer (Constitution IV)
 * - Why: React state management is the hook's only concern.
 *   All AsyncStorage reads, WatermelonDB queries, and threshold
 *   calculations live in signup-prompt-service.ts.
 * - SOLID: SRP + DIP — hook depends on service abstraction,
 *   not concrete storage/DB implementations.
 *
 * @module useSignUpPrompt
 */

import { useAuth } from "@/context/AuthContext";
import {
  checkShouldShowPrompt,
  saveCooldownDismissal,
  savePermanentDismissal,
  type UserStats,
} from "@/services/signup-prompt-service";
import { useCallback, useEffect, useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface SignUpPromptState {
  /** Whether the urgency prompt should be shown right now. */
  readonly shouldShowPrompt: boolean;
  /** User stats for display in the urgency sheet. */
  readonly stats: UserStatsWithLoading;
  /** Dismiss with cooldown ("Skip for now"). */
  readonly dismissWithCooldown: () => Promise<void>;
  /** Dismiss permanently ("Never show this again"). */
  readonly dismissPermanently: () => Promise<void>;
}

interface UserStatsWithLoading extends UserStats {
  readonly isLoading: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useSignUpPrompt(): SignUpPromptState {
  const { isAnonymous } = useAuth();
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [stats, setStats] = useState<UserStatsWithLoading>({
    transactionCount: 0,
    accountCount: 0,
    totalAmount: 0,
    isLoading: true,
  });

  useEffect(() => {
    // Abort guard: prevents stale async results from overwriting
    // state when isAnonymous changes while checkShouldShowPrompt()
    // is still resolving.
    let isActive = true;

    if (!isAnonymous) {
      setShouldShowPrompt(false);
      setStats((prev) => ({ ...prev, isLoading: false }));
      return () => {
        isActive = false;
      };
    }

    // Set loading before async call
    setStats((prev) => ({ ...prev, isLoading: true }));

    checkShouldShowPrompt()
      .then((result) => {
        if (!isActive) return;
        setShouldShowPrompt(result.shouldShow);
        setStats({ ...result.stats, isLoading: false });
      })
      .catch(() => {
        if (!isActive) return;
        setShouldShowPrompt(false);
        setStats((prev) => ({ ...prev, isLoading: false }));
      });

    return () => {
      isActive = false;
    };
  }, [isAnonymous]);

  // ---------------------------------------------------------------------------
  // Dismiss handlers
  // ---------------------------------------------------------------------------

  const dismissWithCooldown = useCallback(async (): Promise<void> => {
    setShouldShowPrompt(false);
    await saveCooldownDismissal(stats.transactionCount);
  }, [stats.transactionCount]);

  const dismissPermanently = useCallback(async (): Promise<void> => {
    setShouldShowPrompt(false);
    await savePermanentDismissal();
  }, []);

  return {
    shouldShowPrompt,
    stats,
    dismissWithCooldown,
    dismissPermanently,
  };
}
