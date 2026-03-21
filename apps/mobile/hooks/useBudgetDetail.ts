/**
 * useBudgetDetail Hook
 *
 * Observes a single budget, computes spending metrics, weekly buckets,
 * subcategory breakdown, and recent matching transactions.
 *
 * @module useBudgetDetail
 */

import { useState, useEffect } from "react";
import { Budget, database, Transaction, Category } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import {
  getCurrentPeriodBounds,
  getDaysLeft,
  getDaysElapsed,
  getWeeklyBuckets,
  computeSpendingMetrics,
  filterExcludedTransactions,
  type SpendingMetrics,
  type WeeklyBucket,
} from "@astik/logic/src/budget";
import {
  getSpendingForBudget,
  getCategoryAndSubcategoryIds,
} from "@/services/budget-service";

// =============================================================================
// TYPES
// =============================================================================

export interface SubcategorySpending {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amount: number;
  readonly percentage: number;
}

export interface WeeklySpendingData {
  readonly bucket: WeeklyBucket;
  readonly amount: number;
}

interface UseBudgetDetailResult {
  readonly budget: Budget | null;
  readonly metrics: SpendingMetrics | null;
  readonly daysLeft: number;
  readonly daysElapsed: number;
  readonly weeklySpending: readonly WeeklySpendingData[];
  readonly subcategoryBreakdown: readonly SubcategorySpending[];
  readonly recentTransactions: readonly Transaction[];
  readonly isLoading: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RECENT_TRANSACTIONS_LIMIT = 6;

// =============================================================================
// HOOK
// =============================================================================

export function useBudgetDetail(budgetId: string): UseBudgetDetailResult {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [metrics, setMetrics] = useState<SpendingMetrics | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [daysElapsed, setDaysElapsed] = useState(1);
  const [weeklySpending, setWeeklySpending] = useState<WeeklySpendingData[]>(
    []
  );
  const [subcategoryBreakdown, setSubcategoryBreakdown] = useState<
    SubcategorySpending[]
  >([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  // ── Subscribe to budget changes ──
  useEffect(() => {
    if (!budgetId) return;

    const subscription = database
      .get<Budget>("budgets")
      .findAndObserve(budgetId)
      .subscribe(
        (b) => setBudget(b),
        () => {
          // Budget not found or deleted
          setBudget(null);
          setIsLoading(false);
        }
      );

    return () => subscription.unsubscribe();
  }, [budgetId]);

  // ── Compute all metrics when budget changes ──
  useEffect(() => {
    if (!budget) return;
    let cancelled = false;

    async function compute(): Promise<void> {
      if (!budget) return;
      setIsLoading(true);

      const bounds = getCurrentPeriodBounds(
        budget.period,
        budget.periodStart,
        budget.periodEnd
      );

      // Spending
      const spent = await getSpendingForBudget(budget);
      const elapsed = getDaysElapsed(bounds.start);
      const left = getDaysLeft(bounds.end);
      const computedMetrics = computeSpendingMetrics(
        spent,
        budget.amount,
        elapsed
      );

      // Weekly buckets
      const buckets = getWeeklyBuckets(bounds);
      const weeklyData: WeeklySpendingData[] = [];

      // Resolve category IDs once for reuse in scoped queries
      const categoryIds =
        budget.isCategoryBudget && budget.categoryId
          ? await getCategoryAndSubcategoryIds(budget.categoryId)
          : null;

      for (const bucket of buckets) {
        const conditions = [
          Q.where("deleted", false),
          Q.where("type", "EXPENSE"),
          Q.where("date", Q.gte(bucket.weekStart.getTime())),
          Q.where("date", Q.lte(bucket.weekEnd.getTime())),
        ];

        // Scope to category tree for category budgets
        if (categoryIds) {
          conditions.push(Q.where("category_id", Q.oneOf(categoryIds)));
        }

        const allTxs = await database
          .get<Transaction>("transactions")
          .query(Q.and(...conditions))
          .fetch();

        // Exclude paused-window transactions
        const activeTxs = filterExcludedTransactions(
          allTxs,
          budget.typedPauseIntervals,
          budget.pausedAtMs
        );

        weeklyData.push({
          bucket,
          amount: activeTxs.reduce((sum, tx) => sum + tx.amount, 0),
        });
      }

      // Subcategory breakdown (for category budgets)
      let breakdown: SubcategorySpending[] = [];
      if (budget.isCategoryBudget && budget.categoryId && spent > 0) {
        const children = await database
          .get<Category>("categories")
          .query(
            Q.and(
              Q.where("parent_id", budget.categoryId),
              Q.where("deleted", false)
            )
          )
          .fetch();

        for (const child of children) {
          // M1 fix: Include L3 (grandchild) transactions in subcategory breakdown
          const childCategoryIds = await getCategoryAndSubcategoryIds(child.id);
          const allChildTxs = await database
            .get<Transaction>("transactions")
            .query(
              Q.and(
                Q.where("deleted", false),
                Q.where("type", "EXPENSE"),
                Q.where("category_id", Q.oneOf(childCategoryIds)),
                Q.where("date", Q.gte(bounds.start.getTime())),
                Q.where("date", Q.lte(bounds.end.getTime()))
              )
            )
            .fetch();

          // Exclude paused-window transactions
          const activeChildTxs = filterExcludedTransactions(
            allChildTxs,
            budget.typedPauseIntervals,
            budget.pausedAtMs
          );

          const childAmount = activeChildTxs.reduce(
            (sum, tx) => sum + tx.amount,
            0
          );
          if (childAmount > 0) {
            breakdown.push({
              categoryId: child.id,
              categoryName: child.displayName,
              amount: childAmount,
              percentage: (childAmount / spent) * 100,
            });
          }
        }

        // Sort by amount descending
        breakdown = breakdown.sort((a, b) => b.amount - a.amount);
      }

      // Recent transactions
      const recentConditions = [
        Q.where("deleted", false),
        Q.where("type", "EXPENSE"),
        Q.where("date", Q.gte(bounds.start.getTime())),
        Q.where("date", Q.lte(bounds.end.getTime())),
      ];

      // Scope to category tree for category budgets
      if (categoryIds) {
        recentConditions.push(Q.where("category_id", Q.oneOf(categoryIds)));
      }

      const recent = await database
        .get<Transaction>("transactions")
        .query(
          ...recentConditions,
          Q.sortBy("date", Q.desc),
          Q.take(RECENT_TRANSACTIONS_LIMIT)
        )
        .fetch();

      if (!cancelled) {
        setMetrics(computedMetrics);
        setDaysLeft(left);
        setDaysElapsed(elapsed);
        setWeeklySpending(weeklyData);
        setSubcategoryBreakdown(breakdown);
        setRecentTransactions(recent);
        setIsLoading(false);
      }
    }

    void compute();

    return () => {
      cancelled = true;
    };
  }, [budget]);

  return {
    budget,
    metrics,
    daysLeft,
    daysElapsed,
    weeklySpending,
    subcategoryBreakdown,
    recentTransactions,
    isLoading,
  };
}
