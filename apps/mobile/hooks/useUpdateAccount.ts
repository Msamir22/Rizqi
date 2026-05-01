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

import type { CurrencyType } from "@rizqi/db";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useToast } from "../components/ui/Toast";
import {
  updateAccountWithBalanceAdjustment,
  type BalanceAdjustmentPayload,
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
 * balance adjustment transaction in the same atomic write as the account
 * update. The balance delta is computed inside the writer from the live
 * pre-update balance, not from any caller-supplied value — see
 * `updateAccountWithBalanceAdjustment` for the contract.
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
        // Resolve the balance-adjustment payload (if requested) BEFORE the
        // write so a missing userId fails the whole update — never silently
        // skip the ledger entry while still mutating the account.
        let adjustmentPayload: BalanceAdjustmentPayload | null = null;
        if (balanceAdjustment?.trackAsTransaction) {
          const userId = await getCurrentUserId();
          if (!userId) {
            throw new Error(
              "Cannot record balance adjustment: user is not signed in"
            );
          }
          adjustmentPayload = {
            userId,
            currency: balanceAdjustment.currency,
          };
        }

        // Single atomic write: account row + (optional) ledger entry commit
        // or roll back together.
        const result: ServiceResult = await updateAccountWithBalanceAdjustment(
          accountId,
          data,
          adjustmentPayload
        );

        if (!result.success) {
          throw new Error(result.error ?? "Unknown error updating account");
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
