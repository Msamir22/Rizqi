/**
 * useAnalytics Hooks
 * Local-first analytics hooks using WatermelonDB
 * All calculations use shared logic from @monyvi/logic
 */

import { Category, database, Transaction, TransactionType } from "@monyvi/db";
import {
  aggregateByCategory,
  calculateComparison,
  calculateMonthlyTotals,
  CategoryBreakdown,
  ChartDataPoint,
  ComparisonResult,
  generateMonthlyChartData,
  getComparisonPeriods,
  getYearMonthBoundaries,
  MonthlySummary,
} from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import {
  queryAccessibleCategories,
  queryOwned,
} from "@/services/user-data-access";
import { logger } from "@/utils/logger";
import { useCurrentUserId } from "./useCurrentUserId";

interface UseAnalyticsResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to get monthly chart data for the last N months
 */
export function useMonthlyChartData(
  months: number = 12,
  accountIds?: string[],
  type: TransactionType = "EXPENSE"
): UseAnalyticsResult<ChartDataPoint[]> {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userId, isResolvingUser } = useCurrentUserId();

  const accountIdsString = useMemo(
    () => accountIds?.join(",") ?? "",
    [accountIds]
  );

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (isResolvingUser) {
      setTransactions([]);
      setIsLoading(true);
      return;
    }

    if (!userId) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const transactionsCollection = database.get<Transaction>("transactions");

    // Calculate date range for the last N months
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      // +1 month to include current month
      now.getMonth() - months + 1,
      1
    ).getTime();

    // Build query conditions
    const conditions = [
      Q.where("deleted", false),
      Q.where("date", Q.gte(startDate)),
      Q.where("type", type),
    ];
    const selectedAccountIds =
      accountIdsString.length > 0 ? accountIdsString.split(",") : [];

    // Filter by accounts if specified
    if (selectedAccountIds.length > 0) {
      conditions.push(Q.where("account_id", Q.oneOf(selectedAccountIds)));
    }

    const query = queryOwned(transactionsCollection, userId, ...conditions);

    const subscription = query.observe().subscribe({
      next: (result) => {
        setTransactions(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        logger.error("analytics.monthlyChart.observe.failed", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [months, type, accountIdsString, refreshKey, userId, isResolvingUser]);

  // Generate chart data
  const data = useMemo((): ChartDataPoint[] => {
    return generateMonthlyChartData(transactions, months, type);
  }, [transactions, months, type]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to get spending breakdown by category for a specific month
 */
export function useCategoryBreakdown(
  year: number,
  month: number,
  accountIds?: string[]
): UseAnalyticsResult<CategoryBreakdown[]> {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userId, isResolvingUser } = useCurrentUserId();

  const accountIdsString = useMemo(
    () => accountIds?.join(",") ?? "",
    [accountIds]
  );

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (isResolvingUser) {
      setTransactions([]);
      setCategories([]);
      setIsLoading(true);
      return;
    }

    if (!userId) {
      setTransactions([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const transactionsCollection = database.get<Transaction>("transactions");
    const categoriesCollection = database.get<Category>("categories");

    const { startDate, endDate } = getYearMonthBoundaries(year, month);

    // Build query conditions
    const conditions = [
      Q.where("deleted", false),
      Q.where("date", Q.gte(startDate)),
      Q.where("date", Q.lte(endDate)),
    ];
    const selectedAccountIds =
      accountIdsString.length > 0 ? accountIdsString.split(",") : [];

    if (selectedAccountIds.length > 0) {
      conditions.push(Q.where("account_id", Q.oneOf(selectedAccountIds)));
    }

    const transactionsQuery = queryOwned(
      transactionsCollection,
      userId,
      ...conditions
    );
    const categoriesQuery = queryAccessibleCategories(
      categoriesCollection,
      userId,
      Q.where("deleted", false)
    );

    // Observe both transactions and categories
    const transactionsSub = transactionsQuery.observe().subscribe({
      next: (result) => setTransactions(result),
      error: (err: unknown) => {
        logger.error("analytics.categoryTransactions.observe.failed", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      },
    });

    const categoriesSub = categoriesQuery.observe().subscribe({
      next: (result) => {
        setCategories(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        logger.error("analytics.categories.observe.failed", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => {
      transactionsSub.unsubscribe();
      categoriesSub.unsubscribe();
    };
  }, [year, month, accountIdsString, refreshKey, userId, isResolvingUser]);

  // Calculate category breakdown
  const data = useMemo((): CategoryBreakdown[] => {
    return aggregateByCategory(transactions, categories);
  }, [transactions, categories]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook for month-over-month or year-over-year comparison
 */
export function useComparison(
  type: "mom" | "yoy",
  year?: number,
  month?: number,
  accountIds?: string[]
): UseAnalyticsResult<ComparisonResult> {
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>(
    []
  );
  const [previousTransactions, setPreviousTransactions] = useState<
    Transaction[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userId, isResolvingUser } = useCurrentUserId();

  const accountIdsString = useMemo(
    () => accountIds?.join(",") ?? "",
    [accountIds]
  );

  // Default to current month if not specified
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (isResolvingUser) {
      setCurrentTransactions([]);
      setPreviousTransactions([]);
      setIsLoading(true);
      return;
    }

    if (!userId) {
      setCurrentTransactions([]);
      setPreviousTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const transactionsCollection = database.get<Transaction>("transactions");
    const { current, previous } = getComparisonPeriods(
      type,
      targetYear,
      targetMonth
    );

    const baseConditions = [Q.where("deleted", false)];
    const selectedAccountIds =
      accountIdsString.length > 0 ? accountIdsString.split(",") : [];
    if (selectedAccountIds.length > 0) {
      baseConditions.push(Q.where("account_id", Q.oneOf(selectedAccountIds)));
    }

    // Current period query
    const currentQuery = queryOwned(
      transactionsCollection,
      userId,
      ...baseConditions,
      Q.where("date", Q.gte(current.startDate)),
      Q.where("date", Q.lte(current.endDate))
    );

    // Previous period query
    const previousQuery = queryOwned(
      transactionsCollection,
      userId,
      ...baseConditions,
      Q.where("date", Q.gte(previous.startDate)),
      Q.where("date", Q.lte(previous.endDate))
    );

    const currentSub = currentQuery.observe().subscribe({
      next: (result) => setCurrentTransactions(result),
      error: (err: unknown) => {
        logger.error("analytics.currentPeriod.observe.failed", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      },
    });

    const previousSub = previousQuery.observe().subscribe({
      next: (result) => {
        setPreviousTransactions(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        logger.error("analytics.previousPeriod.observe.failed", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => {
      currentSub.unsubscribe();
      previousSub.unsubscribe();
    };
  }, [
    type,
    targetYear,
    targetMonth,
    accountIdsString,
    refreshKey,
    userId,
    isResolvingUser,
  ]);

  // Calculate comparison using shared logic
  const data = useMemo((): ComparisonResult => {
    const currentTotals = calculateMonthlyTotals(currentTransactions);
    const previousTotals = calculateMonthlyTotals(previousTransactions);

    // Compare expenses by default
    return calculateComparison(
      currentTotals.totalExpenses,
      previousTotals.totalExpenses
    );
  }, [currentTransactions, previousTransactions]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to get monthly summary data for multiple months
 * Returns an array of monthly summaries for charts
 */
export function useMonthlySummaries(
  months: number = 12,
  accountIds?: string[]
): UseAnalyticsResult<MonthlySummary[]> {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userId, isResolvingUser } = useCurrentUserId();

  const accountIdsString = useMemo(
    () => accountIds?.join(",") ?? "",
    [accountIds]
  );

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (isResolvingUser) {
      setTransactions([]);
      setIsLoading(true);
      return;
    }

    if (!userId) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const transactionsCollection = database.get<Transaction>("transactions");

    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1
    ).getTime();

    const conditions = [
      Q.where("deleted", false),
      Q.where("date", Q.gte(startDate)),
    ];
    const selectedAccountIds =
      accountIdsString.length > 0 ? accountIdsString.split(",") : [];

    if (selectedAccountIds.length > 0) {
      conditions.push(Q.where("account_id", Q.oneOf(selectedAccountIds)));
    }

    const query = queryOwned(transactionsCollection, userId, ...conditions);

    const subscription = query.observe().subscribe({
      next: (result) => {
        setTransactions(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        logger.error("analytics.monthlySummaries.observe.failed", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [months, accountIdsString, refreshKey, userId, isResolvingUser]);

  // Group by month and calculate summaries
  const data = useMemo((): MonthlySummary[] => {
    const now = new Date();
    const summaries: MonthlySummary[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      const { startDate, endDate } = getYearMonthBoundaries(year, month);

      const monthTransactions = transactions.filter(
        (t) => t.date.getTime() >= startDate && t.date.getTime() <= endDate
      );

      const totals = calculateMonthlyTotals(monthTransactions);

      summaries.push({
        year,
        month,
        ...totals,
        transactionCount: monthTransactions.length,
      });
    }

    return summaries;
  }, [transactions, months]);

  return { data, isLoading, error, refetch };
}
