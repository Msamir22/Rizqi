/**
 * Purity Utilities for Precious Metals
 *
 * Handles conversion between different purity systems:
 * - Gold: Karat (1-24)
 * - Silver/Platinum/Palladium: Millesimal fineness (1-1000)
 * - Internal: Fraction (0.0-1.0)
 */

import type { MetalType } from "@monyvi/db";

// =============================================================================
// TYPES
// =============================================================================

export interface GoldPurityOption {
  karat: number;
  fraction: number;
  label: string;
}

export interface FinenessOption {
  fineness: number;
  fraction: number;
  label: string;
}

// =============================================================================
// CONSTANTS - Common purity presets for UI pickers
// =============================================================================

/**
 * Common gold karat options
 */
export const GOLD_PURITY_OPTIONS: readonly GoldPurityOption[] = [
  { karat: 24, fraction: 1.0, label: "24K (Pure)" },
  { karat: 22, fraction: 22 / 24, label: "22K" },
  { karat: 21, fraction: 21 / 24, label: "21K" },
  { karat: 18, fraction: 18 / 24, label: "18K" },
  { karat: 14, fraction: 14 / 24, label: "14K" },
  { karat: 10, fraction: 10 / 24, label: "10K" },
] as const;

/**
 * Common fineness options for Silver, Platinum, and Palladium
 */
export const FINENESS_OPTIONS: readonly FinenessOption[] = [
  { fineness: 999, fraction: 0.999, label: "999 (Fine)" },
  { fineness: 950, fraction: 0.95, label: "950" },
  { fineness: 925, fraction: 0.925, label: "925 (Sterling)" },
  { fineness: 900, fraction: 0.9, label: "900" },
  { fineness: 850, fraction: 0.85, label: "850" },
  { fineness: 800, fraction: 0.8, label: "800" },
] as const;

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert gold karat (1-24) to fraction (0-1)
 * @example karatToFraction(21) // returns 0.875
 */
export function karatToFraction(karat: number): number {
  if (karat < 1 || karat > 24) {
    throw new Error(`Invalid karat value: ${karat}. Must be between 1 and 24.`);
  }
  return karat / 24;
}

/**
 * Convert fraction (0-1) to gold karat (1-24)
 * @example fractionToKarat(0.875) // returns 21
 */
export function fractionToKarat(fraction: number): number {
  if (fraction < 0 || fraction > 1) {
    throw new Error(
      `Invalid fraction value: ${fraction}. Must be between 0 and 1.`
    );
  }
  return Math.round(fraction * 24);
}

/**
 * Convert millesimal fineness (1-1000) to fraction (0-1)
 * @example finenessToFraction(925) // returns 0.925
 */
export function finenessToFraction(fineness: number): number {
  if (fineness < 1 || fineness > 1000) {
    throw new Error(
      `Invalid fineness value: ${fineness}. Must be between 1 and 1000.`
    );
  }
  return fineness / 1000;
}

/**
 * Convert fraction (0-1) to millesimal fineness (1-1000)
 * @example fractionToFineness(0.925) // returns 925
 */
export function fractionToFineness(fraction: number): number {
  if (fraction < 0 || fraction > 1) {
    throw new Error(
      `Invalid fraction value: ${fraction}. Must be between 0 and 1.`
    );
  }
  return Math.round(fraction * 1000);
}

// =============================================================================
// DISPLAY FORMATTING
// =============================================================================

/**
 * Format purity for display based on metal type
 * @example formatPurityForDisplay("GOLD", 0.875) // returns "21K"
 * @example formatPurityForDisplay("SILVER", 0.925) // returns "925"
 */
export function formatPurityForDisplay(
  metalType: MetalType,
  fraction: number
): string {
  switch (metalType) {
    case "GOLD":
      return `${fractionToKarat(fraction)}K`;
    case "SILVER":
    case "PLATINUM":
    case "PALLADIUM":
      return `${fractionToFineness(fraction)}`;
    default:
      return `${Math.round(fraction * 100)}%`;
  }
}

/**
 * Get purity options for UI picker based on metal type
 */
export function getPurityOptionsForMetal(
  metalType: MetalType
): readonly GoldPurityOption[] | readonly FinenessOption[] {
  if (metalType === "GOLD") {
    return GOLD_PURITY_OPTIONS;
  }
  return FINENESS_OPTIONS;
}

/**
 * Convert user input to fraction based on metal type
 * @param metalType - The type of metal
 * @param userInput - Karat (for gold) or fineness (for others)
 */
export function userInputToFraction(
  metalType: MetalType,
  userInput: number
): number {
  if (metalType === "GOLD") {
    return karatToFraction(userInput);
  }
  return finenessToFraction(userInput);
}

/**
 * Convert fraction to user-friendly value based on metal type
 * @param metalType - The type of metal
 * @param fraction - Purity as fraction (0-1)
 * @returns Karat (for gold) or fineness (for others)
 */
export function fractionToUserValue(
  metalType: MetalType,
  fraction: number
): number {
  if (metalType === "GOLD") {
    return fractionToKarat(fraction);
  }
  return fractionToFineness(fraction);
}
