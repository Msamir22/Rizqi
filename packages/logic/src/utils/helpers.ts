/**
 * Calculate the same day from the previous month
 * Example: 2026-01-13 -> 2025-12-13
 */
export function getSameDayLastMonth(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const day = today.getDate();

  // Create a date for the same day last month
  const lastMonth = new Date(year, month - 1, day);

  // Handle edge case: if the day doesn't exist in the previous month
  // (e.g., Jan 31 -> Feb doesn't have 31), it will roll over
  // We want to get the last valid day of the previous month instead
  if (lastMonth.getDate() !== day) {
    // Day rolled over, so get last day of previous month
    const lastDayOfPrevMonth = new Date(year, month, 0);
    return lastDayOfPrevMonth.toISOString().split("T")[0];
  }

  return lastMonth.toISOString().split("T")[0];
}

/**
 * Case-insensitive bidirectional substring check.
 * Returns true if either string contains the other.
 *
 * Examples:
 *   isSubstringMatch("QNB", "QNB EGYPT")  → true ("QNB EGYPT" contains "QNB")
 *   isSubstringMatch("Bank CIB", "CIB")   → true ("Bank CIB" contains "CIB")
 *   isSubstringMatch("Vodafone", "QNB")    → false
 */
export function isSubstringMatch(a: string, b: string): boolean {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower.length === 0 || bLower.length === 0) return false;
  return aLower.includes(bLower) || bLower.includes(aLower);
}
