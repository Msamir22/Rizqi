/**
 * useTransferById Hook
 * Observes a single transfer by ID from WatermelonDB.
 */

import { database, Transfer } from "@monyvi/db";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!id) {
      setTransfer(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const collection = database.get<Transfer>("transfers");
    const subscription = collection.findAndObserve(id).subscribe({
      next: (record) => {
        setTransfer(record);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("[useTransferById] Observation error:", err);
        setTransfer(null);
        setIsLoading(false);
      },
    });

    return (): void => {
      subscription.unsubscribe();
    };
  }, [id]);

  return { transfer, isLoading };
}
