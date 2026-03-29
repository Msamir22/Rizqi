/**
 * Rate Formatting Utilities
 *
 * Pure functions for formatting market rates and calculating trend percentages.
 * Used by the Live Rates screen and potentially other rate display surfaces.
 *
 * Architecture & Design Rationale:
 * - Pattern: Shared Utility (Domain Logic in `packages/logic`)
 * - Why: Rate formatting and trend calculation are domain rules, not UI concerns.
 *   Placing in @astik/logic makes them reusable by the API layer and testable without React.
 * - SOLID: SRP — formatRate only handles number formatting.
 *   DIP — components depend on the abstraction (function), not implementation.
 *
 * @module format-rate
 */

/**
 * Maximum decimal places for formatted rates.
 * Metals and currencies both use 2 decimal places.
 */
const MAX_FRACTION_DIGITS = 2;

/**
 * Formats a numeric rate value for display.
 *
 * Rules (per FR-024):
 * - Maximum 2 decimal places
 * - Trailing zeros stripped (e.g., "4,850" not "4,850.00", "50.4" not "50.40")
 * - Thousands separator via Intl.NumberFormat
 *
 * @param value - The numeric rate value to format
 * @returns The formatted string (e.g., "4,850.87", "50.45", "1,520")
 */
export function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: MAX_FRACTION_DIGITS,
  }).format(value);
}

/**
 * Calculates the percentage change between a current and previous value.
 *
 * @param current - The current rate value
 * @param previous - The previous rate value (null if unavailable)
 * @returns The percentage change (positive for increase, negative for decrease, 0 if no previous)
 */
export function calculateTrendPercent(
  current: number,
  previous: number | null
): number {
  if (previous === null || previous === 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}
