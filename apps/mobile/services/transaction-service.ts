import { getCurrentUserId } from "./supabase";
import {
  Account,
  CurrencyType,
  database,
  Transaction,
  Transfer,
  TransactionSource,
  TransactionType,
} from "@astik/db";
import { Q, type Model } from "@nozbe/watermelondb";
import type { DisplayTransaction } from "@/hooks/useTransactionsGrouping";

/**
 * Create a transaction from manual input.
 * Atomically creates the Transaction record and updates the account balance.
 */
export async function createTransaction(data: {
  amount: number;
  currency: CurrencyType;
  categoryId: string;
  counterparty?: string;
  accountId: string;
  note?: string;
  type: TransactionType;
  date?: Date;
  linkedRecurringId?: string;
  source: TransactionSource;
}): Promise<Transaction> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const transactionsCollection = database.get<Transaction>("transactions");
  const accountsCollection = database.get<Account>("accounts");

  // Combine transaction creation and balance update in a single atomic write
  const newTransaction = await database.write(async () => {
    // Create the transaction
    const transaction = await transactionsCollection.create((tx) => {
      tx.userId = userId;
      tx.accountId = data.accountId;
      tx.amount = Math.abs(data.amount); // Amount is always positive
      tx.currency = data.currency;
      tx.type = data.type;
      tx.categoryId = data.categoryId;
      tx.counterparty = data.counterparty || undefined;
      tx.note = data.note || undefined;
      tx.date = data.date || new Date();
      tx.source = data.source;
      tx.linkedRecurringId = data.linkedRecurringId || undefined;
      tx.isDraft = false;
      tx.deleted = false;
    });

    // Update account balance in the same write block
    const account = await accountsCollection.find(data.accountId);
    await account.update((acc) => {
      if (data.type === "EXPENSE") {
        acc.balance -= Math.abs(data.amount);
      } else {
        acc.balance += Math.abs(data.amount);
      }
    });

    return transaction;
  });

  return newTransaction;
}

/**
 * Update an existing transaction.
 *
 * Supports editing: amount, categoryId, note, date, counterparty,
 * type (EXPENSE ↔ INCOME), and accountId (cross-currency allowed).
 *
 * Balance adjustment strategies:
 * - **Amount change**: delta = newAmount − oldAmount, applied directionally
 * - **Type change**: revert old effect + apply new effect = ±2 × amount
 * - **Account swap**: revert effect on old account, apply on new account
 * - **Combined**: all three can change simultaneously in a single atomic write
 */
export async function updateTransaction(
  transactionId: string,
  updates: {
    readonly amount?: number;
    readonly categoryId?: string;
    readonly note?: string;
    readonly date?: Date;
    readonly counterparty?: string;
    readonly type?: TransactionType;
    readonly accountId?: string;
  }
): Promise<void> {
  const transactionsCollection = database.get<Transaction>("transactions");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transaction = await transactionsCollection.find(transactionId);

    const oldType = transaction.type;
    const oldAmount = transaction.amount;
    const oldAccountId = transaction.accountId;

    const newType = updates.type ?? oldType;
    const newAmount =
      updates.amount !== undefined ? Math.abs(updates.amount) : oldAmount;
    const newAccountId = updates.accountId ?? oldAccountId;

    const isAccountChanging = newAccountId !== oldAccountId;
    const isTypeChanging = newType !== oldType;
    const isAmountChanging = newAmount !== oldAmount;

    // Only adjust balances when amount, type, or account actually changed
    if (isAccountChanging || isTypeChanging || isAmountChanging) {
      // --- Revert the old effect on the old account ---
      const oldAccount = await accountsCollection.find(oldAccountId);
      await oldAccount.update((acc) => {
        if (oldType === "EXPENSE") {
          acc.balance += oldAmount; // was -oldAmount, revert by +oldAmount
        } else {
          acc.balance -= oldAmount; // was +oldAmount, revert by -oldAmount
        }
      });

      // --- Apply the new effect on the (possibly different) account ---
      const targetAccount = isAccountChanging
        ? await accountsCollection.find(newAccountId)
        : oldAccount;

      // Only update targetAccount if it's a different record from oldAccount;
      // if same account, the revert above already fetched it — but we need
      // to re-find to get the reverted balance (WatermelonDB caches writes
      // within the same write block).
      if (!isAccountChanging) {
        await targetAccount.update((acc) => {
          if (newType === "EXPENSE") {
            acc.balance -= newAmount;
          } else {
            acc.balance += newAmount;
          }
        });
      } else {
        await targetAccount.update((acc) => {
          if (newType === "EXPENSE") {
            acc.balance -= newAmount;
          } else {
            acc.balance += newAmount;
          }
        });
      }
    }

    // Update Transaction Record
    await transaction.update((tx) => {
      if (updates.amount !== undefined) tx.amount = Math.abs(updates.amount);
      if (updates.categoryId !== undefined) tx.categoryId = updates.categoryId;
      if (updates.note !== undefined) tx.note = updates.note;
      if (updates.date !== undefined) tx.date = updates.date;
      if (updates.counterparty !== undefined)
        tx.counterparty = updates.counterparty;
      if (updates.type !== undefined) tx.type = updates.type;
      if (updates.accountId !== undefined) tx.accountId = updates.accountId;
    });
  });
}

/**
 * Mark a transaction as deleted (soft delete).
 * Atomically reverses the account balance change and soft-deletes the record.
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const transactionsCollection = database.get<Transaction>("transactions");

  await database.write(async () => {
    const transaction = await transactionsCollection.find(transactionId);

    // Reverse the balance change
    const accountsCollection = database.get<Account>("accounts");
    const account = await accountsCollection.find(transaction.accountId);

    await account.update((acc) => {
      if (transaction.type === "EXPENSE") {
        acc.balance += transaction.amount; // Restore balance
      } else {
        acc.balance -= transaction.amount;
      }
    });

    // Soft delete
    await transaction.update((tx) => {
      tx.deleted = true;
    });
  });
}

// =============================================================================
// Conversion: Transaction → Transfer
// =============================================================================

interface ConvertToTransferPayload {
  readonly transactionId: string;
  readonly toAccountId: string;
  readonly notes?: string;
}

/**
 * Converts a Transaction into a Transfer.
 *
 * Atomic operation:
 * 1. Soft-delete the transaction and revert its balance effect
 * 2. Create a new transfer using the transaction's data
 * 3. Debit fromAccount (transaction's account), credit toAccount
 *
 * The transaction's accountId becomes the transfer's fromAccountId.
 */
export async function convertTransactionToTransfer(
  payload: ConvertToTransferPayload
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const transactionsCollection = database.get<Transaction>("transactions");
  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transaction = await transactionsCollection.find(
      payload.transactionId
    );

    // 1. Revert the transaction's balance effect on its account
    const fromAccount = await accountsCollection.find(transaction.accountId);
    await fromAccount.update((acc) => {
      if (transaction.type === "EXPENSE") {
        acc.balance += transaction.amount; // was -amount, revert
      } else {
        acc.balance -= transaction.amount; // was +amount, revert
      }
    });

    // 2. Soft-delete the transaction
    await transaction.update((tx) => {
      tx.deleted = true;
    });

    // 3. Create the new transfer
    await transfersCollection.create((t: Transfer) => {
      t.userId = userId;
      t.fromAccountId = transaction.accountId;
      t.toAccountId = payload.toAccountId;
      t.amount = transaction.amount;
      t.currency = transaction.currency;
      t.date = transaction.date;
      t.notes = payload.notes ?? transaction.note ?? undefined;
      t.deleted = false;
    });

    // 4. Apply transfer balance effects
    // From-account already had the transaction effect reverted;
    // now debit it for the transfer
    await fromAccount.update((acc) => {
      acc.balance -= transaction.amount;
    });

    // Credit the to-account
    const toAccount = await accountsCollection.find(payload.toAccountId);
    await toAccount.update((acc) => {
      acc.balance += transaction.amount;
    });
  });
}

// =============================================================================
// Batch Delete (Transactions + Transfers)
// =============================================================================

/**
 * Accumulates a balance delta for a given account ID into the Map.
 * If the account ID already exists, adds to the existing delta.
 */
function accumulateBalanceDelta(
  deltas: Map<string, number>,
  accountId: string,
  delta: number
): void {
  const existing = deltas.get(accountId) ?? 0;
  deltas.set(accountId, existing + delta);
}

/**
 * Batch soft-deletes an array of transactions/transfers and atomically
 * reverts all affected account balances.
 *
 * Performance: Uses scalar `accountId`/`fromAccountId`/`toAccountId` fields
 * to collect affected account IDs, then fetches all accounts in a single
 * query — avoiding the N+1 `.fetch()` anti-pattern.
 *
 * @throws Error if the database write fails (caller handles UI feedback)
 */
export async function batchDeleteDisplayTransactions(
  items: readonly DisplayTransaction[]
): Promise<void> {
  if (items.length === 0) return;

  await database.write(async () => {
    const softDeleteBatches: Model[] = [];

    // Phase 1: Collect soft-delete updates and balance deltas (no DB reads)
    const balanceDeltas = new Map<string, number>();

    for (const item of items) {
      if (item._type === "transaction") {
        softDeleteBatches.push(
          item.prepareUpdate((t) => {
            t.deleted = true;
          })
        );

        // Determine balance reversion
        if (item.isIncome) {
          accumulateBalanceDelta(balanceDeltas, item.accountId, -item.amount);
        } else if (item.isExpense) {
          accumulateBalanceDelta(balanceDeltas, item.accountId, item.amount);
        }
      } else if (item._type === "transfer") {
        softDeleteBatches.push(
          item.prepareUpdate((t) => {
            t.deleted = true;
          })
        );

        // Revert source (add back) and destination (subtract)
        accumulateBalanceDelta(balanceDeltas, item.fromAccountId, item.amount);
        const amountToDeduct = item.convertedAmount ?? item.amount;
        accumulateBalanceDelta(
          balanceDeltas,
          item.toAccountId,
          -amountToDeduct
        );
      }
    }

    // Phase 2: Batch-fetch all affected accounts in a single query
    const accountIds = Array.from(balanceDeltas.keys());
    const accounts =
      accountIds.length > 0
        ? await database
            .get<Account>("accounts")
            .query(Q.where("id", Q.oneOf(accountIds)))
            .fetch()
        : [];

    // Phase 3: Prepare balance updates
    for (const account of accounts) {
      const delta = balanceDeltas.get(account.id);
      if (delta && delta !== 0) {
        softDeleteBatches.push(
          account.prepareUpdate((a) => {
            a.balance = a.balance + delta || 0;
          })
        );
      }
    }

    // Execute everything in a single atomic batch
    await database.batch(softDeleteBatches);
  });
}
