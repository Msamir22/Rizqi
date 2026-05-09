/**
 * useTransactions Hook
 * Reactive hook for transaction data from WatermelonDB
 */

import { database, Transaction } from "@monyvi/db";
import { getMonthBoundaries } from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";
import { queryOwned } from "@/services/user-data-access";
import { runUserScopedEffect, useCurrentUserId } from "./useCurrentUserId";
import { logger } from "@/utils/logger";

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

type UseTransactionsOptions = Partial<
  Pick<Transaction, "accountId" | "categoryId" | "type">
> & {
  limit?: number;
};

/**
 * Hook to get transactions reactively
 * @param options - Filter options (limit, accountId, categoryId, type)
 */
export function useTransactions(
  options: UseTransactionsOptions
): UseTransactionsResult {
  const { limit = 20, accountId, categoryId, type } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userId, isResolvingUser } = useCurrentUserId();

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    return runUserScopedEffect({
      userId,
      isResolvingUser,
      onResolving: () => {
        setTransactions([]);
        setIsLoading(true);
      },
      onSignedOut: () => {
        setTransactions([]);
        setIsLoading(false);
      },
      onAuthenticated: (currentUserId) => {
        setIsLoading(true);
        setError(null);

        const transactionsCollection =
          database.get<Transaction>("transactions");

        // Build query with filters
        const conditions = [Q.where("deleted", false)];

        if (accountId) {
          conditions.push(Q.where("account_id", accountId));
        }

        if (categoryId) {
          conditions.push(Q.where("category_id", categoryId));
        }

        if (type) {
          conditions.push(Q.where("type", type));
        }

        const query = queryOwned(
          transactionsCollection,
          currentUserId,
          ...conditions,
          Q.sortBy("date", Q.desc),
          Q.take(limit)
        );

        // Subscribe to changes
        const subscription = query.observe().subscribe({
          next: (result) => {
            setTransactions(result);
            setIsLoading(false);
          },
          error: (err: unknown) => {
            logger.error("transactions.observe.failed", err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setIsLoading(false);
          },
        });

        return () => subscription.unsubscribe();
      },
    });
  }, [limit, accountId, categoryId, type, refreshKey, userId, isResolvingUser]);

  return {
    transactions,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get recent transactions (last 5)
 */
export function useRecentTransactions(limit?: number): UseTransactionsResult {
  return useTransactions({ limit });
}

/**
 * Hook to get transactions for a specific month
 */
export function useMonthlyTransactions(
  year: number,
  month: number
): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userId, isResolvingUser } = useCurrentUserId();

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    return runUserScopedEffect({
      userId,
      isResolvingUser,
      onResolving: () => {
        setTransactions([]);
        setIsLoading(true);
      },
      onSignedOut: () => {
        setTransactions([]);
        setIsLoading(false);
      },
      onAuthenticated: (currentUserId) => {
        setIsLoading(true);
        setError(null);

        const transactionsCollection =
          database.get<Transaction>("transactions");

        // Calculate start and end of month
        const { startDate, endDate } = getMonthBoundaries(year, month);

        const query = queryOwned(
          transactionsCollection,
          currentUserId,
          Q.where("deleted", false),
          Q.where("date", Q.gte(startDate)),
          Q.where("date", Q.lte(endDate)),
          Q.sortBy("date", Q.desc)
        );

        const subscription = query.observe().subscribe({
          next: (result) => {
            setTransactions(result);
            setIsLoading(false);
          },
          error: (err: unknown) => {
            logger.error("monthlyTransactions.observe.failed", err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setIsLoading(false);
          },
        });

        return () => subscription.unsubscribe();
      },
    });
  }, [year, month, refreshKey, userId, isResolvingUser]);

  // TODO : mvoe this to different function & file.
  // Use shared analytics for calculations
  // const totals = calculateMonthlyTotals(
  //   transactions.map((t) => ({
  //     type: t.type as "EXPENSE" | "INCOME",
  //     amount: t.amount,
  //     date: t.date.getTime(),
  //     categoryId: t.categoryId,
  //   }))
  // );

  return {
    transactions,
    isLoading,
    error,
    refetch,
    // totalExpenses: totals.totalExpenses,
    // totalIncome: totals.totalIncome,
    // netChange: totals.netChange,
  };
}
