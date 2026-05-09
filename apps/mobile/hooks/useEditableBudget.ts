import type { Budget } from "@monyvi/db";
import { useEffect, useState } from "react";
import {
  BUDGET_SERVICE_ERROR_CODES,
  BudgetServiceError,
  getBudgetById,
} from "@/services/budget-service";
import { logger } from "@/utils/logger";

type BudgetLoadErrorKey = "budget_not_found" | "load_budget_error";

interface UseEditableBudgetResult {
  readonly budget: Budget | undefined;
  readonly isLoading: boolean;
  readonly loadErrorKey: BudgetLoadErrorKey | null;
}

export function useEditableBudget(
  budgetId: string | undefined
): UseEditableBudgetResult {
  const [budget, setBudget] = useState<Budget | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(budgetId));
  const [loadErrorKey, setLoadErrorKey] = useState<BudgetLoadErrorKey | null>(
    null
  );

  useEffect(() => {
    if (!budgetId) {
      setBudget(undefined);
      setIsLoading(false);
      setLoadErrorKey(null);
      return;
    }

    let isCancelled = false;
    const currentBudgetId = budgetId;

    async function loadBudget(): Promise<void> {
      setIsLoading(true);
      setLoadErrorKey(null);

      try {
        const found = await getBudgetById(currentBudgetId);
        if (!isCancelled) {
          setBudget(found);
        }
      } catch (error: unknown) {
        if (isBudgetNotFoundError(error)) {
          if (!isCancelled) {
            setBudget(undefined);
            setLoadErrorKey("budget_not_found");
          }
          return;
        }

        logger.error("editableBudget.load.failed", error);
        if (!isCancelled) {
          setLoadErrorKey("load_budget_error");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBudget();

    return () => {
      isCancelled = true;
    };
  }, [budgetId]);

  return { budget, isLoading, loadErrorKey };
}

function isBudgetNotFoundError(error: unknown): boolean {
  return (
    error instanceof BudgetServiceError &&
    error.code === BUDGET_SERVICE_ERROR_CODES.NOT_FOUND
  );
}
