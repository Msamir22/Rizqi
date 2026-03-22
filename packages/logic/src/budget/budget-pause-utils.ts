/**
 * Budget Pause Utilities
 *
 * Pure functions for filtering transactions against budget pause windows.
 * Used to implement "Freeze & Exclude": transactions occurring during
 * paused intervals are permanently excluded from spending calculations.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PauseInterval {
  /** Epoch milliseconds when the pause started */
  readonly from: number;
  /** Epoch milliseconds when the pause ended (resume time) */
  readonly to: number;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Check if a transaction date falls within any pause window.
 *
 * A transaction is excluded if:
 * 1. Its date falls within a completed pause interval [from, to], OR
 * 2. The budget is currently paused and the transaction date >= pausedAt
 *
 * @param txDateMs - Transaction date as epoch milliseconds
 * @param intervals - Array of completed pause intervals
 * @param pausedAtMs - Epoch ms of current pause start (undefined if not currently paused)
 * @returns true if the transaction should be excluded from spending
 */
export function isWithinPauseWindow(
  txDateMs: number,
  intervals: readonly PauseInterval[],
  pausedAtMs?: number
): boolean {
  // Check completed pause intervals
  for (const interval of intervals) {
    if (txDateMs >= interval.from && txDateMs <= interval.to) {
      return true;
    }
  }

  // Check if currently paused and transaction is after paused_at
  if (pausedAtMs !== undefined && txDateMs >= pausedAtMs) {
    return true;
  }

  return false;
}

/**
 * Filter an array of transaction-like objects, removing those that fall
 * within any pause window.
 *
 * Generic over any object that has a `date` property returning a Date.
 * This keeps the function decoupled from WatermelonDB model types.
 *
 * @param transactions - Array of objects with a `date: Date` property
 * @param intervals - Completed pause intervals
 * @param pausedAtMs - Current pause timestamp (epoch ms), undefined if not paused
 * @returns Filtered array excluding paused-window transactions
 */
export function filterExcludedTransactions<T extends { readonly date: Date }>(
  transactions: readonly T[],
  intervals: readonly PauseInterval[],
  pausedAtMs?: number
): T[] {
  if (intervals.length === 0 && pausedAtMs === undefined) {
    return [...transactions];
  }

  return transactions.filter(
    (tx) => !isWithinPauseWindow(tx.date.getTime(), intervals, pausedAtMs)
  );
}

/**
 * Build a validated PauseInterval from pause and resume timestamps.
 *
 * @param pausedAtMs - When the pause started (epoch ms)
 * @param resumedAtMs - When the pause ended (epoch ms)
 * @returns A validated PauseInterval
 * @throws Error if pausedAtMs >= resumedAtMs
 */
export function buildPauseInterval(
  pausedAtMs: number,
  resumedAtMs: number
): PauseInterval {
  if (pausedAtMs >= resumedAtMs) {
    throw new Error(
      `Invalid pause interval: from (${pausedAtMs}) must be before to (${resumedAtMs})`
    );
  }

  return { from: pausedAtMs, to: resumedAtMs };
}

/**
 * Parse a raw JSON string into a typed PauseInterval array.
 * Returns empty array on invalid input for resilience.
 *
 * @param raw - Raw JSON string from WatermelonDB
 * @returns Parsed and validated PauseInterval array
 */
export function parsePauseIntervals(
  raw: string | undefined | null
): readonly PauseInterval[] {
  if (!raw || raw === "[]") return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is PauseInterval =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).from === "number" &&
        typeof (item as Record<string, unknown>).to === "number"
    );
  } catch {
    return [];
  }
}
