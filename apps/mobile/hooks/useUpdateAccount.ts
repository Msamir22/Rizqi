/**
 * useUpdateAccount Hook
 *
 * Orchestrates the account update flow: validates, calls the service,
 * optionally creates a balance adjustment transaction, shows a success/error
 * toast, and navigates back on success.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook (encapsulates mutation + side-effects)
 * - SOLID: SRP — update orchestration only, no form state
 * - Follows the same pattern as useCreateAccount for consistency
 *
 * @module useUpdateAccount
 */

import type { CurrencyType } from "@astik/db";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useToast } from "../components/ui/Toast";
import {
  createBalanceAdjustmentTransaction,
  updateAccount,
  type UpdateAccountData,
  type ServiceResult,
} from "../services/edit-account-service";
import { getCurrentUserId } from "../services/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for how to handle a balance change during update. */
interface BalanceAdjustmentOptions {
  /** Whether to track the balance change as a transaction */
  readonly trackAsTransaction: boolean;
  /** The balance before the edit (needed for transaction tracking) */
  readonly previousBalance: number;
  /** The account's currency (needed for transaction tracking) */
  readonly currency: CurrencyType;
}

interface UseUpdateAccountResult {
  /** Trigger the update flow */
  readonly performUpdate: (
    accountId: string,
    data: UpdateAccountData,
    balanceAdjustment?: BalanceAdjustmentOptions
  ) => Promise<void>;
  /** Whether a save operation is in progress */
  readonly isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Handles the update account flow with toast feedback and navigation.
 *
 * On success: shows success toast with haptic feedback, navigates back.
 * On failure: shows error toast with error haptic feedback.
 *
 * When `balanceAdjustment.trackAsTransaction` is true, also creates a
 * balance adjustment transaction after the account update.
 *
 * @returns The update function and submitting state
 */
export function useUpdateAccount(): UseUpdateAccountResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const performUpdate = useCallback(
    async (
      accountId: string,
      data: UpdateAccountData,
      balanceAdjustment?: BalanceAdjustmentOptions
    ): Promise<void> => {
      if (isSubmitting) return;

      setIsSubmitting(true);

      try {
        // 1. Update the account
        const result: ServiceResult = await updateAccount(accountId, data);

        if (!result.success) {
          throw new Error(result.error ?? "Unknown error updating account");
        }

        // 2. Optionally create balance adjustment transaction
        if (balanceAdjustment?.trackAsTransaction) {
          const userId = await getCurrentUserId();

          if (userId) {
            const adjResult = await createBalanceAdjustmentTransaction(
              accountId,
              userId,
              balanceAdjustment.currency,
              balanceAdjustment.previousBalance,
              data.balance
            );

            if (!adjResult.success) {
              // Non-fatal: account was updated but tracking failed
              console.warn(
                "[useUpdateAccount] Balance adjustment tracking failed:",
                adjResult.error
              );
            }
          }
        }

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(console.error);

        showToast({
          type: "success",
          title: "Account Updated ✅",
          message: `${data.name.trim()} has been updated successfully`,
        });

        router.back();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[useUpdateAccount] Error updating account:", message);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          console.error
        );

        showToast({
          type: "error",
          title: "Update Failed",
          message: "Something went wrong. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, showToast, router]
  );

  return {
    performUpdate,
    isSubmitting,
  };
}
