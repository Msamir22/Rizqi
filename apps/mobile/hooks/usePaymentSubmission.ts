/**
 * usePaymentSubmission Hook
 *
 * Encapsulates the validation + DB write logic for paying a recurring payment.
 * Extracted from PayNowModal to follow SRP (E3): the modal handles UI,
 * this hook handles business logic.
 *
 * @module usePaymentSubmission
 */

import type { RecurringPayment } from "@astik/db";
import { useCallback, useState } from "react";
import { InteractionManager } from "react-native";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import { createTransaction } from "@/services/transaction-service";
import { updateRecurringPaymentNextDueDate } from "@/services/recurring-payment-service";

// =============================================================================
// Types
// =============================================================================

interface UsePaymentSubmissionParams {
  /** The recurring payment to pay */
  payment: RecurringPayment | null;
  /** The account to deduct from */
  accountId: string;
  /** Callback after successful payment */
  onSuccess: (amount: number) => void;
  /** Callback to close the modal */
  onClose: () => void;
}

interface UsePaymentSubmissionResult {
  /** Whether a submission is in progress */
  readonly isSubmitting: boolean;
  /** Current amount validation error, if any */
  readonly amountError: string;
  /** Clear the amount error */
  readonly clearAmountError: () => void;
  /** Set an amount error manually */
  readonly setAmountError: (error: string) => void;
  /** Submit the payment with the given amount string */
  readonly submit: (amountStr: string) => void;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Manages recurring payment submission: validates amount, creates a transaction,
 * advances the next due date, and handles errors with toast notifications.
 *
 * DB writes are deferred via `InteractionManager.runAfterInteractions()` to
 * avoid blocking modal close animations.
 */
export function usePaymentSubmission({
  payment,
  accountId,
  onSuccess,
  onClose,
}: UsePaymentSubmissionParams): UsePaymentSubmissionResult {
  const { t } = useTranslation("transactions");
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState("");

  const clearAmountError = useCallback((): void => {
    setAmountError("");
  }, []);

  const submit = useCallback(
    (amountStr: string): void => {
      if (!payment) return;

      const numericAmount = parseFloat(amountStr);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setAmountError(t("invalid_amount"));
        return;
      }

      setIsSubmitting(true);

      // Defer DB writes until animations complete to avoid jank
      InteractionManager.runAfterInteractions(async () => {
        try {
          await createTransaction({
            amount: numericAmount,
            currency: payment.currency,
            categoryId: payment.categoryId,
            accountId,
            note: t("payment_for_name", { name: payment.name }),
            type: payment.type,
            source: "MANUAL",
            date: new Date(),
            linkedRecurringId: payment.id,
          });

          await updateRecurringPaymentNextDueDate(
            payment.id,
            payment.nextDueDate,
            payment.frequency
          );

          setIsSubmitting(false);
          onClose();
          onSuccess(numericAmount);
        } catch (error) {
          setIsSubmitting(false);
          // TODO: Replace with structured logging (e.g., Sentry)
          console.error("Error creating transaction:", error);
          showToast({
            type: "error",
            title: t("payment_failed"),
            message: t("payment_failed_message"),
          });
        }
      });
    },
    [payment, accountId, onClose, onSuccess, showToast, t]
  );

  return {
    isSubmitting,
    amountError,
    clearAmountError,
    setAmountError,
    submit,
  };
}
