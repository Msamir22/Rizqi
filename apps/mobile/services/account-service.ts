/**
 * Account Service
 *
 * Service functions for account management operations.
 * Handles Cash account creation and lookup with idempotency guarantees.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service Layer (plain async functions, no React hooks)
 * - SOLID: SRP — handles account CRUD only, no UI concerns
 * - Currency-aware idempotency: checks both type AND currency to prevent
 *   duplicates while allowing multi-currency cash accounts.
 *
 * @module account-service
 */

import { detectCurrencyFromTimezone } from "@/utils/currency-detection";
import { logger } from "@/utils/logger";
import { Account, type CurrencyType, database } from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of the ensureCashAccount operation. */
export interface EnsureCashAccountResult {
  /** Whether a new Cash account was created (false if one already existed). */
  readonly created: boolean;
  /** The ID of the Cash account (existing or newly created). Null on error. */
  readonly accountId: string | null;
  /** Error message if the operation failed. */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASH_ACCOUNT_NAME = "Cash";
const CASH_ACCOUNT_TYPE = "CASH";

/** Sentinel error code returned when currency cannot be determined. */
export const CURRENCY_UNKNOWN_ERROR = "CURRENCY_UNKNOWN";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check-and-create a Cash account inside an ALREADY-OPEN writer.
 *
 * This is the non-writer helper that `ensureCashAccount` and
 * `confirmCurrencyAndOnboard` share. Callers MUST be inside a
 * `database.write()` block — this function does NOT open its own.
 *
 * @returns The account ID (existing or newly created).
 */
export async function createCashAccountWithinWriter(
  userId: string,
  currency: CurrencyType,
  accountsCollection: ReturnType<typeof database.get<Account>>,
  name?: string
): Promise<{ readonly accountId: string; readonly created: boolean }> {
  const normalizedUserId = userId.trim();

  const existing = await accountsCollection
    .query(
      Q.where("type", CASH_ACCOUNT_TYPE),
      Q.where("user_id", normalizedUserId),
      Q.where("currency", currency),
      Q.where("deleted", Q.notEq(true)),
      Q.sortBy("created_at", Q.asc)
    )
    .fetch();

  if (existing.length > 0) {
    return { accountId: existing[0].id, created: false };
  }

  const record = await accountsCollection.create((acc) => {
    acc.userId = normalizedUserId;
    acc.name = name?.trim() || CASH_ACCOUNT_NAME;
    acc.type = CASH_ACCOUNT_TYPE;
    acc.currency = currency;
    acc.balance = 0;
    acc.deleted = false;
  });
  return { accountId: record.id, created: true };
}

/**
 * Ensure a Cash account exists for the given user in the specified currency.
 *
 * Idempotent: if a CASH-type account in the same currency already exists,
 * returns it without creating a duplicate.
 *
 * This function never throws — errors are captured in the result
 * object to support retry-safe fire-and-forget usage.
 *
 * @param userId - The authenticated user's ID
 * @param currency - Optional explicit currency. Falls back to timezone detection.
 *                   Returns CURRENCY_UNKNOWN error if both are null.
 * @param name - Optional custom name for the cash account (defaults to 'Cash').
 *               Only used during creation — existing accounts are returned as-is.
 * @returns Result with created flag and account ID
 */
export async function ensureCashAccount(
  userId: string,
  currency?: CurrencyType | null,
  name?: string
): Promise<EnsureCashAccountResult> {
  try {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return { created: false, accountId: null, error: "USER_ID_REQUIRED" };
    }

    // Resolve currency: explicit param > timezone detection
    const resolvedCurrency = currency ?? detectCurrencyFromTimezone();
    if (!resolvedCurrency) {
      return {
        created: false,
        accountId: null,
        error: CURRENCY_UNKNOWN_ERROR,
      };
    }

    let accountId: string | null = null;
    let created = false;

    await database.write(async () => {
      const accountsCollection = database.get<Account>("accounts");
      const result = await createCashAccountWithinWriter(
        normalizedUserId,
        resolvedCurrency,
        accountsCollection,
        name
      );
      accountId = result.accountId;
      created = result.created;
    });

    return { created, accountId };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error creating Cash account";
    logger.error("ensureCashAccount failed", { message });
    return { created: false, accountId: null, error: message };
  }
}

/**
 * Look up the first existing Cash account for the given user.
 *
 * Does NOT create a new account — use {@link ensureCashAccount}
 * for create-if-missing semantics.
 *
 * @param userId - The authenticated user's ID
 * @returns The Cash account ID, or null if none exists
 * Note: Unlike ensureCashAccount, this returns the first Cash account
 * regardless of currency (sorted by created_at ascending).
 */
export async function findCashAccount(userId: string): Promise<string | null> {
  try {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }

    const accountsCollection = database.get<Account>("accounts");
    const existing = await accountsCollection
      .query(
        Q.where("type", CASH_ACCOUNT_TYPE),
        Q.where("user_id", normalizedUserId),
        Q.where("deleted", Q.notEq(true)),
        Q.sortBy("created_at", Q.asc)
      )
      .fetch();

    return existing.length > 0 ? existing[0].id : null;
  } catch (error: unknown) {
    logger.error(
      "findCashAccount failed",
      error instanceof Error ? { message: error.message } : { error }
    );
    return null;
  }
}
