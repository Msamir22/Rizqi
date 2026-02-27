/**
 * Account Service
 *
 * Service functions for account management operations.
 * Handles Cash account creation and lookup with idempotency guarantees.
 *
 * @module account-service
 */

import { detectCurrencyFromDevice } from "@/utils/currency-detection";
import { Account, database } from "@astik/db";
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
const CASH_ACCOUNT_TYPE = "CASH" as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure a Cash account exists for the given user.
 *
 * Idempotent: if a CASH-type account already exists, returns it
 * without creating a duplicate.
 *
 * This function never throws — errors are captured in the result
 * object to support retry-safe fire-and-forget usage (FR-005).
 *
 * @param userId - The authenticated user's ID
 * @returns Result with created flag and account ID
 */
export async function ensureCashAccount(
  userId: string
): Promise<EnsureCashAccountResult> {
  try {
    let accountId: string | null = null;
    let created = false;

    // Atomic check-and-create inside a single write block to prevent
    // TOCTOU races when called concurrently (e.g., index.tsx + onboarding.tsx).
    await database.write(async () => {
      const accountsCollection = database.get<Account>("accounts");
      const existing = await accountsCollection
        .query(
          Q.where("type", CASH_ACCOUNT_TYPE),
          Q.where("user_id", userId),
          Q.where("deleted", Q.notEq(true)),
          Q.sortBy("created_at", Q.asc)
        )
        .fetch();

      if (existing.length > 0) {
        accountId = existing[0].id;
        return;
      }

      const currency = detectCurrencyFromDevice();
      const record = await accountsCollection.create((acc) => {
        acc.userId = userId;
        acc.name = CASH_ACCOUNT_NAME;
        acc.type = CASH_ACCOUNT_TYPE;
        acc.currency = currency;
        acc.balance = 0;
        acc.deleted = false;
      });
      accountId = record.id;
      created = true;
    });

    return { created, accountId };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error creating Cash account";
    console.error("ensureCashAccount failed:", message);
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
 */
export async function findCashAccount(userId: string): Promise<string | null> {
  try {
    const accountsCollection = database.get<Account>("accounts");
    const existing = await accountsCollection
      .query(
        Q.where("type", CASH_ACCOUNT_TYPE),
        Q.where("user_id", userId),
        Q.where("deleted", Q.notEq(true)),
        Q.sortBy("created_at", Q.asc)
      )
      .fetch();

    return existing.length > 0 ? existing[0].id : null;
  } catch (error) {
    console.error("findCashAccount failed:", error);
    return null;
  }
}
