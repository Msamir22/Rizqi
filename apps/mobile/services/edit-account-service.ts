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
} from "@astik/db";
import { Q } from "@nozbe/watermelondb";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Well-known UUIDs for balance adjustment categories.
 * These are seeded in migration 032_seed_balance_adjustment_categories.sql.
 */
const BALANCE_ADJUSTMENT_INCOME_CATEGORY_ID =
  "00000000-0000-0000-0001-000000000200";
const BALANCE_ADJUSTMENT_EXPENSE_CATEGORY_ID =
  "00000000-0000-0000-0001-000000000201";

/** Tolerance for floating-point balance comparison. */
const BALANCE_EPSILON = 0.001;

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
    console.error("checkAccountNameUniqueness failed:", message);
    return { isUnique: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// T006: Update Account
// ---------------------------------------------------------------------------

/**
 * Update an account with new data.
 *
 * Handles the single-default-account constraint: when setting isDefault to true,
 * any previously default account for the same user is unset within the same
 * write block for atomicity.
 *
 * For bank-type accounts, also updates the associated bank_details record.
 *
 * @param accountId - The ID of the account to update
 * @param data - The new account data
 * @returns ServiceResult with success and optional error
 */
export async function updateAccount(
  accountId: string,
  data: UpdateAccountData
): Promise<ServiceResult> {
  try {
    await database.write(async () => {
      const accountsCollection = database.get<Account>("accounts");
      const existingAccount = await accountsCollection.find(accountId);

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
        const bankDetailRecords = await existingAccount.bankDetails.fetch();
        if (bankDetailRecords.length > 0) {
          const bankDetail = bankDetailRecords[0] as BankDetails;
          await bankDetail.update((bd) => {
            bd.bankName = data.bankName ?? "";
            bd.cardLast4 = data.cardLast4 ?? "";
            bd.smsSenderName = data.smsSenderName ?? "";
          });
        }
      }
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error updating account";
    console.error("updateAccount failed:", message);
    return { success: false, error: message };
  }
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
 * @param accountId - The ID of the account to delete
 * @returns ServiceResult with success and optional error
 */
export async function deleteAccountWithCascade(
  accountId: string
): Promise<ServiceResult> {
  try {
    await database.write(async () => {
      const accountsCollection = database.get<Account>("accounts");
      const transfersCollection = database.get<Transfer>("transfers");
      const account = await accountsCollection.find(accountId);

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

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error deleting account";
    console.error("deleteAccountWithCascade failed:", message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// T008: Create Balance Adjustment Transaction
// ---------------------------------------------------------------------------

/**
 * Create a transaction to track a balance adjustment.
 *
 * When a user edits an account balance and chooses "Track as Transaction",
 * this function creates a MANUAL transaction using the appropriate
 * balance adjustment category (income or expense) based on whether the
 * balance increased or decreased.
 *
 * @param accountId - The account whose balance was adjusted
 * @param userId - The authenticated user's ID
 * @param currency - The account's currency
 * @param previousBalance - The balance before the adjustment
 * @param newBalance - The balance after the adjustment
 * @returns ServiceResult with success and optional error
 */
export async function createBalanceAdjustmentTransaction(
  accountId: string,
  userId: string,
  currency: CurrencyType,
  previousBalance: number,
  newBalance: number
): Promise<ServiceResult> {
  try {
    const difference = newBalance - previousBalance;
    if (Math.abs(difference) < BALANCE_EPSILON) {
      return { success: true };
    }

    const isIncome = difference > 0;
    const categoryId = isIncome
      ? BALANCE_ADJUSTMENT_INCOME_CATEGORY_ID
      : BALANCE_ADJUSTMENT_EXPENSE_CATEGORY_ID;
    const transactionType: TransactionType = isIncome ? "INCOME" : "EXPENSE";

    await database.write(async () => {
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
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error creating balance adjustment transaction";
    console.error("createBalanceAdjustmentTransaction failed:", message);
    return { success: false, error: message };
  }
}
