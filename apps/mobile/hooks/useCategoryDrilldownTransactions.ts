import { database, Transaction } from "@monyvi/db";
import { getYearMonthBoundaries } from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";
import { queryOwned } from "@/services/user-data-access";
import { logger } from "@/utils/logger";
import { runUserScopedEffect, useCurrentUserId } from "./useCurrentUserId";

interface UseCategoryDrilldownTransactionsResult {
  readonly transactions: readonly Transaction[];
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export function useCategoryDrilldownTransactions(
  year: number,
  month: number
): UseCategoryDrilldownTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { userId, isResolvingUser } = useCurrentUserId();

  useEffect(() => {
    return runUserScopedEffect({
      userId,
      isResolvingUser,
      onResolving: () => {
        setTransactions([]);
        setError(null);
        setIsLoading(true);
      },
      onSignedOut: () => {
        setTransactions([]);
        setError(null);
        setIsLoading(false);
      },
      onAuthenticated: (currentUserId) => {
        setIsLoading(true);
        setError(null);

        const { startDate, endDate } = getYearMonthBoundaries(year, month);
        const subscription = queryOwned(
          database.get<Transaction>("transactions"),
          currentUserId,
          Q.where("deleted", false),
          Q.where("date", Q.gte(startDate)),
          Q.where("date", Q.lte(endDate)),
          Q.where("type", "EXPENSE")
        )
          .observe()
          .subscribe({
            next: (result) => {
              setTransactions(result);
              setIsLoading(false);
            },
            error: (err: unknown) => {
              logger.error(
                "categoryDrilldown.transactions.observe.failed",
                err
              );
              setError(err instanceof Error ? err : new Error(String(err)));
              setTransactions([]);
              setIsLoading(false);
            },
          });

        return () => subscription.unsubscribe();
      },
    });
  }, [year, month, userId, isResolvingUser]);

  return { transactions, isLoading, error };
}
