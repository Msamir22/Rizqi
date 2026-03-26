/**
 * AI Parser Utilities
 *
 * Shared pure functions used by both AI Voice and AI SMS parser services.
 * Extracted to eliminate code duplication and improve testability.
 *
 * Architecture & Design Rationale:
 * - Pattern: Utility Module (shared pure functions)
 * - Why: Eliminates 5 duplicated functions across 2 services; pure functions
 *   with no side effects are easily testable.
 * - SOLID: SRP (each function has one concern), DIP (both services depend on
 *   abstractions, not each other)
 * - Algorithm: O(1) Set.has() for type validation, O(1) Map.get() for category lookup
 *
 * @module ai-parser-utils
 */

import type { Category, TransactionType } from "@astik/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Map from category systemName to its display info.
 * Built once from the user's Category[] and passed into parseCategory.
 */
export type CategoryMap = Map<
  Category["systemName"],
  { readonly name: Category["displayName"]; readonly id: Category["id"] }
>;

/**
 * Result of resolving an AI-returned category against the user's CategoryMap.
 */
export interface ResolvedCategory {
  readonly id: Category["id"];
  readonly displayName: Category["displayName"];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid transaction types for AI parsing. */
export const VALID_TYPES: ReadonlySet<string> = new Set<TransactionType>([
  "EXPENSE",
  "INCOME",
]);

/** Regex to detect date-only strings (YYYY-MM-DD) without time component. */
export const DATE_ONLY_REGEX: RegExp = /^\d{4}-\d{2}-\d{2}$/;

/** Default category system name when AI returns an unknown category. */
const FALLBACK_CATEGORY_SYSTEM_NAME = "other";

// ---------------------------------------------------------------------------
// Pure Functions
// ---------------------------------------------------------------------------

/**
 * Normalize an AI-returned transaction type string.
 * Uppercases the input and validates against VALID_TYPES.
 * Defaults to "EXPENSE" for unknown types (most common transaction type).
 *
 * @param raw - Raw type string from AI response
 * @returns Normalized TransactionType
 */
export function normalizeType(raw: string): TransactionType {
  const upper = raw.toUpperCase();
  if (VALID_TYPES.has(upper)) {
    return upper as TransactionType;
  }
  return "EXPENSE" as TransactionType;
}

/**
 * Parse an AI-returned date string into a Date object.
 *
 * Bare YYYY-MM-DD strings are treated as **local dates** (not UTC) to avoid
 * off-by-one day errors in positive UTC offset timezones (e.g., Egypt UTC+2).
 * Falls back to current timestamp if empty or unparseable.
 *
 * @param raw - Date string from AI response (ISO 8601 or YYYY-MM-DD)
 * @returns Parsed Date object
 */
export function parseAiDate(raw: string): Date {
  if (!raw || raw.trim() === "") {
    return new Date();
  }

  // Date-only strings: create in local timezone to avoid UTC midnight shift
  if (DATE_ONLY_REGEX.test(raw.trim())) {
    const [yearStr, monthStr, dayStr] = raw.trim().split("-");
    const localDate = new Date(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr)
    );
    if (!isNaN(localDate.getTime())) {
      return localDate;
    }
    return new Date();
  }

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

/**
 * Clamp a confidence score to the [0, 1] range.
 *
 * @param score - Raw confidence score from AI response
 * @returns Clamped score between 0 and 1
 */
export function clampConfidence(score: number): number {
  return Math.min(1, Math.max(0, score));
}

/**
 * Validate and normalize an AI-returned category system_name.
 *
 * Looks up the category in the user's CategoryMap. Falls back to "other"
 * if the AI returned an unknown category. Returns null only if neither the
 * given category nor the "other" fallback exist.
 *
 * @param systemName - Category system_name from AI response
 * @param categoryMap - User's CategoryMap built from their Category[]
 * @returns Resolved category with id and displayName, or null if no fallback
 */
export function parseCategory(
  systemName: string,
  categoryMap: CategoryMap
): ResolvedCategory | null {
  const directMatch = categoryMap.get(systemName);
  if (directMatch) {
    return { id: directMatch.id, displayName: directMatch.name };
  }

  const fallback = categoryMap.get(FALLBACK_CATEGORY_SYSTEM_NAME);
  if (fallback) {
    return { id: fallback.id, displayName: fallback.name };
  }

  return null;
}

/**
 * Build a CategoryMap from a readonly array of Category objects.
 * Used to create the lookup map once before processing a batch of transactions.
 *
 * @param categories - User's categories from the database
 * @returns CategoryMap for O(1) category lookups
 */
export function buildCategoryMap(categories: readonly Category[]): CategoryMap {
  const map: CategoryMap = new Map();
  for (const cat of categories) {
    map.set(cat.systemName, { name: cat.displayName, id: cat.id });
  }
  return map;
}
