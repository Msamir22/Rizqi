import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/ui/Toast";
import {
  CREATE_ACCOUNT_ERROR_CODES,
  createAccountForUser,
} from "../services/account-service";
import { getCurrentUserId } from "../services/supabase";
import { logger } from "../utils/logger";
import { AccountFormData } from "../validation/account-validation";

interface UseCreateAccountResult {
  createAccount: (data: AccountFormData) => Promise<void>;
  isSubmitting: boolean;
  error: Error | null;
}

/**
 * Custom hook to handle the business logic of creating a new account.
 */
export function useCreateAccount(): UseCreateAccountResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const { showToast } = useToast();
  const router = useRouter();
  const { t } = useTranslation("accounts");
  const { t: tCommon } = useTranslation("common");

  /**
   * Performs the database write operation to create an account and optional bank details.
   */
  const createAccount = useCallback(
    async (data: AccountFormData): Promise<void> => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setError(null);

      try {
        const userId = await getCurrentUserId();

        if (!userId) {
          showToast({
            type: "error",
            title: t("toast_create_session_required_title"),
            message: t("toast_create_session_required_message"),
          });
          return;
        }

        const result = await createAccountForUser(userId, data);

        if (!result.success) {
          if (
            result.error === CREATE_ACCOUNT_ERROR_CODES.DUPLICATE_ACCOUNT ||
            result.error === CREATE_ACCOUNT_ERROR_CODES.DUPLICATE_IN_FLIGHT
          ) {
            showToast({
              type: "warning",
              title: t("toast_create_duplicate_title"),
              message: t("toast_create_duplicate_message"),
            });
            return;
          }

          throw new Error(result.error ?? "Unknown error creating account");
        }

        showToast({
          type: "success",
          title: t("toast_create_success_title"),
          message: t("toast_create_success_message", { name: data.name }),
        });

        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace("/(tabs)/accounts");
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        logger.error("createAccount_flow_failed", error);
        setError(error);

        showToast({
          type: "error",
          title: t("toast_create_error_title"),
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
    createAccount,
    isSubmitting,
    error,
  };
}
