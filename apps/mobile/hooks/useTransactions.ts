/**
 * useTransactions Hook
 * Reactive hook for transaction data from WatermelonDB
 */

import { database, Transaction } from "@astik/db";
import { getMonthBoundaries } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

type UseTransactionsOptions = Partial<
  Pick<Transaction, "accountId" | "categoryId">
> & {
  limit?: number;
};

/**
 * Hook to get transactions reactively
 * @param options - Filter options (limit, accountId, categoryId)
 */
export function useTransactions(
  options: UseTransactionsOptions
): UseTransactionsResult {
  const { limit = 20, accountId, categoryId } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const transactionsCollection = database.get<Transaction>("transactions");

    // Build query with filters
    const conditions = [Q.where("deleted", false)];

    if (accountId) {
      conditions.push(Q.where("account_id", accountId));
    }

    if (categoryId) {
      conditions.push(Q.where("category_id", categoryId));
    }

    const query = transactionsCollection.query(
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
      error: (err) => {
        console.error("Error observing transactions:", err);
        setError(err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [limit, accountId, categoryId, refreshKey]);

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

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const transactionsCollection = database.get<Transaction>("transactions");

    // Calculate start and end of month
    const { startDate, endDate } = getMonthBoundaries(year, month);

    const query = transactionsCollection.query(
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
      error: (err) => {
        console.error("Error observing monthly transactions:", err);
        setError(err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [year, month, refreshKey]);

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
