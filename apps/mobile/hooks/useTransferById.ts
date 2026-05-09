/**
 * useTransferById Hook
 * Observes a single transfer by ID from WatermelonDB.
 */

import { database, Transfer } from "@monyvi/db";
import { useEffect, useState } from "react";
import { observeOwnedById } from "@/services/user-data-access";
import { runUserScopedEffect, useCurrentUserId } from "./useCurrentUserId";
import { logger } from "@/utils/logger";

interface UseTransferByIdResult {
  readonly transfer: Transfer | null;
  readonly isLoading: boolean;
}

/**
 * Observes a single transfer record reactively.
 * Automatically subscribes to changes and unsubscribes on unmount.
 *
 * @param id - The WatermelonDB record ID of the transfer
 * @returns The observed transfer and loading state
 */
export function useTransferById(id: string): UseTransferByIdResult {
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { userId, isResolvingUser } = useCurrentUserId();

  useEffect(() => {
    if (!id) {
      setTransfer(null);
      setIsLoading(false);
      return;
    }

    return runUserScopedEffect({
      userId,
      isResolvingUser,
      onResolving: () => {
        setTransfer(null);
        setIsLoading(true);
      },
      onSignedOut: () => {
        setTransfer(null);
        setIsLoading(false);
      },
      onAuthenticated: (currentUserId) => {
        setIsLoading(true);

        const collection = database.get<Transfer>("transfers");
        const subscription = observeOwnedById<Transfer>(
          collection,
          id,
          currentUserId
        ).subscribe({
          next: (record) => {
            setTransfer(record);
            setIsLoading(false);
          },
          error: (err) => {
            logger.error("transferById.observe.failed", err);
            setTransfer(null);
            setIsLoading(false);
          },
        });

        return () => subscription.unsubscribe();
      },
    });
  }, [id, userId, isResolvingUser]);

  return { transfer, isLoading };
}
