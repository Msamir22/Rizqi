/**
 * Batch SMS Transaction Creator
 *
 * Saves confirmed SMS transactions to WatermelonDB in a single
 * atomic batch write. Resolves category system names to category IDs,
 * sets source to "SMS", and updates account balances.
 *
 * ATM withdrawals are automatically processed as transfers (bank → cash)
 * rather than expenses, keeping both account balances accurate.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service Function (stateless, pure I/O)
 * - Why: Keeps DB write logic out of components (SRP).
 *   Single atomic batch write using prepareCreate/prepareUpdate
 *   ensures all-or-nothing semantics — no partial saves on error.
 * - SOLID: Open/Closed — new transaction sources can use the
 *   same createTransaction pattern without modifying this function.
 * - Performance: O(1) database write actions instead of O(n).
 *   All records are prepared in-memory then flushed in a single
 *   database.batch() call, reducing lock acquire/release overhead
 *   from N times to exactly 1.
 *
 * @module batch-sms-transactions
 */

import {
  Account,
  database,
  Transaction,
  Transfer,
  type Category,
  type CurrencyType,
} from "@astik/db";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Q, type Model } from "@nozbe/watermelondb";
import { ensureCashAccount } from "./account-service";
import { getCurrentUserId } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchSaveResult {
  readonly savedCount: number;
  readonly failedCount: number;
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Category resolution cache
// ---------------------------------------------------------------------------

/**
 * Build a Map from category system_name → category.id.
 * Fetches all categories once to avoid N+1 lookups.
 */

// TODO: is this is the right place for this function?
async function buildCategoryMap(): Promise<ReadonlyMap<string, string>> {
  const categories = await database
    .get<Category>("categories")
    .query(Q.where("deleted", Q.notEq(true)))
    .fetch();

  const map = new Map<string, string>();
  for (const cat of categories) {
    if (cat.systemName) {
      map.set(cat.systemName, cat.id);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Balance delta accumulator
// ---------------------------------------------------------------------------

/**
 * Accumulate a signed balance delta for a given account ID.
 * If the account already has a delta, the new value is added.
 */
// TODO: Move this to a utility file.
function accumulateBalanceDelta(
  deltas: Map<string, number>,
  accountId: string,
  delta: number
): void {
  const existing = deltas.get(accountId) ?? 0;
  deltas.set(accountId, existing + delta);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save confirmed SMS transactions to the database.
 *
 * Each transaction is routed to the correct account via the
 * `transactionAccountMap` (index → accountId), built by the
 * review page's batched resolution.
 *
 * ATM withdrawals (isAtmWithdrawal === true) are automatically
 * processed as transfers from the bank account to a Cash account.
 *
 * Performance: All records are created and all account balances
 * updated in a single atomic `database.batch()` call, reducing
 * the operation from O(n) write actions to O(1).
 *
 * @param transactions          - Selected, potentially edited transactions
 * @param transactionAccountMap - Mapping from transaction index → account ID
 * @returns Summary of saved/failed counts
 */
export async function batchCreateSmsTransactions(
  transactions: readonly ParsedSmsTransaction[],
  transactionAccountMap: ReadonlyMap<number, string>
): Promise<BatchSaveResult> {
  if (transactions.length === 0) {
    return { savedCount: 0, failedCount: 0, errors: [] };
  }

  // ── Pre-batch lookups (outside the write block) ──────────────────────

  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      savedCount: 0,
      failedCount: transactions.length,
      errors: ["User not authenticated"],
    };
  }

  const categoryMap = await buildCategoryMap();
  const errors: string[] = [];

  // Ensure Cash accounts exist for ATM withdrawal routing
  const cashAccountIdByCurrency = new Map<string, string>();
  const atmCurrencies = new Set<string>();

  for (const tx of transactions) {
    if (tx.isAtmWithdrawal) {
      atmCurrencies.add(tx.currency);
    }
  }

  for (const currency of atmCurrencies) {
    const result = await ensureCashAccount(userId, currency as CurrencyType);
    if (result.accountId) {
      cashAccountIdByCurrency.set(currency, result.accountId);
    } else {
      errors.push(
        `Failed to ensure cash account for currency ${currency}: ${result.error}`
      );
    }
  }

  // ── Prepare all operations in-memory ─────────────────────────────────

  const transactionsCollection = database.get<Transaction>("transactions");
  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  const preparedOps: Model[] = [];
  const balanceDeltas = new Map<string, number>();
  let savedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const accountId = transactionAccountMap.get(i);

    if (!accountId) {
      errors.push(
        `No account mapped for transaction index ${i} (${tx.counterparty})`
      );
      failedCount++;
      continue;
    }

    // ── ATM Withdrawal: prepare as Transfer (bank → cash) ──
    if (tx.isAtmWithdrawal) {
      const cashAccountId = cashAccountIdByCurrency.get(tx.currency);

      if (!cashAccountId) {
        errors.push(
          `Skipped ATM withdrawal index ${i} — failed to resolve Cash account in ${tx.currency}`
        );
        failedCount++;
        continue;
      }

      preparedOps.push(
        transfersCollection.prepareCreate((t) => {
          t.userId = userId;
          t.fromAccountId = accountId;
          t.toAccountId = cashAccountId;
          t.amount = Math.abs(tx.amount);
          t.currency = tx.currency;
          t.date = new Date(tx.date);
          t.notes = `ATM Withdrawal`;
          t.smsBodyHash = tx.smsBodyHash;
          t.deleted = false;
        })
      );

      // Transfer balance effects: debit from-account, credit to-account
      const amount = Math.abs(tx.amount);
      accumulateBalanceDelta(balanceDeltas, accountId, -amount);
      accumulateBalanceDelta(balanceDeltas, cashAccountId, amount);

      savedCount++;
      continue;
    }

    // ── Regular transaction ──
    const categoryId = categoryMap.get(tx.categorySystemName);
    const resolvedCategoryId =
      categoryId ??
      categoryMap.get("other") ??
      categoryMap.get("general") ??
      categoryMap.get("uncategorized");

    if (!resolvedCategoryId) {
      errors.push(
        `No category found for "${tx.categorySystemName}" (${tx.counterparty})`
      );
      failedCount++;
      continue;
    }

    preparedOps.push(
      transactionsCollection.prepareCreate((record) => {
        record.userId = userId;
        record.accountId = accountId;
        record.amount = Math.abs(tx.amount);
        record.currency = tx.currency;
        record.type = tx.type;
        record.categoryId = resolvedCategoryId;
        record.counterparty = tx.counterparty || undefined;
        record.note = "";
        record.date = tx.date;
        record.source = "SMS";
        record.smsBodyHash = tx.smsBodyHash;
        record.isDraft = false;
        record.deleted = false;
      })
    );

    // Balance effects
    const amount = Math.abs(tx.amount);
    if (tx.type === "EXPENSE") {
      accumulateBalanceDelta(balanceDeltas, accountId, -amount);
    } else {
      accumulateBalanceDelta(balanceDeltas, accountId, amount);
    }

    savedCount++;
  }

  // ── Batch-fetch all affected accounts and prepare balance updates ────

  const accountIds = Array.from(balanceDeltas.keys());
  if (accountIds.length > 0) {
    const accounts = await accountsCollection
      .query(Q.where("id", Q.oneOf(accountIds)))
      .fetch();

    for (const account of accounts) {
      const delta = balanceDeltas.get(account.id);
      if (delta && delta !== 0) {
        preparedOps.push(
          account.prepareUpdate((a) => {
            a.balance = a.balance + delta || 0;
          })
        );
      }
    }
  }

  // ── Execute everything in a single atomic batch ──────────────────────

  if (preparedOps.length > 0) {
    await database.write(async () => {
      await database.batch(preparedOps);
    });
  }

  return { savedCount, failedCount, errors };
}
