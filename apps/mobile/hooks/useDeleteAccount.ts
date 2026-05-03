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

import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/ui/Toast";
import {
  deleteAccountWithCascade,
  EMPTY_LINKED_RECORDS_COUNTS,
  getAccountLinkedRecordCounts,
  type LinkedRecordsCounts,
  type ServiceResult,
} from "../services/edit-account-service";
import { getCurrentUserId } from "../services/supabase";
import { safeNotificationHaptic } from "../utils/haptics";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseDeleteAccountResult {
  /** Trigger the delete flow */
  readonly performDelete: (accountId: string) => Promise<void>;
  /** Whether a delete operation is in progress */
  readonly isDeleting: boolean;
  /** Counts of linked records for the given account */
  readonly linkedCounts: LinkedRecordsCounts;
  /** Whether linked counts are still loading */
  readonly isLoadingCounts: boolean;
  /** Lazily load linked counts when the delete sheet is opened */
  readonly loadCounts: () => void;
}

// ---------------------------------------------------------------------------
// Default counts
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
  const [linkedCounts, setLinkedCounts] = useState<LinkedRecordsCounts>(
    EMPTY_LINKED_RECORDS_COUNTS
  );
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [hasLoadedCounts, setHasLoadedCounts] = useState(false);
  const isMountedRef = useRef(true);
  const { showToast } = useToast();
  const router = useRouter();
  const { t } = useTranslation("accounts");
  const { t: tCommon } = useTranslation("common");

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setLinkedCounts(EMPTY_LINKED_RECORDS_COUNTS);
    setHasLoadedCounts(false);
    setIsLoadingCounts(false);
  }, [accountId]);

  const loadCounts = useCallback((): void => {
    if (!accountId || isLoadingCounts || hasLoadedCounts) {
      return;
    }

    const fetchCounts = async (): Promise<void> => {
      setIsLoadingCounts(true);
      try {
        const counts = await getAccountLinkedRecordCounts(accountId);

        if (isMountedRef.current) {
          setLinkedCounts(counts);
          setHasLoadedCounts(true);
        }
      } catch (err) {
        logger.error("deleteAccount_count_fetch_failed", err);
      } finally {
        if (isMountedRef.current) {
          setIsLoadingCounts(false);
        }
      }
    };

    fetchCounts().catch((err: unknown) => {
      logger.error("deleteAccount_count_fetch_unhandled", err);
    });
  }, [accountId, isLoadingCounts, hasLoadedCounts]);

  const performDelete = useCallback(
    async (id: string): Promise<void> => {
      if (isDeleting) return;

      const userId = await getCurrentUserId();
      if (!userId) {
        showToast({
          type: "error",
          title: t("toast_delete_session_required_title"),
          message: t("toast_delete_session_required_message"),
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
          title: t("toast_delete_success_title"),
          message: t("toast_delete_success_message"),
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
          title: t("toast_delete_error_title"),
          message: tCommon("error_generic"),
        });
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, showToast, router, t, tCommon]
  );

  return {
    performDelete,
    isDeleting,
    linkedCounts,
    isLoadingCounts,
    loadCounts,
  };
}
