import { BaseBudget } from "./base/base-budget";
import type { AlertFiredLevel } from "../types";
import {
  parsePauseIntervals,
  type PauseInterval,
} from "@astik/logic/src/budget/budget-pause-utils";

export class Budget extends BaseBudget {
  /**
   * Typed accessor for alertFiredLevel.
   * The base model stores this as `string | undefined`, but valid values
   * are constrained by the DB CHECK to NULL | 'WARNING' | 'DANGER'.
   */
  get typedAlertFiredLevel(): AlertFiredLevel | undefined {
    return this.alertFiredLevel;
  }

  /**
   * Parse the raw JSON pause_intervals column into a typed array.
   * Uses runtime validation to filter out malformed entries.
   */
  get typedPauseIntervals(): readonly PauseInterval[] {
    // WatermelonDB decorator fields may not resolve statically; coerce safely
    const raw: string = String(this.pauseIntervals ?? "[]");
    return parsePauseIntervals(raw);
  }

  /**
   * Parse the raw paused_at string into epoch milliseconds.
   * Returns undefined if not currently paused.
   */
  get pausedAtMs(): number | undefined {
    // WatermelonDB decorator fields may not resolve statically; coerce safely
    const raw: string | undefined = this.pausedAt
      ? String(this.pausedAt)
      : undefined;
    if (!raw) return undefined;
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? undefined : ms;
  }

  get isActive(): boolean {
    return this.status === "ACTIVE";
  }

  get isPaused(): boolean {
    return this.status === "PAUSED";
  }

  get isGlobal(): boolean {
    return this.type === "GLOBAL";
  }

  get isCategoryBudget(): boolean {
    return this.type === "CATEGORY";
  }

  get isCustomPeriod(): boolean {
    return this.period === "CUSTOM";
  }

  /**
   * Check if spending has hit the alert threshold (warning level).
   * @param spent - Amount spent in this budget period
   * @returns true if spending >= alert_threshold percentage
   */
  shouldWarn(spent: number): boolean {
    if (this.amount === 0) return false;
    const percentage = (spent / this.amount) * 100;
    return percentage >= this.alertThreshold;
  }

  /**
   * Check if spending has exceeded the budget limit (danger level).
   * @param spent - Amount spent in this budget period
   * @returns true if spending >= 100% of budget
   */
  isOverBudget(spent: number): boolean {
    return spent >= this.amount;
  }

  /**
   * Calculate remaining budget.
   * @param spent - Amount spent in this budget period
   * @returns Remaining amount (clamped to 0)
   */
  remaining(spent: number): number {
    return Math.max(0, this.amount - spent);
  }

  /**
   * Calculate spent percentage.
   * @param spent - Amount spent in this budget period
   * @returns Percentage (0-100+)
   */
  spentPercentage(spent: number): number {
    if (this.amount === 0) return 0;
    return (spent / this.amount) * 100;
  }
}
