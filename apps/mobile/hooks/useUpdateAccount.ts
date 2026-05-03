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

import type { CurrencyType } from "@monyvi/db";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/ui/Toast";
import {
  updateAccountWithBalanceAdjustment,
  type BalanceAdjustmentPayload,
  type UpdateAccountData,
  type ServiceResult,
} from "../services/edit-account-service";
import { getCurrentUserId } from "../services/supabase";
import { safeNotificationHaptic } from "../utils/haptics";
import { logger } from "../utils/logger";

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
  const isSubmittingRef = useRef(false);
  const { showToast } = useToast();
  const router = useRouter();
  const { t } = useTranslation("accounts");
  const { t: tCommon } = useTranslation("common");

  const performUpdate = useCallback(
    async (
      accountId: string,
      data: UpdateAccountData,
      balanceAdjustment?: BalanceAdjustmentOptions
    ): Promise<void> => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          showToast({
            type: "error",
            title: t("toast_update_session_required_title"),
            message: t("toast_update_session_required_message"),
          });
          return;
        }

        // Resolve the balance-adjustment payload (if requested) BEFORE the write
        // to ensure we have the correct pre-update balance for transaction tracking.
        let adjustmentPayload: BalanceAdjustmentPayload | null = null;
        if (balanceAdjustment?.trackAsTransaction) {
          adjustmentPayload = {
            userId,
            currency: balanceAdjustment.currency,
          };
        }

        // Single atomic write: account row + (optional) ledger entry commit
        // or roll back together.
        const result: ServiceResult = await updateAccountWithBalanceAdjustment(
          accountId,
          userId,
          data,
          adjustmentPayload
        );

        if (!result.success) {
          throw new Error(result.error ?? "Unknown error updating account");
        }

        safeNotificationHaptic(
          Haptics.NotificationFeedbackType.Success,
          "updateAccount_success"
        );

        showToast({
          type: "success",
          title: t("toast_update_success_title"),
          message: t("toast_update_success_message", {
            name: data.name.trim(),
          }),
        });

        router.back();
      } catch (err) {
        logger.error("updateAccount_flow_failed", err);

        safeNotificationHaptic(
          Haptics.NotificationFeedbackType.Error,
          "updateAccount_error"
        );

        showToast({
          type: "error",
          title: t("toast_update_error_title"),
          message: tCommon("error_generic"),
        });
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [showToast, router, t, tCommon]
  );

  return {
    performUpdate,
    isSubmitting,
  };
}
