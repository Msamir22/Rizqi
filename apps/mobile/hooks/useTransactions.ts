/**
 * useTransactions Hook
 * Reactive hook for transaction data from WatermelonDB
 */

import {
  Account,
  CurrencyType,
  database,
  Transaction,
  TransactionSource,
  TransactionType,
} from "@astik/db";
import { getMonthBoundaries } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";
import { getCurrentUserId } from "@/services";

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

    if (type) {
      conditions.push(Q.where("type", type));
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
      error: (err: unknown) => {
        console.error("Error observing transactions:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [limit, accountId, categoryId, type, refreshKey]);

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
      error: (err: unknown) => {
        console.error("Error observing monthly transactions:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
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

/**
 * Mark a transaction as deleted (soft delete)
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const transactionsCollection = database.get<Transaction>("transactions");

  await database.write(async () => {
    const transaction = await transactionsCollection.find(transactionId);

    // Reverse the balance change
    const accountsCollection = database.get<Account>("accounts");
    const account = await accountsCollection.find(transaction.accountId);

    await account.update((acc) => {
      if (transaction.type === "EXPENSE") {
        acc.balance += transaction.amount; // Restore balance
      } else {
        acc.balance -= transaction.amount;
      }
    });

    // Soft delete
    await transaction.update((tx) => {
      tx.deleted = true;
    });
  });
}

/**
 * Create a transaction from manual input
 */
export async function createTransaction(data: {
  amount: number;
  currency: CurrencyType;
  categoryId: string;
  counterparty?: string;
  accountId: string;
  note?: string;
  type: TransactionType;
  date?: Date;
  linkedRecurringId?: string;
  source: TransactionSource;
}): Promise<Transaction> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const transactionsCollection = database.get<Transaction>("transactions");
  const accountsCollection = database.get<Account>("accounts");

  // Combine transaction creation and balance update in a single atomic write
  const newTransaction = await database.write(async () => {
    // Create the transaction
    const transaction = await transactionsCollection.create((tx) => {
      tx.userId = userId;
      tx.accountId = data.accountId;
      tx.amount = Math.abs(data.amount); // Amount is always positive
      tx.currency = data.currency;
      tx.type = data.type;
      tx.categoryId = data.categoryId;
      tx.counterparty = data.counterparty || undefined;
      tx.note = data.note || undefined;
      tx.date = data.date || new Date();
      tx.source = data.source;
      tx.linkedRecurringId = data.linkedRecurringId || undefined;
      tx.isDraft = false;
      tx.deleted = false;
    });

    // Update account balance in the same write block
    const account = await accountsCollection.find(data.accountId);
    await account.update((acc) => {
      if (data.type === "EXPENSE") {
        acc.balance -= Math.abs(data.amount);
      } else {
        acc.balance += Math.abs(data.amount);
      }
    });

    return transaction;
  });

  return newTransaction;
}
