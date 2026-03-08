/**
 * Signup Prompt Service — Persistence & Query Layer
 *
 * Encapsulates all AsyncStorage reads/writes and WatermelonDB queries
 * for the sign-up prompt feature. Keeps the useSignUpPrompt hook as
 * a thin React wrapper.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service-Layer Separation (Constitution IV)
 * - Why: Persistence logic does not belong in hooks or components.
 *   Extracting it makes the logic independently testable and reusable.
 * - SOLID: SRP — this service only handles prompt data operations.
 *
 * Performance: checkShouldShowPrompt() runs cheap AsyncStorage +
 * fetchCount() checks first. The expensive totalAmount computation
 * (full table scan) only runs when the prompt will actually show.
 *
 * @module signup-prompt-service
 */

import {
  FIRST_USE_DATE_KEY,
  SIGNUP_COOLDOWN_DAYS,
  SIGNUP_COOLDOWN_TX,
  SIGNUP_DAYS_THRESHOLD,
  SIGNUP_PROMPT_DISMISSED_AT_KEY,
  SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY,
  SIGNUP_PROMPT_NEVER_SHOW_KEY,
  SIGNUP_TX_THRESHOLD,
} from "@/constants/storage-keys";
import AsyncStorage from "@react-native-async-storage/async-storage";

// =============================================================================
// Types
// =============================================================================

export interface UserStats {
  readonly transactionCount: number;
  readonly accountCount: number;
  readonly totalAmount: number;
}

interface PromptCheckResult {
  readonly shouldShow: boolean;
  readonly stats: UserStats;
}

// =============================================================================
// Constants
// =============================================================================

const MS_PER_DAY = 86_400_000;

// =============================================================================
// Public API
// =============================================================================

/**
 * Check whether the sign-up urgency prompt should be displayed.
 *
 * Performance strategy:
 * 1. Cheap: AsyncStorage permanent-dismiss check
 * 2. Cheap: fetchCount() for transaction/account counts
 * 3. Cheap: AsyncStorage cooldown/threshold checks
 * 4. Expensive (only if shouldShow=true): full-scan for totalAmount
 */
export async function checkShouldShowPrompt(): Promise<PromptCheckResult> {
  // 1. Check permanent dismiss (cheapest check)
  const neverShow = await AsyncStorage.getItem(SIGNUP_PROMPT_NEVER_SHOW_KEY);
  if (neverShow === "true") {
    return { shouldShow: false, stats: emptyStats() };
  }

  // 2. Get cheap counts from WatermelonDB (no full scan)
  const counts = await getCheapCounts();

  // 3. Get dismissal state
  const dismissedAt = await AsyncStorage.getItem(
    SIGNUP_PROMPT_DISMISSED_AT_KEY
  );
  const dismissedTxCount = await AsyncStorage.getItem(
    SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY
  );

  // 4. Get first-use date
  const firstUseDate = await getFirstUseDate();

  // 5. Determine shouldShow based on cheap data
  let shouldShow = false;

  if (dismissedAt && dismissedTxCount) {
    // User previously dismissed — check cooldown
    const daysSinceDismiss = getDaysBetween(
      new Date(dismissedAt),
      new Date()
    );
    const txSinceDismiss =
      counts.transactionCount - parseInt(dismissedTxCount, 10);

    shouldShow =
      txSinceDismiss >= SIGNUP_COOLDOWN_TX ||
      daysSinceDismiss >= SIGNUP_COOLDOWN_DAYS;
  } else {
    // Never dismissed — check initial thresholds
    const daysSinceFirstUse = getDaysBetween(firstUseDate, new Date());
    shouldShow =
      counts.transactionCount >= SIGNUP_TX_THRESHOLD ||
      daysSinceFirstUse >= SIGNUP_DAYS_THRESHOLD;
  }

  // 6. Only compute totalAmount (expensive) when prompt will show
  const totalAmount = shouldShow ? await computeTotalAmount() : 0;

  return {
    shouldShow,
    stats: {
      transactionCount: counts.transactionCount,
      accountCount: counts.accountCount,
      totalAmount,
    },
  };
}

/**
 * Save a cooldown dismissal ("Skip for now").
 * Records the current timestamp and transaction count.
 */
export async function saveCooldownDismissal(
  currentTxCount: number
): Promise<void> {
  await AsyncStorage.setItem(
    SIGNUP_PROMPT_DISMISSED_AT_KEY,
    new Date().toISOString()
  );
  await AsyncStorage.setItem(
    SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY,
    String(currentTxCount)
  );
}

/**
 * Save a permanent dismissal ("Never show this again").
 */
export async function savePermanentDismissal(): Promise<void> {
  await AsyncStorage.setItem(SIGNUP_PROMPT_NEVER_SHOW_KEY, "true");
}

/**
 * Compute totalAmount lazily. Exported for cases where the caller
 * needs to refresh totalAmount independently (e.g., after the sheet
 * is already shown and stats change).
 */
export async function getUserTotalAmount(): Promise<number> {
  return computeTotalAmount();
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Get cheap aggregate counts (no full table scan).
 * Uses WatermelonDB's fetchCount() which translates to SQL COUNT(*).
 */
async function getCheapCounts(): Promise<{
  transactionCount: number;
  accountCount: number;
}> {
  try {
    const { database } = await import("@astik/db");

    const transactionCount = await database
      .get("transactions")
      .query()
      .fetchCount();
    const accountCount = await database.get("accounts").query().fetchCount();

    return { transactionCount, accountCount };
  } catch {
    return { transactionCount: 0, accountCount: 0 };
  }
}

/**
 * Compute total tracked amount by full-scanning all transactions.
 * This is expensive and should only be called when the prompt will show.
 */
async function computeTotalAmount(): Promise<number> {
  try {
    const { database } = await import("@astik/db");

    const allTransactions = await database
      .get("transactions")
      .query()
      .fetch();

    let totalAmount = 0;
    for (const tx of allTransactions) {
      // WatermelonDB Model exposes _raw as a DirtyRaw (Record<string, unknown>)
      const raw = (tx as unknown as { _raw: Record<string, unknown> })._raw;
      const amount = Number(raw.amount);
      if (Number.isFinite(amount)) {
        totalAmount += Math.abs(amount);
      }
    }

    return totalAmount;
  } catch {
    return 0;
  }
}

/** Get the first use date, recording it if not yet set. */
async function getFirstUseDate(): Promise<Date> {
  const stored = await AsyncStorage.getItem(FIRST_USE_DATE_KEY);
  if (stored) {
    return new Date(stored);
  }

  // First time — record now
  const now = new Date().toISOString();
  await AsyncStorage.setItem(FIRST_USE_DATE_KEY, now);
  return new Date(now);
}

/** Calculate whole days between two dates. */
function getDaysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/** Empty stats default. */
function emptyStats(): UserStats {
  return { transactionCount: 0, accountCount: 0, totalAmount: 0 };
}
