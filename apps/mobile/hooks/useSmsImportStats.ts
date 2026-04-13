/**
 * useSmsImportStats Hook
 *
 * Observes the count of SMS-sourced transactions for the current month.
 * Used by the SmsImportStatusCard on the dashboard.
 *
 * @module useSmsImportStats
 */

import { Transaction, database } from "@astik/db";
import { getMonthBoundaries } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseSmsImportStatsResult {
  /** Number of SMS-sourced transactions this month */
  readonly importedThisMonth: number;
  /** Whether data is loading */
  readonly isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmsImportStats(): UseSmsImportStatsResult {
  const [importedThisMonth, setImportedThisMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const { startDate, endDate } = getMonthBoundaries(
      now.getFullYear(),
      now.getMonth() + 1
    );

    const subscription = database
      .get<Transaction>("transactions")
      .query(
        Q.and(
          Q.where("deleted", false),
          Q.where("source", "SMS"),
          Q.where("date", Q.gte(startDate)),
          Q.where("date", Q.lte(endDate))
        )
      )
      .observeCount()
      .subscribe((count) => {
        setImportedThisMonth(count);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  return { importedThisMonth, isLoading };
}
