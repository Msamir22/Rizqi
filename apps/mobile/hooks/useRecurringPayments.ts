/**
 * Hook to fetch, filter, and summarize recurring payments.
 *
 * Encapsulates:
 *  - WatermelonDB observation of the `recurring_payments` collection
 *  - Status-based filtering and counting
 *  - Currency-aware "Next 7 days" and "This month" expense summaries
 *  - Limit-based slicing for dashboard previews
 */

import { database, RecurringPayment, RecurringStatus } from "@astik/db";
import { convertToEGP } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketRates } from "./useMarketRates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseRecurringPaymentsOptions {
  readonly limit?: number;
  readonly status?: RecurringStatus;
}

interface UseRecurringPaymentsResult {
  readonly allPayments: readonly RecurringPayment[];
  readonly filteredPayments: readonly RecurringPayment[];
  readonly counts: Record<RecurringStatus, number>;
  readonly next7DaysTotal: number;
  readonly totalDueThisMonth: number;
  readonly totalIncomeThisMonth: number;
  readonly isLoading: boolean;
  readonly statusFilter: RecurringStatus;
  readonly setStatusFilter: (tab: RecurringStatus) => void;
}

export type { UseRecurringPaymentsOptions, UseRecurringPaymentsResult };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecurringPayments(
  options: UseRecurringPaymentsOptions = {}
): UseRecurringPaymentsResult {
  const { limit, status } = options;

  const [allPayments, setAllPayments] = useState<RecurringPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RecurringStatus>(
    status || "ACTIVE"
  );
  const { latestRates } = useMarketRates();

  // -------------------------------------------------------------------------
  // Observe recurring payments
  // -------------------------------------------------------------------------

  useEffect(() => {
    const collection = database.get<RecurringPayment>("recurring_payments");

    const subscription = collection
      .query(Q.where("deleted", false), Q.sortBy("next_due_date", Q.asc))
      .observe()
      .subscribe({
        next: (result) => {
          setAllPayments(result);
          setIsLoading(false);
        },
        error: (err) => {
          console.error("Error loading recurring payments:", err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  /** Payments filtered by statusFilter + limit (consumer-facing subset). */
  const filteredPayments = useMemo((): RecurringPayment[] => {
    let result: RecurringPayment[] = allPayments;
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (limit) {
      result = result.slice(0, limit);
    }
    return result;
  }, [allPayments, statusFilter, limit]);

  const counts = useMemo<Record<RecurringStatus, number>>(
    () => ({
      ACTIVE: allPayments.filter((p) => p.isActive).length,
      PAUSED: allPayments.filter((p) => p.isPaused).length,
      COMPLETED: allPayments.filter((p) => p.isCompleted).length,
    }),
    [allPayments]
  );

  /** Convert a payment amount to EGP taking currency into account. */
  const toEGP = useCallback(
    (amount: number, currency: string): number => {
      if (!latestRates) return amount;
      return convertToEGP(amount, currency, latestRates);
    },
    [latestRates]
  );

  const { next7DaysTotal, totalDueThisMonth, totalIncomeThisMonth } =
    useMemo(() => {
      const activeExpenses = allPayments.filter(
        (p) => p.isActive && p.isExpense
      );
      const activeIncome = allPayments.filter((p) => p.isActive && p.isIncome);

      const dueNext7Days = getNext7DaysTotal(activeExpenses, toEGP);
      const dueThisMonth = getThisMonthTotal(activeExpenses, toEGP);
      const incomeThisMonth = getThisMonthTotal(activeIncome, toEGP);

      return {
        next7DaysTotal: dueNext7Days,
        totalDueThisMonth: dueThisMonth,
        totalIncomeThisMonth: incomeThisMonth,
      };
    }, [allPayments, toEGP]);

  return {
    allPayments,
    filteredPayments,
    counts,
    next7DaysTotal,
    totalDueThisMonth,
    totalIncomeThisMonth,
    isLoading,
    statusFilter,
    setStatusFilter,
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function getNext7DaysTotal(
  activeExpenses: RecurringPayment[],
  toEGP: (amount: number, currency: string) => number
): number {
  return activeExpenses
    .filter((p) => p.daysUntilDue >= 0 && p.daysUntilDue <= 7)
    .reduce((sum, p) => sum + toEGP(p.amount, p.currency), 0);
}

function getThisMonthTotal(
  payments: RecurringPayment[],
  toEGP: (amount: number, currency: string) => number
): number {
  return payments
    .filter((p) => p.isInThisMonth)
    .reduce((sum, p) => sum + toEGP(p.amount, p.currency), 0);
}
