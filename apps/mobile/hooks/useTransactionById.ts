/**
 * useTransactionById Hook
 * Observes a single transaction by ID from WatermelonDB.
 */

import { database, Transaction } from "@monyvi/db";
import { useEffect, useState } from "react";
import { observeOwnedById } from "@/services/user-data-access";
import { runUserScopedEffect, useCurrentUserId } from "./useCurrentUserId";
import { logger } from "@/utils/logger";

interface UseTransactionByIdResult {
  readonly transaction: Transaction | null;
  readonly isLoading: boolean;
}

/**
 * Observes a single transaction record reactively.
 * Automatically subscribes to changes and unsubscribes on unmount.
 *
 * @param id - The WatermelonDB record ID of the transaction
 * @returns The observed transaction and loading state
 */
export function useTransactionById(id: string): UseTransactionByIdResult {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { userId, isResolvingUser } = useCurrentUserId();

  useEffect(() => {
    if (!id) {
      setTransaction(null);
      setIsLoading(false);
      return;
    }

    return runUserScopedEffect({
      userId,
      isResolvingUser,
      onResolving: () => {
        setTransaction(null);
        setIsLoading(true);
      },
      onSignedOut: () => {
        setTransaction(null);
        setIsLoading(false);
      },
      onAuthenticated: (currentUserId) => {
        setIsLoading(true);

        const collection = database.get<Transaction>("transactions");
        const subscription = observeOwnedById<Transaction>(
          collection,
          id,
          currentUserId
        ).subscribe({
          next: (record) => {
            setTransaction(record);
            setIsLoading(false);
          },
          error: (err) => {
            logger.error("transactionById.observe.failed", err);
            setTransaction(null);
            setIsLoading(false);
          },
        });

        return () => subscription.unsubscribe();
      },
    });
  }, [id, userId, isResolvingUser]);

  return { transaction, isLoading };
}
