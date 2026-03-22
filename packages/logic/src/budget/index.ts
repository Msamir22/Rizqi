/**
 * Budget Logic Module — Barrel Export
 *
 * Re-exports all budget-related pure logic utilities
 * from the @astik/logic package.
 */

export {
  getCurrentPeriodBounds,
  getDaysLeft,
  getDaysElapsed,
  isWithinPeriod,
  isPeriodExpired,
  getWeeklyBuckets,
} from "./budget-period-utils";

export type { PeriodBounds, WeeklyBucket } from "./budget-period-utils";

export {
  calculateSpentPercentage,
  calculateRemaining,
  calculateDailyAverage,
  getProgressStatus,
  computeSpendingMetrics,
} from "./budget-spending";

export type { ProgressStatus, SpendingMetrics } from "./budget-spending";

export {
  isWithinPauseWindow,
  filterExcludedTransactions,
  buildPauseInterval,
  parsePauseIntervals,
} from "./budget-pause-utils";

export type { PauseInterval } from "./budget-pause-utils";
