/**
 * Hook to fetch, filter, and summarize recurring payments.
 *
 * Encapsulates:
 *  - WatermelonDB observation of the `recurring_payments` collection
 *  - Status-based filtering and counting
 *  - Currency-aware "Next 7 days" and "This month" expense summaries
 *  - Limit-based slicing for dashboard previews
 */

import {
  database,
  RecurringPayment,
  RecurringStatus,
  TransactionType,
  type CurrencyType,
} from "@astik/db";
import { convertCurrency } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketRates } from "./useMarketRates";
import { usePreferredCurrency } from "./usePreferredCurrency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseRecurringPaymentsOptions {
  readonly limit?: number;
  readonly status?: RecurringStatus;
  readonly type?: TransactionType;
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
/**
 * Provides observed recurring payments and derived views, filters, counts, and currency-aware totals for UI consumption.
 *
 * @param options - Optional controls for the returned subset:
 *   - limit: maximum number of items in `filteredPayments`
 *   - status: initial status used for `statusFilter`
 *   - type: transaction type to restrict `filteredPayments`
 * @returns An object containing:
 *   - `allPayments`: all observed recurring payments from the database
 *   - `filteredPayments`: `allPayments` filtered by `statusFilter`, `limit`, and `type`
 *   - `counts`: number of payments grouped by `RecurringStatus` (`ACTIVE`, `PAUSED`, `COMPLETED`)
 *   - `next7DaysTotal`: sum of active expense amounts due within 0–7 days, converted to the user's preferred currency
 *   - `totalDueThisMonth`: sum of active expense amounts due this month, converted to the user's preferred currency
 *   - `totalIncomeThisMonth`: sum of active income amounts due this month, converted to the user's preferred currency
 *   - `isLoading`: `true` while initial data is loading
 *   - `statusFilter`: the currently selected `RecurringStatus` filter
 *   - `setStatusFilter`: function to update `statusFilter`
 */

export function useRecurringPayments(
  options: UseRecurringPaymentsOptions = {}
): UseRecurringPaymentsResult {
  const { limit, status, type } = options;

  const [allPayments, setAllPayments] = useState<RecurringPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RecurringStatus>(
    status || "ACTIVE"
  );
  const { latestRates } = useMarketRates();
  const { preferredCurrency } = usePreferredCurrency();

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
    if (type) {
      result = result.filter((p) => p.type === type);
    }
    return result;
  }, [allPayments, statusFilter, limit, type]);

  const counts = useMemo<Record<RecurringStatus, number>>(
    () => ({
      ACTIVE: allPayments.filter((p) => p.isActive).length,
      PAUSED: allPayments.filter((p) => p.isPaused).length,
      COMPLETED: allPayments.filter((p) => p.isCompleted).length,
    }),
    [allPayments]
  );

  /** Convert a payment amount to the user's preferred currency. */
  const toPreferred = useCallback(
    (amount: number, currency: CurrencyType): number => {
      return convertCurrency(amount, currency, preferredCurrency, latestRates);
    },
    [latestRates, preferredCurrency]
  );

  const { next7DaysTotal, totalDueThisMonth, totalIncomeThisMonth } =
    useMemo(() => {
      const activeExpenses = allPayments.filter(
        (p) => p.isActive && p.isExpense
      );
      const activeIncome = allPayments.filter((p) => p.isActive && p.isIncome);

      const dueNext7Days = getNext7DaysTotal(activeExpenses, toPreferred);
      const dueThisMonth = getThisMonthTotal(activeExpenses, toPreferred);
      const incomeThisMonth = getThisMonthTotal(activeIncome, toPreferred);

      return {
        next7DaysTotal: dueNext7Days,
        totalDueThisMonth: dueThisMonth,
        totalIncomeThisMonth: incomeThisMonth,
      };
    }, [allPayments, toPreferred]);

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
/**
 * Calculates the total amount, converted to the preferred currency, of active expense payments due within the next seven days.
 *
 * @param activeExpenses - Active expense recurring payments to consider
 * @param toPreferred - Function that converts an amount from the payment's currency to the user's preferred currency
 * @returns The sum, in the preferred currency, of amounts whose `daysUntilDue` is between 0 and 7 (inclusive)
 */

function getNext7DaysTotal(
  activeExpenses: RecurringPayment[],
  toPreferred: (amount: number, currency: CurrencyType) => number
): number {
  return activeExpenses
    .filter((p) => p.daysUntilDue >= 0 && p.daysUntilDue <= 7)
    .reduce((sum, p) => sum + toPreferred(p.amount, p.currency), 0);
}

/**
 * Calculate the total amount due this month across the provided recurring payments, expressed in the user's preferred currency.
 *
 * @param payments - Recurring payments to include in the aggregation
 * @param toPreferred - Function that converts an amount and its currency to the user's preferred currency
 * @returns The sum of amounts for payments where `isInThisMonth` is true, converted to the preferred currency
 */
function getThisMonthTotal(
  payments: RecurringPayment[],
  toPreferred: (amount: number, currency: CurrencyType) => number
): number {
  return payments
    .filter((p) => p.isInThisMonth)
    .reduce((sum, p) => sum + toPreferred(p.amount, p.currency), 0);
}