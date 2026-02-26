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
} from "@astik/db";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Q, type Model } from "@nozbe/watermelondb";
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
// Cash account helper
// ---------------------------------------------------------------------------

/**
 * Find or create a "Cash" account for the current user.
 * Used as the destination for ATM withdrawals / cash-outs.
 *
 * Architecture: Lazy creation — only creates on first ATM withdrawal,
 * avoiding unnecessary account clutter for users who never use ATMs.
 */
async function findOrCreateCashAccount(userId: string): Promise<string> {
  const accountsCollection = database.get<Account>("accounts");

  // Look for existing Cash account
  const existing = await accountsCollection
    .query(
      Q.where("type", "CASH"),
      Q.where("user_id", userId),
      Q.where("deleted", Q.notEq(true))
    )
    .fetch();

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Auto-create a Cash account
  let createdId = "";
  await database.write(async () => {
    const created = await accountsCollection.create((acc) => {
      acc.userId = userId;
      acc.name = "Cash";
      acc.type = "CASH";
      acc.currency = "EGP";
      acc.balance = 0;
      acc.deleted = false;
    });
    createdId = created.id;
  });

  return createdId;
}

// ---------------------------------------------------------------------------
// Balance delta accumulator
// ---------------------------------------------------------------------------

/**
 * Accumulate a signed balance delta for a given account ID.
 * If the account already has a delta, the new value is added.
 */
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
 * Mapping from SMS sender address → WatermelonDB account ID.
 * Used to route each transaction to its correct account.
 * Keys are raw sender addresses (e.g., "CIB", "NBE", "ValU").
 */
export interface SenderAccountMap {
  readonly [senderAddress: string]: string;
}

/**
 * Save confirmed SMS transactions to the database.
 *
 * Each transaction is routed to the correct account based on its
 * senderAddress. If no mapping exists, falls back to defaultAccountId.
 *
 * ATM withdrawals (isAtmWithdrawal === true) are automatically
 * processed as transfers from the bank account to a Cash account.
 *
 * Performance: All records are created and all account balances
 * updated in a single atomic `database.batch()` call, reducing
 * the operation from O(n) write actions to O(1).
 *
 * @param transactions    - Selected, potentially category-corrected transactions
 * @param senderAccountMap - Mapping from sender address → account ID
 * @param defaultAccountId - Fallback account ID for unmapped senders
 * @returns Summary of saved/failed counts
 */
export async function batchCreateSmsTransactions(
  transactions: readonly ParsedSmsTransaction[],
  senderAccountMap: SenderAccountMap,
  defaultAccountId: string
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

  // Check if any ATM withdrawals exist — lazy-load cash account only if needed
  const hasAtmWithdrawals = transactions.some((tx) => tx.isAtmWithdrawal);
  let cashAccountId: string | null = null;
  if (hasAtmWithdrawals) {
    cashAccountId = await findOrCreateCashAccount(userId);
  }

  // ── Prepare all operations in-memory ─────────────────────────────────

  const transactionsCollection = database.get<Transaction>("transactions");
  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  const preparedOps: Model[] = [];
  const balanceDeltas = new Map<string, number>();
  let savedCount = 0;
  let failedCount = 0;

  for (const tx of transactions) {
    // Route to correct account: sender mapping → default fallback
    const accountId =
      (tx.senderAddress ? senderAccountMap[tx.senderAddress] : undefined) ??
      defaultAccountId;

    // ── ATM Withdrawal: prepare as Transfer (bank → cash) ──
    if (tx.isAtmWithdrawal && cashAccountId) {
      preparedOps.push(
        transfersCollection.prepareCreate((t) => {
          t.userId = userId;
          t.fromAccountId = accountId;
          t.toAccountId = cashAccountId;
          t.amount = Math.abs(tx.amount);
          t.currency = tx.currency as
            | "EGP"
            | "USD"
            | "EUR"
            | "GBP"
            | "SAR"
            | "AED"
            | "KWD";
          t.date = new Date(tx.date);
          t.notes = `[SMS ATM] from ${tx.senderDisplayName}`;
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
