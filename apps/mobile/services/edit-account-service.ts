/**
 * Edit Account Service
 *
 * Service functions for editing and deleting accounts.
 * Handles account updates, cascade deletes, balance adjustment tracking,
 * and account name uniqueness checks.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service Layer (plain async functions, no React hooks)
 * - SOLID: SRP — handles edit/delete operations only, no UI concerns
 * - Offline-First: All operations use WatermelonDB's markAsDeleted()
 *   for sync-safe soft deletes.
 *
 * @module edit-account-service
 */

import {
  Account,
  BankDetails,
  Transaction,
  Transfer,
  database,
  type CurrencyType,
  type TransactionType,
} from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";
import { t } from "i18next";
import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Well-known UUIDs for balance-adjustment categories.
 *
 * These are seeded by `supabase/migrations/032_seed_balance_adjustment_categories.sql`
 * and form a stable contract between the migration and this service. They are
 * intentionally hardcoded rather than looked up by name because:
 *
 * 1. Determinism — the IDs are fixed by the migration, not generated at
 *    runtime. There is no environment in which they differ.
 * 2. Performance — every balance-adjustment write would otherwise need an
 *    extra `categories` query (or a startup cache layer) to resolve them.
 * 3. Fail-fast — if the seed is ever missing, the foreign-key on
 *    `transactions.category_id` rejects the insert immediately, surfacing
 *    the breakage at write time rather than allowing a silent fallback.
 *
 * If the migration ever changes the UUIDs, both files must move in lockstep.
 */
const BALANCE_ADJUSTMENT_INCOME_CATEGORY_ID =
  "00000000-0000-0000-0001-000000000200";
const BALANCE_ADJUSTMENT_EXPENSE_CATEGORY_ID =
  "00000000-0000-0000-0001-000000000201";

/** Tolerance for floating-point balance comparison. */
const BALANCE_EPSILON = 0.001;

/**
 * Typed error codes returned via {@link ServiceResult}.error.
 *
 * `OWNERSHIP_FAILED` — the requested account exists locally but its
 * `user_id` does not match the caller. Defense-in-depth on top of
 * Supabase RLS: we never write to another user's row even if a
 * foreign id reaches the service via deep-link or stale local SQLite.
 *
 * `NOT_FOUND` — the account id has no corresponding row.
 */
export const EDIT_ACCOUNT_ERROR_CODES = {
  OWNERSHIP_FAILED: "OWNERSHIP_FAILED",
  NOT_FOUND: "NOT_FOUND",
} as const;
export type EditAccountErrorCode =
  (typeof EDIT_ACCOUNT_ERROR_CODES)[keyof typeof EDIT_ACCOUNT_ERROR_CODES];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Data required to update an account. */
export interface UpdateAccountData {
  readonly name: string;
  readonly balance: number;
  readonly isDefault: boolean;
  readonly bankName?: string;
  readonly cardLast4?: string;
  readonly smsSenderName?: string;
}

/** Result of a service operation. */
export interface ServiceResult {
  readonly success: boolean;
  readonly error?: string;
}

/** Result of a uniqueness check. */
export interface UniquenessCheckResult {
  readonly isUnique: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// T005: Account Name Uniqueness Check
// ---------------------------------------------------------------------------

/**
 * Check whether an account name + currency combination is unique for a user.
 *
 * Excludes the current account being edited (if provided) from the check.
 * Only checks against non-deleted accounts.
 *
 * @param userId - The authenticated user's ID
 * @param name - The account name to check
 * @param currency - The account's currency
 * @param excludeAccountId - The current account ID to exclude from the check
 * @returns UniquenessCheckResult with isUnique and optional error
 */
export async function checkAccountNameUniqueness(
  userId: string,
  name: string,
  currency: CurrencyType,
  excludeAccountId?: string
): Promise<UniquenessCheckResult> {
  try {
    const trimmedName = name.trim().toLowerCase();
    if (!trimmedName) {
      return { isUnique: true };
    }

    const accountsCollection = database.get<Account>("accounts");

    const conditions = [
      Q.where("user_id", userId),
      Q.where("currency", currency),
      Q.where("deleted", Q.notEq(true)),
    ];

    if (excludeAccountId) {
      conditions.push(Q.where("id", Q.notEq(excludeAccountId)));
    }

    const existingAccounts = await accountsCollection
      .query(...conditions)
      .fetch();

    // Case-insensitive name comparison — WatermelonDB doesn't support
    // case-insensitive queries, so we filter in JS.
    const isDuplicate = existingAccounts.some(
      (account) => account.name.trim().toLowerCase() === trimmedName
    );

    return { isUnique: !isDuplicate };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error checking account name uniqueness";
    logger.error("checkAccountNameUniqueness_failed", error);
    return { isUnique: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// T006: Update Account
// ---------------------------------------------------------------------------

/**
 * Update an account inside an already-open `database.write` block.
 *
 * Mirrors the `createCashAccountWithinWriter` pattern in `account-service.ts`:
 * this helper performs all the work of an update minus the `database.write`
 * wrapper, so callers can compose it with other writes (e.g., a
 * balance-adjustment transaction) atomically.
 *
 * Throws on failure — callers rely on WatermelonDB's rollback semantics so
 * any throw inside the writer aborts the whole batch.
 *
 * Performs an ownership check before writing — if the account's `userId`
 * does not match `currentUserId`, returns `OWNERSHIP_FAILED` and performs
 * no writes.
 *
 * @param accountId - The ID of the account to update
 * @param data - The new account data
 * @param currentUserId - The authenticated user's id (for the ownership check)
 * @returns The account's balance as it stood **before** this update applied.
 *   Callers that pair this with a balance-adjustment transaction MUST use
 *   this returned value as the previous balance — never form-state values,
 *   which can be stale if another flow (e.g., sync) moved the balance while
 *   the form was open.
 */
export async function updateAccountWithinWriter(
  accountId: string,
  data: UpdateAccountData,
  currentUserId: string
): Promise<{ readonly previousBalance: number }> {
  const accountsCollection = database.get<Account>("accounts");

  let existingAccount: Account;
  try {
    existingAccount = await accountsCollection.find(accountId);
  } catch {
    logger.error(`Account not found (ID: ${accountId})`);
    throw new Error(t("account_not_found"));
  }

  if (existingAccount.userId !== currentUserId) {
    logger.error(
      `Attempted to update account with mismatched userId (ID: ${accountId})`
    );
    throw new Error(EDIT_ACCOUNT_ERROR_CODES.OWNERSHIP_FAILED);
  }

  if (existingAccount.deleted) {
    logger.error(`Attempted to update deleted account (ID: ${accountId})`);
    throw new Error(t("accounts:cannot_update_deleted_account"));
  }

  // Snapshot BEFORE mutating — this is the source of truth for any paired
  // balance-adjustment transaction (defends against stale form state).
  const previousBalance = existingAccount.balance;

  // If setting as default, unset any current default for this user
  if (data.isDefault && !existingAccount.isDefault) {
    const currentDefaults = await accountsCollection
      .query(
        Q.where("user_id", existingAccount.userId),
        Q.where("is_default", true),
        Q.where("deleted", Q.notEq(true)),
        Q.where("id", Q.notEq(accountId))
      )
      .fetch();

    for (const defaultAccount of currentDefaults) {
      await defaultAccount.update((acc) => {
        acc.isDefault = false;
      });
    }
  }

  // Update account fields
  await existingAccount.update((acc) => {
    acc.name = data.name.trim();
    acc.balance = data.balance;
    acc.isDefault = data.isDefault;
  });

  // Update bank details if this is a bank account
  if (existingAccount.isBank) {
    const bankDetailRecords =
      (await existingAccount.bankDetails.fetch()) as BankDetails[];

    const activeBankDetail = bankDetailRecords.find(
      (record) => record.deleted !== true
    );

    if (activeBankDetail) {
      await activeBankDetail.update((bd) => {
        bd.bankName = data.bankName;
        bd.cardLast4 = data.cardLast4;
        bd.smsSenderName = data.smsSenderName;
      });
    } else {
      await database.get<BankDetails>("bank_details").create((bd) => {
        bd.accountId = accountId;
        bd.bankName = data.bankName;
        bd.cardLast4 = data.cardLast4;
        bd.smsSenderName = data.smsSenderName;
        bd.deleted = false;
      });
    }
  }

  return { previousBalance };
}

// ---------------------------------------------------------------------------
// T007: Delete Account With Cascade
// ---------------------------------------------------------------------------

/**
 * Cascade soft-deletes an account and all related records.
 *
 * Deletes in this order within a single write block:
 * 1. bank_details
 * 2. transactions
 * 3. transfers (where account is from_account OR to_account)
 * 4. debts
 * 5. recurring_payments
 * 6. The account itself
 *
 * Uses markAsDeleted() for sync-safe soft deletes.
 *
 * Performs an ownership check before any cascade — if the account's
 * `userId` does not match `currentUserId`, returns `OWNERSHIP_FAILED`
 * and performs no writes.
 *
 * @param accountId - The ID of the account to delete
 * @param currentUserId - The authenticated user's id (for the ownership check)
 * @returns ServiceResult with success and optional error code
 */
export async function deleteAccountWithCascade(
  accountId: string,
  currentUserId: string
): Promise<ServiceResult> {
  try {
    let ownershipFailed = false;
    let notFound = false;

    await database.write(async () => {
      const accountsCollection = database.get<Account>("accounts");
      const transfersCollection = database.get<Transfer>("transfers");

      let account: Account;
      try {
        account = await accountsCollection.find(accountId);
      } catch {
        notFound = true;
        return;
      }

      if (account.userId !== currentUserId) {
        ownershipFailed = true;
        return;
      }

      // 1. Mark bank_details as deleted
      const bankDetailRecords = await account.bankDetails.fetch();
      for (const record of bankDetailRecords) {
        await record.markAsDeleted();
      }

      // 2. Mark transactions as deleted
      const transactionRecords = await account.transactions.fetch();
      for (const record of transactionRecords) {
        await record.markAsDeleted();
      }

      // 3. Mark transfers as deleted (both directions)
      // Account.transfers only covers from_account_id via @children,
      // so we need a separate query for to_account_id.
      const fromTransfers = await account.transfers.fetch();
      for (const record of fromTransfers) {
        await record.markAsDeleted();
      }

      const toTransfers = await transfersCollection
        .query(Q.where("to_account_id", accountId))
        .fetch();
      for (const record of toTransfers) {
        await record.markAsDeleted();
      }

      // 4. Mark debts as deleted
      const debtRecords = await account.debts.fetch();
      for (const record of debtRecords) {
        await record.markAsDeleted();
      }

      // 5. Mark recurring_payments as deleted
      const recurringPaymentRecords = await account.recurringPayments.fetch();
      for (const record of recurringPaymentRecords) {
        await record.markAsDeleted();
      }

      // 6. Clear is_default flag if this was the default account.
      // Per business decision: do NOT auto-promote another account.
      // The user must set a new default manually.
      if (account.isDefault) {
        await account.update((acc) => {
          acc.isDefault = false;
        });
      }

      // 7. Mark the account itself as deleted
      await account.markAsDeleted();
    });

    if (notFound) {
      return { success: false, error: EDIT_ACCOUNT_ERROR_CODES.NOT_FOUND };
    }
    if (ownershipFailed) {
      return {
        success: false,
        error: EDIT_ACCOUNT_ERROR_CODES.OWNERSHIP_FAILED,
      };
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error deleting account";
    logger.error("deleteAccountWithCascade_failed", error);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// T008: Create Balance Adjustment Transaction
// ---------------------------------------------------------------------------

/**
 * Create a balance-adjustment transaction inside an already-open
 * `database.write` block.
 *
 * Skips creation entirely when the balance change is below
 * `BALANCE_EPSILON` (no-op for floating-point noise).
 *
 * Throws on failure so the surrounding writer rolls back.
 *
 * @returns `true` if a transaction was actually created, `false` if skipped
 *          due to a sub-epsilon balance delta.
 */
async function createBalanceAdjustmentTransactionWithinWriter(
  accountId: string,
  userId: string,
  currency: CurrencyType,
  previousBalance: number,
  newBalance: number
): Promise<boolean> {
  const difference = newBalance - previousBalance;
  if (Math.abs(difference) < BALANCE_EPSILON) {
    return false;
  }

  const isIncome = difference > 0;
  const categoryId = isIncome
    ? BALANCE_ADJUSTMENT_INCOME_CATEGORY_ID
    : BALANCE_ADJUSTMENT_EXPENSE_CATEGORY_ID;
  const transactionType: TransactionType = isIncome ? "INCOME" : "EXPENSE";

  const transactionsCollection = database.get<Transaction>("transactions");

  await transactionsCollection.create((tx) => {
    tx.userId = userId;
    tx.accountId = accountId;
    tx.amount = Math.abs(difference);
    tx.currency = currency;
    tx.type = transactionType;
    tx.categoryId = categoryId;
    tx.date = new Date();
    tx.source = "MANUAL";
    tx.isDraft = false;
    tx.deleted = false;
    tx.note = `Balance adjustment: ${previousBalance} \u2192 ${newBalance}`;
  });

  return true;
}

// ---------------------------------------------------------------------------
// Atomic update + balance-adjustment
// ---------------------------------------------------------------------------

/**
 * Optional balance-adjustment payload paired with an account update.
 *
 * Note: there is no `previousBalance` field. The previous balance is taken
 * from the live account row inside the writer batch \u2014 passing a form-state
 * value would risk silent corruption when another flow (e.g., sync) moved
 * the balance while the form was open.
 */
export interface BalanceAdjustmentPayload {
  readonly userId: string;
  readonly currency: CurrencyType;
}

/**
 * Update an account and (optionally) record the balance change as a
 * transaction in a single `database.write` block.
 *
 * Either both rows commit or neither does \u2014 if the transaction insert fails,
 * the account row update is rolled back so the ledger never diverges from the
 * stored balance.
 *
 * The balance-adjustment delta is computed from the **live** pre-update
 * balance (captured inside the writer) and `data.balance`. Callers do not
 * pass a `previousBalance` \u2014 this defends against stale form state if the
 * balance was moved by another flow (e.g., sync) while the form was open.
 *
 * @param accountId - The ID of the account to update
 * @param data - The new account data (the new balance is `data.balance`)
 * @param adjustment - When non-null, also creates a balance-adjustment
 *   transaction within the same writer batch.
 * @returns ServiceResult with success and optional error
 */
export async function updateAccountWithBalanceAdjustment(
  accountId: string,
  userId: string,
  data: UpdateAccountData,
  adjustment: BalanceAdjustmentPayload | null
): Promise<ServiceResult> {
  try {
    await database.write(async () => {
      const { previousBalance } = await updateAccountWithinWriter(
        accountId,
        data,
        userId
      );
      if (adjustment !== null) {
        await createBalanceAdjustmentTransactionWithinWriter(
          accountId,
          adjustment.userId,
          adjustment.currency,
          previousBalance,
          data.balance
        );
      }
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error creating balance adjustment transaction";
    logger.error("createBalanceAdjustmentTransaction_failed", error);
    return { success: false, error: message };
  }
}
