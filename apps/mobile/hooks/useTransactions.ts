/**
 * useTransactions Hook
 * Reactive hook for transaction data from WatermelonDB
 */

import { useState, useEffect } from "react";
import { database, Transaction } from "@astik/db";
import { Q } from "@nozbe/watermelondb";

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseTransactionsOptions {
  limit?: number;
  accountId?: string;
  categoryId?: string;
}

/**
 * Hook to get transactions reactively
 * @param options - Filter options (limit, accountId, categoryId)
 */
export function useTransactions(
  options: UseTransactionsOptions = {}
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
export function useRecentTransactions(): UseTransactionsResult {
  return useTransactions({ limit: 5 });
}

/**
 * Hook to get transactions for a specific month
 */
export function useMonthlyTransactions(
  year: number,
  month: number
): UseTransactionsResult & {
  totalExpenses: number;
  totalIncome: number;
} {
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
    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const query = transactionsCollection.query(
      Q.where("deleted", false),
      Q.where("date", Q.gte(startOfMonth)),
      Q.where("date", Q.lte(endOfMonth)),
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

  // Calculate totals
  const totalExpenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    transactions,
    isLoading,
    error,
    refetch,
    totalExpenses,
    totalIncome,
  };
}
