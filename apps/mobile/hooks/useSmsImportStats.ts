/**
 * useSmsImportStats Hook
 *
 * Observes the count of SMS-sourced transactions for the current month.
 * Used by the SmsImportStatusCard on the dashboard.
 *
 * @module useSmsImportStats
 */

import { Transaction, database } from "@monyvi/db";
import { getMonthBoundaries } from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";
import { queryOwned } from "@/services/user-data-access";
import { logger } from "@/utils/logger";
import { runUserScopedEffect, useCurrentUserId } from "./useCurrentUserId";

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
  const { userId, isResolvingUser } = useCurrentUserId();

  useEffect(() => {
    return runUserScopedEffect({
      userId,
      isResolvingUser,
      onResolving: () => {
        setImportedThisMonth(0);
        setIsLoading(true);
      },
      onSignedOut: () => {
        setImportedThisMonth(0);
        setIsLoading(false);
      },
      onAuthenticated: (currentUserId) => {
        const now = new Date();
        const { startDate, endDate } = getMonthBoundaries(
          now.getFullYear(),
          now.getMonth() + 1
        );

        const subscription = queryOwned(
          database.get<Transaction>("transactions"),
          currentUserId,
          Q.and(
            Q.where("deleted", false),
            Q.where("source", "SMS"),
            Q.where("date", Q.gte(startDate)),
            Q.where("date", Q.lte(endDate))
          )
        )
          .observeCount()
          .subscribe({
            next: (count) => {
              setImportedThisMonth(count);
              setIsLoading(false);
            },
            error: (err: unknown) => {
              logger.error("smsImportStats.observe.failed", err);
              setImportedThisMonth(0);
              setIsLoading(false);
            },
          });

        return () => subscription.unsubscribe();
      },
    });
  }, [userId, isResolvingUser]);

  return { importedThisMonth, isLoading };
}
