/**
 * useBudgetAlert Hook
 *
 * Manages budget alert modal visibility and alert data.
 * Called after transaction creation to check for threshold crossings.
 *
 * @module useBudgetAlert
 */

import { useState, useCallback } from "react";
import { router } from "expo-router";
import type { Transaction } from "@monyvi/db";
import {
  checkBudgetAlerts,
  type BudgetAlert,
} from "@/services/budget-alert-service";

// =============================================================================
// TYPES
// =============================================================================

interface UseBudgetAlertResult {
  /** Current alert data (null if no alert) */
  readonly alert: BudgetAlert | null;
  /** Whether the alert modal is visible */
  readonly isVisible: boolean;
  /** Call after creating a transaction to check for alerts. Returns true if an alert was triggered. */
  readonly checkAfterTransaction: (
    transaction: Transaction
  ) => Promise<boolean>;
  /** Dismiss the alert modal */
  readonly dismiss: () => void;
  /** Navigate to the budget detail screen */
  readonly viewBudget: (budgetId: string) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useBudgetAlert(): UseBudgetAlertResult {
  const [alert, setAlert] = useState<BudgetAlert | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const checkAfterTransaction = useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      try {
        const result = await checkBudgetAlerts(transaction);
        if (result) {
          setAlert(result);
          setIsVisible(true);
          return true;
        }
      } catch (error) {
        // Alert check is non-critical — never block the transaction flow
        console.warn("[useBudgetAlert] Alert check failed:", error);
      }
      return false;
    },
    []
  );

  const dismiss = useCallback((): void => {
    setIsVisible(false);
    setAlert(null);
  }, []);

  const viewBudget = useCallback((budgetId: string): void => {
    setIsVisible(false);
    setAlert(null);
    router.push(`/budget-detail?id=${budgetId}`);
  }, []);

  return {
    alert,
    isVisible,
    checkAfterTransaction,
    dismiss,
    viewBudget,
  };
}
