import { getCurrentUserId } from "./supabase";
import {
  Account,
  CurrencyType,
  database,
  Transaction,
  TransactionSource,
  TransactionType,
} from "@astik/db";

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
 * Atomically adjusts the account balance to reflect the new amount.
 */
export async function updateTransaction(
  transactionId: string,
  updates: {
    amount?: number;
    categoryId?: string;
    note?: string;
    date?: Date;
  }
): Promise<void> {
  const transactionsCollection = database.get<Transaction>("transactions");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transaction = await transactionsCollection.find(transactionId);

    // Handle Amount Update (Atomic Balance Update)
    if (updates.amount !== undefined && updates.amount !== transaction.amount) {
      const account = await accountsCollection.find(transaction.accountId);
      const oldAmount = transaction.amount;
      const newAmount = Math.abs(updates.amount);
      const isExpense = transaction.type === "EXPENSE";

      await account.update((acc) => {
        if (isExpense) {
          // Revert old: +old -> Apply new: -new => net: +(old - new)
          acc.balance = acc.balance + oldAmount - newAmount;
        } else {
          // Revert old: -old -> Apply new: +new => net: -(old - new)
          acc.balance = acc.balance - oldAmount + newAmount;
        }
      });
    }

    // Update Transaction Record
    await transaction.update((tx) => {
      if (updates.amount !== undefined) tx.amount = Math.abs(updates.amount);
      if (updates.categoryId !== undefined) tx.categoryId = updates.categoryId;
      if (updates.note !== undefined) tx.note = updates.note;
      if (updates.date !== undefined) tx.date = updates.date;
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
