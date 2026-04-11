/**
 * useOnboardingGuide Hook
 *
 * Tracks granular onboarding progress for the dashboard setup guide card.
 * Reactively observes WatermelonDB + AsyncStorage to determine which
 * onboarding steps the user has completed.
 *
 * Steps:
 * 1. Cash account created (always true — auto-created during onboarding)
 * 2. Bank account added (any account with type "BANK" exists)
 * 3. First transaction recorded (any non-deleted transaction exists)
 * 4. Spending budget set (any active budget exists)
 * 5. SMS auto-import enabled (SMS permission granted + has synced)
 *
 * @module useOnboardingGuide
 */

import { Account, Budget, Transaction, database } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUIDE_DISMISSED_KEY = "@astik/onboarding-guide-dismissed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  /** Unique key for the step */
  readonly key: string;
  /** i18n translation key for the step label */
  readonly labelKey: string;
  /** Whether this step is complete */
  readonly isComplete: boolean;
  /** Route to navigate to when the step's action is tapped */
  readonly route?: string;
  /** Whether this step has a "New" badge */
  readonly isNew?: boolean;
}

interface UseOnboardingGuideResult {
  /** Ordered list of onboarding steps with completion state */
  readonly steps: readonly OnboardingStep[];
  /** Number of completed steps */
  readonly completedCount: number;
  /** Total number of steps */
  readonly totalSteps: number;
  /** Whether the guide has been dismissed by the user */
  readonly isDismissed: boolean;
  /** Whether state is still loading */
  readonly isLoading: boolean;
  /** Whether all steps are complete */
  readonly isAllComplete: boolean;
  /** Dismiss the guide card */
  readonly dismiss: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnboardingGuide(): UseOnboardingGuideResult {
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [hasTransaction, setHasTransaction] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [hasSmsEnabled, setHasSmsEnabled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Check dismissed state from AsyncStorage ──
  useEffect(() => {
    async function checkDismissed(): Promise<void> {
      try {
        const dismissed = await AsyncStorage.getItem(GUIDE_DISMISSED_KEY);
        setIsDismissed(dismissed === "true");
      } catch {
        // Fail silently — show guide by default
      }
    }

    checkDismissed().catch(() => {});
  }, []);

  // ── Observe bank accounts (type = "BANK") ──
  useEffect(() => {
    const subscription = database
      .get<Account>("accounts")
      .query(Q.where("deleted", false), Q.where("type", "BANK"), Q.take(1))
      .observeCount()
      .subscribe((count) => {
        setHasBankAccount(count > 0);
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe transactions (any non-deleted) ──
  useEffect(() => {
    const subscription = database
      .get<Transaction>("transactions")
      .query(Q.where("deleted", false), Q.take(1))
      .observeCount()
      .subscribe((count) => {
        setHasTransaction(count > 0);
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe active budgets ──
  useEffect(() => {
    const subscription = database
      .get<Budget>("budgets")
      .query(Q.where("deleted", false), Q.where("status", "ACTIVE"), Q.take(1))
      .observeCount()
      .subscribe((count) => {
        setHasBudget(count > 0);
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Check SMS sync state ──
  useEffect(() => {
    if (Platform.OS !== "android") {
      setHasSmsEnabled(false);
      setIsLoading(false);
      return;
    }

    async function checkSms(): Promise<void> {
      try {
        const hasSynced = await AsyncStorage.getItem("@astik/sms-has-synced");
        setHasSmsEnabled(hasSynced === "true");
      } catch {
        setHasSmsEnabled(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSms().catch(() => {
      setIsLoading(false);
    });
  }, []);

  // ── Build steps array ──
  const steps: readonly OnboardingStep[] = useMemo(
    () => [
      {
        key: "cash_account",
        labelKey: "onboarding_step_cash_account",
        isComplete: true, // Always true — auto-created during onboarding
      },
      {
        key: "bank_account",
        labelKey: "onboarding_step_bank_account",
        isComplete: hasBankAccount,
        route: "/(tabs)/accounts",
      },
      {
        key: "first_transaction",
        labelKey: "onboarding_step_first_transaction",
        isComplete: hasTransaction,
        route: "/(tabs)/transactions",
      },
      {
        key: "spending_budget",
        labelKey: "onboarding_step_spending_budget",
        isComplete: hasBudget,
        route: "/(tabs)/budgets",
      },
      {
        key: "sms_import",
        labelKey: "onboarding_step_sms_import",
        isComplete: hasSmsEnabled,
        route: "/sms-scan",
        isNew: Platform.OS === "android",
      },
    ],
    [hasBankAccount, hasTransaction, hasBudget, hasSmsEnabled]
  );

  const completedCount = useMemo(
    () => steps.filter((s) => s.isComplete).length,
    [steps]
  );

  const isAllComplete = completedCount === steps.length;

  const dismiss = useCallback(async (): Promise<void> => {
    setIsDismissed(true);
    try {
      await AsyncStorage.setItem(GUIDE_DISMISSED_KEY, "true");
    } catch {
      // Silently fail — guide will re-appear next time
    }
  }, []);

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    isDismissed,
    isLoading,
    isAllComplete,
    dismiss,
  };
}
