/**
 * useTransactionById Hook
 * Observes a single transaction by ID from WatermelonDB.
 */

import { database, Transaction } from "@monyvi/db";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!id) {
      setTransaction(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const collection = database.get<Transaction>("transactions");
    const subscription = collection.findAndObserve(id).subscribe({
      next: (record) => {
        setTransaction(record);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("[useTransactionById] Observation error:", err);
        setTransaction(null);
        setIsLoading(false);
      },
    });

    return (): void => {
      subscription.unsubscribe();
    };
  }, [id]);

  return { transaction, isLoading };
}
