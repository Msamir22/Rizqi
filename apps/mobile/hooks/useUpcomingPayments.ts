/**
 * useUpcomingPayments Hook
 * Fetches upcoming recurring payments sorted by next due date
 */

import { database, RecurringPayment } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  accountId: string;
  nextDueDate: Date;
  daysUntilDue: number;
  type: "EXPENSE" | "INCOME";
  action: "AUTO_CREATE" | "NOTIFY";
  frequency: string;
}

export interface UseUpcomingPaymentsResult {
  payments: UpcomingPayment[];
  totalDueThisMonth: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function calculateDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function isDateInCurrentMonth(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useUpcomingPayments(
  limit: number = 5
): UseUpcomingPaymentsResult {
  const [recurringPayments, setRecurringPayments] = useState<
    RecurringPayment[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const collection = database.get<RecurringPayment>("recurring_payments");

    // Get active recurring payments sorted by next_due_date
    const query = collection.query(
      Q.where("deleted", false),
      Q.where("status", "ACTIVE"),
      Q.sortBy("next_due_date", Q.asc),
      Q.take(limit + 10) // Get extra for filtering
    );

    const subscription = query.observe().subscribe({
      next: (result) => {
        setRecurringPayments(result);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("Error observing upcoming payments:", err);
        setError(err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [limit, refreshKey]);

  // Transform to upcoming payments with days until due
  const payments = useMemo((): UpcomingPayment[] => {
    return recurringPayments
      .filter((rp) => rp.type === "EXPENSE") // Only show expenses in upcoming
      .slice(0, limit)
      .map((rp) => ({
        id: rp.id,
        name: rp.name,
        amount: rp.amount,
        categoryId: rp.categoryId,
        accountId: rp.accountId,
        nextDueDate: rp.nextDueDate,
        daysUntilDue: calculateDaysUntilDue(rp.nextDueDate),
        type: rp.type,
        action: rp.action,
        frequency: rp.frequency,
      }));
  }, [recurringPayments, limit]);

  // Calculate total due this month (expenses only)
  const totalDueThisMonth = useMemo((): number => {
    return recurringPayments
      .filter(
        (rp) => rp.type === "EXPENSE" && isDateInCurrentMonth(rp.nextDueDate)
      )
      .reduce((sum, rp) => sum + rp.amount, 0);
  }, [recurringPayments]);

  return { payments, totalDueThisMonth, isLoading, error, refetch };
}
