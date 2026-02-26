import { Account, BankDetails, database } from "@astik/db";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useToast } from "../components/ui/Toast";
import { getCurrentUserId } from "../services/supabase";
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
  const [error, setError] = useState<Error | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  /**
   * Performs the database write operation to create an account and optional bank details.
   */
  const createAccount = useCallback(
    async (data: AccountFormData) => {
      const userId = await getCurrentUserId();

      if (!userId) {
        showToast({
          type: "error",
          title: "Session Error",
          message: "You must be signed in to create an account",
        });
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await database.write(async () => {
          // Check if user already has accounts (for auto-default logic)
          const existingAccounts = await database
            .get<Account>("accounts")
            .query()
            .fetch();
          const isFirstAccount =
            existingAccounts.filter((a) => a.userId === userId && !a.deleted)
              .length === 0;

          const account = await database
            .get<Account>("accounts")
            .create((acc) => {
              acc.userId = userId;
              acc.name = data.name.trim();
              acc.type = data.accountType;
              acc.balance = parseFloat(data.balance);
              acc.currency = data.currency;
              acc.deleted = false;
              acc.isDefault = isFirstAccount;
            });

          // Create BankDetails if account type is BANK
          if (data.accountType === "BANK") {
            await database
              .get<BankDetails>("bank_details")
              .create((details) => {
                details.accountId = account.id;
                details.bankName = data.bankName?.trim() || undefined;
                details.cardLast4 = data.cardLast4?.trim() || undefined;
                details.smsSenderName = data.smsSenderName?.trim() || undefined;
                details.deleted = false;
              });
          }
        });

        showToast({
          type: "success",
          title: "Account Created 🎉",
          message: `${data.name.trim()} has been added successfully`,
        });

        router.back();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        console.error("[useCreateAccount] Error creating account:", error);
        setError(error);

        showToast({
          type: "error",
          title: "Creation Failed",
          message: "Something went wrong. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [showToast, router]
  );

  return {
    createAccount,
    isSubmitting,
    error,
  };
}
