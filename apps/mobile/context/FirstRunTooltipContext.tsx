/**
 * First-Run Tooltip Context
 *
 * In-memory boolean trigger for the cash-account first-run tooltip (FR-020).
 * The tooltip should only appear in the session that immediately follows a
 * successful Currency-step confirmation during onboarding.
 *
 * Architecture & Design Rationale:
 * - Pattern: Provider Pattern (React Context)
 * - Why: Lightweight per-session flag — no persistence needed. If the user
 *   force-quits between pending and consumed, the tooltip is lost, which is
 *   acceptable per spec.
 * - SOLID: SRP — context only manages a single boolean lifecycle.
 *
 * @module FirstRunTooltipContext
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirstRunTooltipContextValue {
  /** Whether the first-run tooltip should be shown (pending consumption) */
  readonly isFirstRunPending: boolean;
  /** Mark the tooltip as pending — called after Currency-step confirmation */
  readonly markFirstRunPending: () => void;
  /** Mark the tooltip as consumed — called after the tooltip is displayed */
  readonly markFirstRunConsumed: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FirstRunTooltipContext =
  createContext<FirstRunTooltipContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface FirstRunTooltipProviderProps {
  readonly children: React.ReactNode;
}

export function FirstRunTooltipProvider({
  children,
}: FirstRunTooltipProviderProps): React.JSX.Element {
  const [isFirstRunPending, setIsFirstRunPending] = useState<boolean>(false);
  const { isAuthenticated } = useAuth();

  // Reset the pending flag whenever the user signs out. Without this,
  // if a user confirms currency (which sets `isFirstRunPending = true`)
  // and then signs out before the tooltip renders, the flag carries
  // over into whoever signs in NEXT — they'd see a "we set this up for
  // you" tooltip on a cash account that wasn't theirs (round-1 review
  // M4). The provider lives above the auth boundary, so we just listen
  // to `isAuthenticated` flipping false and clear the flag.
  useEffect(() => {
    if (!isAuthenticated) {
      setIsFirstRunPending(false);
    }
  }, [isAuthenticated]);

  const markFirstRunPending = useCallback((): void => {
    setIsFirstRunPending(true);
  }, []);

  const markFirstRunConsumed = useCallback((): void => {
    setIsFirstRunPending(false);
  }, []);

  const value = useMemo<FirstRunTooltipContextValue>(
    () => ({
      isFirstRunPending,
      markFirstRunPending,
      markFirstRunConsumed,
    }),
    [isFirstRunPending, markFirstRunPending, markFirstRunConsumed]
  );

  return (
    <FirstRunTooltipContext.Provider value={value}>
      {children}
    </FirstRunTooltipContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the first-run tooltip context. Must be used inside FirstRunTooltipProvider.
 */
export function useFirstRunTooltip(): FirstRunTooltipContextValue {
  const ctx = useContext(FirstRunTooltipContext);
  if (!ctx) {
    throw new Error(
      "useFirstRunTooltip must be used within a FirstRunTooltipProvider"
    );
  }
  return ctx;
}
