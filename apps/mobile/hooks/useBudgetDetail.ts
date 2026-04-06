/**
 * useBudgetDetail Hook
 *
 * Observes a single budget, computes spending metrics, weekly buckets,
 * subcategory breakdown, and recent matching transactions.
 *
 * @module useBudgetDetail
 */

import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
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
} from "@astik/logic";
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
  // F-04: Consolidated into a single state object to avoid cascading re-renders
  const [state, setState] = useState<{
    readonly metrics: SpendingMetrics | null;
    readonly daysLeft: number;
    readonly daysElapsed: number;
    readonly weeklySpending: readonly WeeklySpendingData[];
    readonly subcategoryBreakdown: readonly SubcategorySpending[];
    readonly recentTransactions: readonly Transaction[];
    readonly isLoading: boolean;
  }>({
    metrics: null,
    daysLeft: 0,
    daysElapsed: 1,
    weeklySpending: [],
    subcategoryBreakdown: [],
    recentTransactions: [],
    isLoading: true,
  });

  // ── Re-trigger spending computation on screen focus ──
  const [refreshCounter, setRefreshCounter] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshCounter((c) => c + 1);
    }, [])
  );

  // ── Subscribe to budget changes ──
  // WatermelonDB's findAndObserve emits the SAME model reference on update
  // (models are cached by ID). React's useEffect compares deps by reference,
  // so we use a version counter to detect each emission.
  const [budgetVersion, setBudgetVersion] = useState(0);

  useEffect(() => {
    if (!budgetId) return;

    const subscription = database
      .get<Budget>("budgets")
      .findAndObserve(budgetId)
      .subscribe(
        (b) => {
          setBudget(b);
          setBudgetVersion((v) => v + 1);
        },
        () => {
          // Budget not found or deleted
          setBudget(null);
          setState({
            metrics: null,
            daysLeft: 0,
            daysElapsed: 1,
            weeklySpending: [],
            subcategoryBreakdown: [],
            recentTransactions: [],
            isLoading: false,
          });
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
      setState((prev) => ({ ...prev, isLoading: true }));

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
        elapsed,
        budget.alertThreshold
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

      // Recent transactions — over-fetch to compensate for pause-window filtering
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

      const recentRaw = await database
        .get<Transaction>("transactions")
        .query(
          ...recentConditions,
          Q.sortBy("date", Q.desc),
          Q.take(RECENT_TRANSACTIONS_LIMIT * 2)
        )
        .fetch();

      // Exclude paused-window transactions, then trim to the desired limit
      const recentFiltered = filterExcludedTransactions(
        recentRaw,
        budget.typedPauseIntervals,
        budget.pausedAtMs
      ).slice(0, RECENT_TRANSACTIONS_LIMIT);

      if (!cancelled) {
        setState({
          metrics: computedMetrics,
          daysLeft: left,
          daysElapsed: elapsed,
          weeklySpending: weeklyData,
          subcategoryBreakdown: breakdown,
          recentTransactions: recentFiltered,
          isLoading: false,
        });
      }
    }

    void compute();

    return () => {
      cancelled = true;
    };
    // budgetVersion increments on every WatermelonDB emission (same-reference workaround)
    // refreshCounter increments on screen focus (useFocusEffect)
  }, [budgetVersion, refreshCounter]);

  return {
    budget,
    metrics: state.metrics,
    daysLeft: state.daysLeft,
    daysElapsed: state.daysElapsed,
    weeklySpending: state.weeklySpending,
    subcategoryBreakdown: state.subcategoryBreakdown,
    recentTransactions: state.recentTransactions,
    isLoading: state.isLoading,
  };
}
