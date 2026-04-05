/**
 * useBudgets Hook
 *
 * Observes all ACTIVE, non-deleted budgets via WatermelonDB,
 * computes spending per budget, and supports period filtering.
 *
 * Also handles:
 * - Period rollover: resets alert_fired_level to null
 * - Auto-pause: pauses custom budgets whose period_end has passed
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook (data subscription + side effects)
 * - Why: Encapsulates WatermelonDB reactive queries, spending calculations,
 *   and lifecycle management in a single reusable hook.
 * - SOLID: SRP — provides budget list data; components handle rendering.
 *
 * @module useBudgets
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Budget, database } from "@astik/db";
import { Q } from "@nozbe/watermelondb";

import {
  getSpendingForBudget,
  autoPauseBudget,
} from "@/services/budget-service";
import type { PeriodFilter } from "@/components/budget/PeriodFilterChips";
import {
  SpendingMetrics,
  isPeriodExpired,
  getCurrentPeriodBounds,
  getDaysElapsed,
  getDaysLeft,
  computeSpendingMetrics,
} from "@astik/logic";

// =============================================================================
// TYPES
// =============================================================================

export interface BudgetWithMetrics {
  readonly budget: Budget;
  readonly metrics: SpendingMetrics;
  readonly daysLeft: number;
  readonly daysElapsed: number;
}

interface UseBudgetsResult {
  /** All budgets with computed metrics, filtered by period */
  readonly budgets: readonly BudgetWithMetrics[];
  /** The global budget (if any) */
  readonly globalBudget: BudgetWithMetrics | undefined;
  /** Category budgets only (active) */
  readonly categoryBudgets: readonly BudgetWithMetrics[];
  /** Paused budgets */
  readonly pausedBudgets: readonly BudgetWithMetrics[];
  /** Whether data is loading */
  readonly isLoading: boolean;
  /** Total unfiltered budget count (for distinguishing empty vs filtered-empty) */
  readonly totalCount: number;
  /** Selected period filter */
  readonly periodFilter: PeriodFilter;
  /** Update the period filter */
  readonly setPeriodFilter: (filter: PeriodFilter) => void;
  /** Force refresh spending calculations */
  readonly refresh: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useBudgets(): UseBudgetsResult {
  const [rawBudgets, setRawBudgets] = useState<Budget[]>([]);
  const [budgetsWithMetrics, setBudgetsWithMetrics] = useState<
    BudgetWithMetrics[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [refreshCounter, setRefreshCounter] = useState(0);

  // ── Subscribe to active, non-deleted budgets ──
  useEffect(() => {
    const subscription = database
      .get<Budget>("budgets")
      .query(
        Q.and(
          Q.where("deleted", false),
          Q.where("status", Q.oneOf(["ACTIVE", "PAUSED"]))
        )
      )
      .observe()
      .subscribe((budgets) => {
        setRawBudgets(budgets);
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Compute spending metrics when budgets change ──
  useEffect(() => {
    let cancelled = false;

    async function computeAll(): Promise<void> {
      setIsLoading(true);

      const results: BudgetWithMetrics[] = [];

      for (const budget of rawBudgets) {
        // Auto-pause expired custom budgets (F2 remediation)
        if (
          budget.status === "ACTIVE" &&
          budget.isCustomPeriod &&
          isPeriodExpired(budget.periodEnd)
        ) {
          await autoPauseBudget(budget.id);
          continue; // Skip this budget — it's now paused
        }

        const bounds = getCurrentPeriodBounds(
          budget.period,
          budget.periodStart,
          budget.periodEnd
        );

        // NOTE: Period-rollover alert reset is handled in budget-alert-service.ts (C-03)

        const spent = await getSpendingForBudget(budget);
        const daysElapsed = getDaysElapsed(bounds.start);
        const daysLeft = getDaysLeft(bounds.end);
        const metrics = computeSpendingMetrics(
          spent,
          budget.amount,
          daysElapsed,
          budget.alertThreshold
        );

        results.push({ budget, metrics, daysLeft, daysElapsed });
      }

      if (!cancelled) {
        setBudgetsWithMetrics(results);
        setIsLoading(false);
      }
    }

    void computeAll();

    return () => {
      cancelled = true;
    };
  }, [rawBudgets, refreshCounter]);

  // ── Filter by period ──
  const filteredBudgets = useMemo(() => {
    if (periodFilter === "ALL") return budgetsWithMetrics;
    return budgetsWithMetrics.filter((bm) => bm.budget.period === periodFilter);
  }, [budgetsWithMetrics, periodFilter]);

  // ── Split global vs category ──
  const globalBudget = useMemo(
    () => filteredBudgets.find((bm) => bm.budget.isGlobal),
    [filteredBudgets]
  );

  const categoryBudgets = useMemo(
    () =>
      filteredBudgets.filter(
        (bm) => bm.budget.isCategoryBudget && bm.budget.status === "ACTIVE"
      ),
    [filteredBudgets]
  );

  const pausedBudgets = useMemo(
    () => filteredBudgets.filter((bm) => bm.budget.status === "PAUSED"),
    [filteredBudgets]
  );

  const refresh = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  return {
    budgets: filteredBudgets,
    globalBudget,
    categoryBudgets,
    pausedBudgets,
    isLoading,
    totalCount: budgetsWithMetrics.length,
    periodFilter,
    setPeriodFilter,
    refresh,
  };
}
