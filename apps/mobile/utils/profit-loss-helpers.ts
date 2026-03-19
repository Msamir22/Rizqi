/**
 * Profit/Loss Helpers
 *
 * Shared utility functions for profit/loss icon and color resolution.
 * Eliminates duplication across MetalsHeroCard, HoldingCard, and LiveRatesStrip.
 *
 * @module profit-loss-helpers
 */

import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfitLossIconName = "arrow-up" | "arrow-down" | "remove";
export type ChangeIconName = "arrow-up" | "arrow-down" | "remove-outline";

// ---------------------------------------------------------------------------
// Profit/Loss Helpers (used by HeroCard, HoldingCard)
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate Ionicons icon name based on amount direction.
 * - Positive → "arrow-up"
 * - Negative → "arrow-down"
 * - Zero → "remove" (neutral dash)
 */
export function getProfitLossIcon(amount: number): ProfitLossIconName {
  if (amount > 0) return "arrow-up";
  if (amount < 0) return "arrow-down";
  return "remove";
}

/**
 * Returns the appropriate color for a profit/loss amount.
 * - Positive → green (nileGreen)
 * - Negative → red
 * - Zero → neutral slate
 */
export function getProfitLossColor(amount: number, isDark: boolean): string {
  if (amount > 0) return palette.nileGreen[500];
  if (amount < 0) return palette.red[500];
  return isDark ? palette.slate[400] : palette.slate[500];
}

// ---------------------------------------------------------------------------
// Change Helpers (used by LiveRatesStrip)
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate Ionicons icon name for a percentage change.
 * Uses "remove-outline" for zero (differs from getProfitLossIcon).
 */
export function getChangeIcon(percent: number): ChangeIconName {
  if (percent > 0) return "arrow-up";
  if (percent < 0) return "arrow-down";
  return "remove-outline";
}

/**
 * Returns the appropriate color for a percentage change.
 * Does not take isDark parameter (LiveRatesStrip always uses slate[400] for zero).
 */
export function getChangeColor(percent: number): string {
  if (percent > 0) return palette.nileGreen[500];
  if (percent < 0) return palette.red[500];
  return palette.slate[400];
}
