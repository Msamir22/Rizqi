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
 * 1. Cash account created (any account with type "CASH" exists for the user)
 * 2. Bank account added (any account with type "BANK" exists)
 * 3. First transaction recorded (any non-deleted transaction exists)
 * 4. Spending budget set (any active budget exists)
 * 5. SMS auto-import enabled (at least one transaction imported from SMS —
 *    detected via `sms_body_hash` on any transaction; scoped per-user since
 *    WatermelonDB is wiped on logout)
 *
 * @module useOnboardingGuide
 */

import { logger } from "@/utils/logger";
import { Account, Budget, Profile, Transaction, database } from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";
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
  // NOTE: Store the profile record and the setup_guide_completed value
  // SEPARATELY. WatermelonDB mutates records in place, so reusing the same
  // object reference on each observer emission causes React's setState to
  // bail out (reference equality). Storing the primitive value ensures
  // re-renders fire whenever the field changes.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [setupGuideCompleted, setSetupGuideCompleted] = useState<
    boolean | null
  >(null);
  const [hasCashAccount, setHasCashAccount] = useState(false);
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [hasTransaction, setHasTransaction] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [hasSmsImported, setHasSmsImported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [cashLoaded, setCashLoaded] = useState(false);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  // SMS observer is skipped on iOS, so mark it pre-loaded on non-Android.
  const [smsLoaded, setSmsLoaded] = useState(Platform.OS !== "android");

  useEffect(() => {
    if (
      profileLoaded &&
      cashLoaded &&
      bankLoaded &&
      txLoaded &&
      budgetLoaded &&
      smsLoaded
    ) {
      setIsLoading(false);
    }
  }, [
    profileLoaded,
    cashLoaded,
    bankLoaded,
    txLoaded,
    budgetLoaded,
    smsLoaded,
  ]);

  // ── Observe profile for setupGuideCompleted ──
  // Use observeWithColumns to react to field-level changes (not just add/remove)
  useEffect(() => {
    const subscription = database
      .get<Profile>("profiles")
      .query(Q.where("deleted", false), Q.take(1))
      .observeWithColumns(["setup_guide_completed"])
      .subscribe({
        next: (profiles) => {
          const nextProfile = profiles[0] ?? null;
          setProfile(nextProfile);
          // Store the primitive field value explicitly — see NOTE above on
          // why we can't rely on profile object reference changes.
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

  // Derive dismissed state from the tracked primitive value.
  // Defaults to `true` (hidden) when the profile hasn't loaded yet to avoid
  // a flash of the card before we know the real state.
  const isDismissed = setupGuideCompleted ?? true;

  // ── Observe cash accounts (type = "CASH") ──
  useEffect(() => {
    const subscription = database
      .get<Account>("accounts")
      .query(Q.where("deleted", false), Q.where("type", "CASH"))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasCashAccount(count > 0);
          setCashLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe cash accounts", error);
          setCashLoaded(true);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Observe bank accounts (type = "BANK") ──
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

  // ── Observe transactions (any non-deleted) ──
  useEffect(() => {
    const subscription = database
      .get<Transaction>("transactions")
      .query(Q.where("deleted", false))
      .observeCount()
      .subscribe({
        next: (count) => {
          setHasTransaction(count > 0);
          setTxLoaded(true);
        },
        error: (error: unknown) => {
          logger.error("Failed to observe transactions", error);
          setTxLoaded(true);
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

  // ── Observe SMS-imported transactions (per-user via WatermelonDB) ──
  // We look for any transaction with a non-null `sms_body_hash`, which is
  // set only by the SMS parser. WatermelonDB is wiped on logout so this is
  // inherently user-scoped (previously this state was read from AsyncStorage
  // which persisted across account switches — a bug that marked the step as
  // complete for users who had never imported SMS themselves). iOS has no
  // SMS import, so this is Android-only.
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

  // ── Build steps array ──
  const steps: readonly OnboardingStep[] = useMemo(
    () => [
      {
        key: "cash_account",
        labelKey: "onboarding_step_cash_account",
        isComplete: hasCashAccount,
        route: "/(tabs)/accounts",
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
        isComplete: hasSmsImported,
        route: "/sms-scan",
        isNew: Platform.OS === "android",
      },
    ],
    [hasCashAccount, hasBankAccount, hasTransaction, hasBudget, hasSmsImported]
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
