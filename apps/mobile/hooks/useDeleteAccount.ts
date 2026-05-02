/**
 * useDeleteAccount Hook
 *
 * Orchestrates the account deletion flow: fetches linked record counts,
 * calls the cascade delete service, shows toast, and navigates back.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook (encapsulates mutation + side-effects)
 * - SOLID: SRP — delete orchestration only
 * - Follows the same pattern as useUpdateAccount for consistency
 *
 * @module useDeleteAccount
 */

import { database, type Transaction, type Transfer } from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/ui/Toast";
import {
  deleteAccountWithCascade,
  type ServiceResult,
} from "../services/edit-account-service";
import { getCurrentUserId } from "../services/supabase";
import { safeNotificationHaptic } from "../utils/haptics";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkedRecordsCounts {
  readonly transactions: number;
  readonly transfers: number;
  readonly debts: number;
  readonly recurringPayments: number;
}

interface UseDeleteAccountResult {
  /** Trigger the delete flow */
  readonly performDelete: (accountId: string) => Promise<void>;
  /** Whether a delete operation is in progress */
  readonly isDeleting: boolean;
  /** Counts of linked records for the given account */
  readonly linkedCounts: LinkedRecordsCounts;
  /** Whether linked counts are still loading */
  readonly isLoadingCounts: boolean;
}

// ---------------------------------------------------------------------------
// Default counts
// ---------------------------------------------------------------------------

const EMPTY_COUNTS: LinkedRecordsCounts = {
  transactions: 0,
  transfers: 0,
  debts: 0,
  recurringPayments: 0,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Handles the delete account flow with linked-record count fetching,
 * cascade delete, toast feedback, and navigation.
 *
 * @param accountId - The account to potentially delete
 * @returns Delete function, deleting state, and linked record counts
 */
export function useDeleteAccount(accountId: string): UseDeleteAccountResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedCounts, setLinkedCounts] =
    useState<LinkedRecordsCounts>(EMPTY_COUNTS);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const { showToast } = useToast();
  const router = useRouter();

  // Fetch linked record counts on mount
  useEffect(() => {
    if (!accountId) {
      setIsLoadingCounts(false);
      return;
    }

    let cancelled = false;

    const fetchCounts = async (): Promise<void> => {
      try {
        const [transactions, transfers, debts, recurringPayments] =
          await Promise.all([
            database
              .get<Transaction>("transactions")
              .query(
                Q.where("account_id", accountId),
                Q.where("deleted", false)
              )
              .fetchCount(),
            database
              .get<Transfer>("transfers")
              .query(
                Q.and(
                  Q.or(
                    Q.where("from_account_id", accountId),
                    Q.where("to_account_id", accountId)
                  ),
                  Q.where("deleted", false)
                )
              )
              .fetchCount(),
            database
              .get("debts")
              .query(
                Q.where("account_id", accountId),
                Q.where("deleted", false)
              )
              .fetchCount(),
            database
              .get("recurring_payments")
              .query(
                Q.where("account_id", accountId),
                Q.where("deleted", false)
              )
              .fetchCount(),
          ]);

        if (!cancelled) {
          setLinkedCounts({
            transactions,
            transfers,
            debts,
            recurringPayments,
          });
        }
      } catch (err) {
        logger.error("deleteAccount_count_fetch_failed", err);
      } finally {
        if (!cancelled) {
          setIsLoadingCounts(false);
        }
      }
    };

    fetchCounts().catch((err: unknown) => {
      logger.error("deleteAccount_count_fetch_unhandled", err);
    });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const performDelete = useCallback(
    async (id: string): Promise<void> => {
      if (isDeleting) return;

      const userId = await getCurrentUserId();
      if (!userId) {
        showToast({
          type: "error",
          title: "Session Error",
          message: "You must be signed in to delete an account",
        });
        return;
      }

      setIsDeleting(true);

      try {
        const result: ServiceResult = await deleteAccountWithCascade(
          id,
          userId
        );

        if (!result.success) {
          throw new Error(result.error ?? "Unknown error deleting account");
        }

        safeNotificationHaptic(
          Haptics.NotificationFeedbackType.Success,
          "deleteAccount_success"
        );

        showToast({
          type: "success",
          title: "Account Deleted \uD83D\uDDD1\uFE0F",
          message: "Account and all linked records have been removed",
        });

        router.back();
      } catch (err) {
        logger.error("deleteAccount_flow_failed", err);

        safeNotificationHaptic(
          Haptics.NotificationFeedbackType.Error,
          "deleteAccount_error"
        );

        showToast({
          type: "error",
          title: "Delete Failed",
          message: "Something went wrong. Please try again.",
        });
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, showToast, router]
  );

  return {
    performDelete,
    isDeleting,
    linkedCounts,
    isLoadingCounts,
  };
}
