/**
 * Budget Service
 *
 * CRUD operations and spending calculations for the Budget entity.
 * Uses WatermelonDB for local-first persistence with Supabase sync.
 *
 * @module budget-service
 */

import { getCurrentUserId } from "./supabase";
import {
  Budget,
  database,
  Transaction,
  Category,
  type BudgetPeriod,
  type BudgetStatus,
  type BudgetType,
  type CurrencyType,
  type AlertFiredLevel,
} from "@astik/db";
import { Q, type Collection } from "@nozbe/watermelondb";
import {
  getCurrentPeriodBounds,
  filterExcludedTransactions,
  buildPauseInterval,
  parsePauseIntervals,
} from "@astik/logic/src/budget";

// =============================================================================
// TYPES
// =============================================================================

export interface CreateBudgetInput {
  readonly name: string;
  readonly type: BudgetType;
  readonly categoryId?: string;
  readonly amount: number;
  readonly currency?: CurrencyType;
  readonly period: BudgetPeriod;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly alertThreshold: number;
}

export interface UpdateBudgetInput {
  readonly name?: string;
  readonly amount?: number;
  readonly currency?: CurrencyType;
  readonly period?: BudgetPeriod;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly alertThreshold?: number;
  readonly categoryId?: string;
}

// =============================================================================
// COLLECTIONS
// =============================================================================

function budgetsCollection(): Collection<Budget> {
  return database.get<Budget>("budgets");
}

function transactionsCollection(): Collection<Transaction> {
  return database.get<Transaction>("transactions");
}

function categoriesCollection(): Collection<Category> {
  return database.get<Category>("categories");
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new budget with validation.
 *
 * @throws Error if user is not authenticated
 * @throws Error if validation fails (uniqueness, required fields)
 */
export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  // Type-specific validation
  if (input.type === "CATEGORY" && !input.categoryId) {
    throw new Error("Category budgets require a categoryId");
  }
  if (input.period === "CUSTOM" && (!input.periodStart || !input.periodEnd)) {
    throw new Error(
      "Custom period budgets require both periodStart and periodEnd"
    );
  }

  // Validate uniqueness
  await validateBudgetUniqueness(input.type, input.period, input.categoryId);

  return database.write(async () => {
    const budget = await budgetsCollection().create((b) => {
      b.userId = userId;
      b.name = input.name;
      b.type = input.type;
      b.categoryId = input.categoryId ?? undefined;
      b.amount = input.amount;
      b.currency = input.currency as CurrencyType;
      b.period = input.period;
      b.periodStart = input.periodStart ?? undefined;
      b.periodEnd = input.periodEnd ?? undefined;
      b.alertThreshold = input.alertThreshold;
      b.status = "ACTIVE" as BudgetStatus;
      b.deleted = false;
    });
    return budget;
  });
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update an existing budget. Type (GLOBAL/CATEGORY) is immutable.
 */
export async function updateBudget(
  budgetId: string,
  input: UpdateBudgetInput
): Promise<Budget> {
  const budget = await budgetsCollection().find(budgetId);

  // Type-specific validation for period changes (C1 fix: correct operator precedence)
  const effectivePeriod = input.period ?? budget.period;
  if (
    effectivePeriod === "CUSTOM" &&
    (!(input.periodStart ?? budget.periodStart) ||
      !(input.periodEnd ?? budget.periodEnd))
  ) {
    throw new Error(
      "Custom period budgets require both periodStart and periodEnd"
    );
  }

  // Re-validate uniqueness if period or categoryId changed (C2 fix)
  if (input.period !== undefined || input.categoryId !== undefined) {
    await validateBudgetUniqueness(
      budget.type,
      input.period ?? budget.period,
      input.categoryId ?? budget.categoryId,
      budgetId
    );
  }

  return database.write(async () => {
    await budget.update((b) => {
      if (input.name !== undefined) b.name = input.name;
      if (input.amount !== undefined) b.amount = input.amount;
      if (input.currency !== undefined) b.currency = input.currency;
      if (input.period !== undefined) b.period = input.period;
      if (input.periodStart !== undefined) b.periodStart = input.periodStart;
      if (input.periodEnd !== undefined) b.periodEnd = input.periodEnd;
      if (input.alertThreshold !== undefined)
        b.alertThreshold = input.alertThreshold;
      if (input.categoryId !== undefined) b.categoryId = input.categoryId;
    });
    return budget;
  });
}

// =============================================================================
// DELETE (soft-delete via deleted = true)
// =============================================================================

/**
 * Soft-delete a budget by setting `deleted = true`.
 * Consistent with the existing project pattern (transaction-service, edit-account-service).
 */
export async function deleteBudget(budgetId: string): Promise<void> {
  const budget = await budgetsCollection().find(budgetId);

  await database.write(async () => {
    await budget.update((b) => {
      b.deleted = true;
    });
  });
}

// =============================================================================
// PAUSE / RESUME
// =============================================================================

/**
 * Pause a budget — spending is frozen at this moment.
 * Records `paused_at` timestamp for interval tracking.
 */
export async function pauseBudget(budgetId: string): Promise<void> {
  const budget = await budgetsCollection().find(budgetId);

  // M2 fix: Guard against pausing an already-paused budget
  if (budget.status === "PAUSED") {
    throw new Error("Budget is already paused");
  }

  await database.write(async () => {
    await budget.update((b) => {
      b.status = "PAUSED" as BudgetStatus;
      b.pausedAt = new Date().toISOString();
    });
  });
}

/**
 * Resume a paused budget.
 * Pushes the completed pause interval {from: paused_at, to: now}
 * into `pause_intervals` and clears `paused_at`.
 */
export async function resumeBudget(budgetId: string): Promise<void> {
  const budget = await budgetsCollection().find(budgetId);

  // M3 fix: Guard against resuming a non-paused budget
  if (budget.status !== "PAUSED") {
    throw new Error("Cannot resume a budget that is not paused");
  }

  const pausedAtMs = budget.pausedAtMs;
  const nowMs = Date.now();

  await database.write(async () => {
    await budget.update((b) => {
      b.status = "ACTIVE" as BudgetStatus;

      // Build and append the completed pause interval
      if (pausedAtMs !== undefined) {
        const currentIntervals = parsePauseIntervals(
          String(b.pauseIntervals ?? "[]")
        );
        const newInterval = buildPauseInterval(pausedAtMs, nowMs);
        b.pauseIntervals = JSON.stringify([...currentIntervals, newInterval]);
      }

      b.pausedAt = undefined;
    });
  });
}

// =============================================================================
// ALERT LEVEL
// =============================================================================

/**
 * Update the alert fired level for a budget.
 * Used to track which threshold has been shown to prevent duplicate alerts.
 */
export async function setAlertFiredLevel(
  budgetId: string,
  level: AlertFiredLevel
): Promise<void> {
  const budget = await budgetsCollection().find(budgetId);

  await database.write(async () => {
    await budget.update((b) => {
      b.alertFiredLevel = level;
    });
  });
}

/**
 * Reset the alert fired level (on period rollover).
 */
export async function resetAlertFiredLevel(budgetId: string): Promise<void> {
  const budget = await budgetsCollection().find(budgetId);

  await database.write(async () => {
    await budget.update((b) => {
      b.alertFiredLevel = undefined;
    });
  });
}

/**
 * Auto-pause a custom budget whose period has expired.
 */
export async function autoPauseBudget(budgetId: string): Promise<void> {
  const budget = await budgetsCollection().find(budgetId);
  if (budget.status !== "ACTIVE") return;

  await database.write(async () => {
    await budget.update((b) => {
      b.status = "PAUSED" as BudgetStatus;
      b.pausedAt = new Date().toISOString();
    });
  });
}

// =============================================================================
// SPENDING AGGREGATION
// =============================================================================

/**
 * Get total EXPENSE spending for a budget within its current period.
 *
 * - Global budgets: sum all EXPENSE transactions in the period
 * - Category budgets: sum EXPENSE transactions matching the budget's category
 *   AND its subcategories (L2 + L3)
 *
 * @returns Total spent amount
 */
export async function getSpendingForBudget(budget: Budget): Promise<number> {
  const bounds = getCurrentPeriodBounds(
    budget.period,
    budget.periodStart,
    budget.periodEnd
  );

  const baseQuery = transactionsCollection().query(
    Q.and(
      Q.where("deleted", false),
      Q.where("type", "EXPENSE"),
      Q.where("date", Q.gte(bounds.start.getTime())),
      Q.where("date", Q.lte(bounds.end.getTime()))
    )
  );

  let transactions: Transaction[];

  if (budget.isGlobal) {
    // Global budget: all expenses in the period
    transactions = await baseQuery.fetch();
  } else {
    // Category budget: need to include subcategories
    const categoryIds = await getCategoryAndSubcategoryIds(budget.categoryId);

    transactions = await transactionsCollection()
      .query(
        Q.and(
          Q.where("deleted", false),
          Q.where("type", "EXPENSE"),
          Q.where("date", Q.gte(bounds.start.getTime())),
          Q.where("date", Q.lte(bounds.end.getTime())),
          Q.where("category_id", Q.oneOf(categoryIds))
        )
      )
      .fetch();
  }

  // Exclude transactions that fall within any pause interval
  const filtered = filterExcludedTransactions(
    transactions,
    budget.typedPauseIntervals,
    budget.pausedAtMs
  );

  return filtered.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Get a category ID and all its subcategory IDs (L2 + L3).
 * Used for category budget spending aggregation (FR-015).
 */
export async function getCategoryAndSubcategoryIds(
  categoryId: string | undefined
): Promise<string[]> {
  if (!categoryId) return [];

  // Get direct children (L2)
  const children = await categoriesCollection()
    .query(Q.and(Q.where("parent_id", categoryId), Q.where("deleted", false)))
    .fetch();

  const childIds = children.map((c) => c.id);

  // Get grandchildren (L3)
  let grandchildIds: string[] = [];
  if (childIds.length > 0) {
    const grandchildren = await categoriesCollection()
      .query(
        Q.and(
          Q.where("parent_id", Q.oneOf(childIds)),
          Q.where("deleted", false)
        )
      )
      .fetch();
    grandchildIds = grandchildren.map((c) => c.id);
  }

  return [categoryId, ...childIds, ...grandchildIds];
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that no duplicate budget exists for the same type+period+category.
 *
 * Rules (from FR-014 + Q1):
 * - Max ONE Global budget per period type (WEEKLY, MONTHLY, CUSTOM)
 * - Max ONE Category budget per category per period type
 *
 * @throws Error if a duplicate is found
 */
export async function validateBudgetUniqueness(
  type: BudgetType,
  period: BudgetPeriod,
  categoryId?: string,
  excludeBudgetId?: string
): Promise<void> {
  const conditions = [
    Q.where("deleted", false),
    Q.where("type", type),
    Q.where("period", period),
  ];

  if (type === "CATEGORY" && categoryId) {
    conditions.push(Q.where("category_id", categoryId));
  }

  if (excludeBudgetId) {
    conditions.push(Q.where("id", Q.notEq(excludeBudgetId)));
  }

  const existing = await budgetsCollection()
    .query(Q.and(...conditions))
    .fetchCount();

  if (existing > 0) {
    const label =
      type === "GLOBAL"
        ? `A Global ${period.toLowerCase()} budget already exists`
        : `A budget for this category with ${period.toLowerCase()} period already exists`;
    throw new Error(label);
  }
}
