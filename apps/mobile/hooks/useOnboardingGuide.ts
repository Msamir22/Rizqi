/**
 * useOnboardingGuide Hook
 *
 * Tracks granular onboarding progress for the dashboard setup guide card.
 * Reactively observes WatermelonDB to determine which onboarding steps
 * the user has completed, and whether the guide has been dismissed.
 *
 * The guide is only shown when `profile.setupGuideCompleted` is `false`.
 * When the user dismisses the card or all steps are complete, the field
 * is set to `true` in WatermelonDB (syncs to Supabase).
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

import { logger } from "@/utils/logger";
import { Account, Budget, Profile, Transaction, database } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

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
  /** Whether the guide has been completed/dismissed by the user */
  readonly isDismissed: boolean;
  /** Whether state is still loading */
  readonly isLoading: boolean;
  /** Whether all steps are complete */
  readonly isAllComplete: boolean;
  /** Dismiss the guide card (sets setupGuideCompleted = true in DB) */
  readonly dismiss: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnboardingGuide(): UseOnboardingGuideResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [hasTransaction, setHasTransaction] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [hasSmsEnabled, setHasSmsEnabled] = useState(false);
  // NOTE: isLoading tracks the async SMS check + profile observation.
  // WatermelonDB observers for bank/transaction/budget emit synchronously
  // on subscribe, so those states are immediately available.
  const [isLoading, setIsLoading] = useState(true);

  // Track loading for profile and SMS separately, mark done when both complete
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [smsLoaded, setSmsLoaded] = useState(false);

  useEffect(() => {
    if (profileLoaded && smsLoaded) {
      setIsLoading(false);
    }
  }, [profileLoaded, smsLoaded]);

  // ── Observe profile for setupGuideCompleted ──
  useEffect(() => {
    const subscription = database
      .get<Profile>("profiles")
      .query(Q.where("deleted", false), Q.take(1))
      .observe()
      .subscribe({
        next: (profiles) => {
          setProfile(profiles[0] ?? null);
          setProfileLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe profile for setup guide", error);
          setProfileLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // Derive dismissed state from profile DB field
  const isDismissed = profile?.setupGuideCompleted ?? true;

  // ── Observe bank accounts (type = "BANK") ──
  useEffect(() => {
    const subscription = database
      .get<Account>("accounts")
      .query(Q.where("deleted", false), Q.where("type", "BANK"))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasBankAccount(count > 0);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe bank accounts", error);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe transactions (any non-deleted) ──
  useEffect(() => {
    const subscription = database
      .get<Transaction>("transactions")
      .query(Q.where("deleted", false))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasTransaction(count > 0);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe transactions", error);
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
        },
        error: (error: unknown) => {
          logger.error("Failed to observe budgets", error);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Check SMS sync state ──
  useEffect(() => {
    if (Platform.OS !== "android") {
      setHasSmsEnabled(false);
      setSmsLoaded(true);
      return;
    }

    async function checkSms(): Promise<void> {
      try {
        const hasSynced = await AsyncStorage.getItem("@astik/sms-has-synced");
        setHasSmsEnabled(hasSynced === "true");
      } catch (error: unknown) {
        logger.warn("Failed to read SMS sync state", {
          error: error instanceof Error ? error.message : String(error),
        });
        setHasSmsEnabled(false);
      } finally {
        setSmsLoaded(true);
      }
    }

    void checkSms();
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
        route: "/create-budget",
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

  // Auto-dismiss when all steps complete
  useEffect(() => {
    if (isAllComplete && profile && !profile.setupGuideCompleted) {
      void database.write(async () => {
        await profile.update((record) => {
          record.setupGuideCompleted = true;
        });
      });
    }
  }, [isAllComplete, profile]);

  const dismiss = useCallback(async (): Promise<void> => {
    if (!profile) {
      logger.warn("Cannot dismiss setup guide: profile not loaded");
      return;
    }

    await database.write(async () => {
      await profile.update((record) => {
        record.setupGuideCompleted = true;
      });
    });
  }, [profile]);

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
