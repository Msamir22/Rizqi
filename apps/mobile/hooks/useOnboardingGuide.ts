/**
 * useOnboardingGuide Hook
 *
 * Tracks granular onboarding progress for the dashboard setup guide card.
 * Reactively observes WatermelonDB to determine which onboarding steps
 * the user has completed, and whether the guide has been dismissed.
 *
 * Steps (Android — 4 steps):
 * 1. Bank account added
 * 2. Voice transaction recorded (source = "VOICE")
 * 3. Auto-track bank SMS (any transaction with sms_body_hash)
 * 4. Spending budget set
 *
 * iOS omits the SMS step (3 steps total).
 *
 * The mic-tooltip state machine lives in `@/context/MicTooltipContext` so
 * the overlay can render at the dashboard root (full-screen positioning).
 * This hook re-exports the context values so callers see a single API.
 *
 * @module useOnboardingGuide
 */

import { logger } from "@/utils/logger";
import { Account, Budget, Profile, Transaction, database } from "@monyvi/db";
import { Q } from "@nozbe/watermelondb";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { useMicTooltip } from "@/context/MicTooltipContext";
import { setSetupGuideCompleted as persistSetupGuideCompleted } from "@/services/profile-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  readonly key: string;
  readonly labelKey: string;
  readonly isComplete: boolean;
  readonly route?: string;
  readonly isNew?: boolean;
}

interface UseOnboardingGuideResult {
  readonly steps: readonly OnboardingStep[];
  readonly completedCount: number;
  readonly totalSteps: number;
  readonly isDismissed: boolean;
  readonly isLoading: boolean;
  readonly isAllComplete: boolean;
  readonly dismiss: () => Promise<void>;
  /** Tap the voice step's action button. Manages tooltip vs direct open. */
  readonly onVoiceStepAction: () => void;
  /** Whether the mic tooltip is currently visible. */
  readonly isMicTooltipVisible: boolean;
  /** "Try it now" on mic tooltip — dismisses + opens voice. */
  readonly onMicTooltipTryItNow: () => void;
  /** X / hardware back on mic tooltip — dismisses only. */
  readonly onMicTooltipClose: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnboardingGuide(): UseOnboardingGuideResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [setupGuideCompleted, setSetupGuideCompleted] = useState<
    boolean | null
  >(null);
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [hasVoiceTransaction, setHasVoiceTransaction] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [hasSmsImported, setHasSmsImported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [smsLoaded, setSmsLoaded] = useState(Platform.OS !== "android");

  // Mic tooltip state lives in `MicTooltipContext` (mounted at
  // `(tabs)/_layout.tsx`) so the tooltip overlay can render at the
  // dashboard root and not get clipped by `OnboardingGuideCard`'s
  // `overflow-hidden`. We re-export the context values from this hook to
  // keep `OnboardingGuideCard`'s API surface stable.
  const {
    isVisible: isMicTooltipVisible,
    onVoiceStepAction,
    onTryItNow: onMicTooltipTryItNow,
    onDismiss: onMicTooltipClose,
  } = useMicTooltip();

  useEffect(() => {
    if (
      profileLoaded &&
      bankLoaded &&
      voiceLoaded &&
      budgetLoaded &&
      smsLoaded
    ) {
      setIsLoading(false);
    }
  }, [profileLoaded, bankLoaded, voiceLoaded, budgetLoaded, smsLoaded]);

  // ── Observe profile for setupGuideCompleted ──
  useEffect(() => {
    const subscription = database
      .get<Profile>("profiles")
      .query(Q.where("deleted", false), Q.take(1))
      .observeWithColumns(["setup_guide_completed"])
      .subscribe({
        next: (profiles) => {
          const nextProfile = profiles[0] ?? null;
          setProfile(nextProfile);
          setSetupGuideCompleted(nextProfile?.setupGuideCompleted ?? null);
          setProfileLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe profile for setup guide", error);
          setProfileLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // Default to `true` (dismissed) while the profile observer is still
  // settling — `setupGuideCompleted` is `null` until the first
  // observable emission. Defaulting to dismissed here means the
  // OnboardingGuideCard stays hidden during the first render after
  // mount instead of flashing in and then collapsing once the real
  // value arrives. Becomes accurate after the observer's first emit.
  const isDismissed = setupGuideCompleted ?? true;

  // ── Observe bank accounts ──
  useEffect(() => {
    const subscription = database
      .get<Account>("accounts")
      .query(Q.where("deleted", false), Q.where("type", "BANK"))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasBankAccount(count > 0);
          setBankLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe bank accounts", error);
          setBankLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe voice transactions (source = "VOICE") ──
  useEffect(() => {
    const subscription = database
      .get<Transaction>("transactions")
      .query(Q.where("deleted", Q.notEq(true)), Q.where("source", "VOICE"))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasVoiceTransaction(count > 0);
          setVoiceLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe voice transactions", error);
          setVoiceLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe active budgets ──
  useEffect(() => {
    const subscription = database
      .get<Budget>("budgets")
      .query(Q.where("deleted", false), Q.where("status", "ACTIVE"))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasBudget(count > 0);
          setBudgetLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe budgets", error);
          setBudgetLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe SMS-imported transactions (Android only) ──
  useEffect(() => {
    if (Platform.OS !== "android") {
      setHasSmsImported(false);
      return;
    }

    const subscription = database
      .get<Transaction>("transactions")
      .query(Q.where("deleted", false), Q.where("sms_body_hash", Q.notEq(null)))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasSmsImported(count > 0);
          setSmsLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe SMS-imported transactions", error);
          setSmsLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Build steps array (no cash_account — always complete) ──
  const steps: readonly OnboardingStep[] = useMemo(() => {
    const base: OnboardingStep[] = [
      {
        key: "bank_account",
        labelKey: "onboarding_step_bank_account",
        isComplete: hasBankAccount,
        // Deep-link to add-account with `type=BANK` pre-selected so the
        // user lands on the correct radio option (user-reported 2026-04-26:
        // tapping "Add bank account" landed on the form with CASH selected,
        // forcing an extra tap).
        route: "/add-account?type=BANK",
      },
      {
        key: "voice_transaction",
        labelKey: "onboarding_step_voice_transaction",
        isComplete: hasVoiceTransaction,
        isNew: true,
      },
    ];

    if (Platform.OS === "android") {
      base.push({
        key: "auto_track_bank_sms",
        labelKey: "onboarding_step_auto_track_bank_sms",
        isComplete: hasSmsImported,
        route: "/sms-scan",
      });
    }

    base.push({
      key: "spending_budget",
      labelKey: "onboarding_step_spending_budget",
      isComplete: hasBudget,
      route: "/create-budget",
    });

    return base;
  }, [hasBankAccount, hasVoiceTransaction, hasSmsImported, hasBudget]);

  const completedCount = useMemo(
    () => steps.filter((s) => s.isComplete).length,
    [steps]
  );

  const isAllComplete = completedCount === steps.length;

  // Auto-dismiss when all steps complete. Delegates to the service layer so
  // no `database.write()` lives inside a hook (Constitution IV / CLAUDE.md).
  useEffect(() => {
    if (!isAllComplete || !profile || profile.setupGuideCompleted) return;

    const run = async (): Promise<void> => {
      try {
        await persistSetupGuideCompleted(true);
      } catch (error: unknown) {
        logger.warn(
          "onboarding.autoDismiss.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
      }
    };
    void run();
  }, [isAllComplete, profile]);

  const dismiss = useCallback(async (): Promise<void> => {
    if (!profile) {
      logger.warn("Cannot dismiss setup guide: profile not loaded");
      return;
    }
    await persistSetupGuideCompleted(true);
  }, [profile]);

  // Mic-tooltip state machine moved to `MicTooltipContext` — see destructure
  // at the top of this hook. Keeping the same return shape for callers.

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    isDismissed,
    isLoading,
    isAllComplete,
    dismiss,
    onVoiceStepAction,
    isMicTooltipVisible,
    onMicTooltipTryItNow,
    onMicTooltipClose,
  };
}
