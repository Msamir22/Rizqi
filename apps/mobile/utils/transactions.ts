import {
  Account,
  CurrencyType,
  database,
  Transaction,
  TransactionType,
} from "@astik/db";
import { ParsedVoiceTransaction } from "@astik/logic";
import { getCurrentUserId } from "../services/supabase";

export function formatTransactionDate(date: Date): string {
  const now = new Date();
  const txDate = new Date(date);
  const diffDays = Math.floor(
    (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const timeStr = txDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${timeStr}`;
  } else if (diffDays < 7) {
    const dayName = txDate.toLocaleDateString("en-US", { weekday: "long" });
    return `${dayName}, ${timeStr}`;
  }
  return txDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Create a new transaction from voice input
 */
export async function createTransactionFromVoice(
  parsed: ParsedVoiceTransaction,
  accountId: string
): Promise<Transaction> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const transactionsCollection = database.get<Transaction>("transactions");

  const newTransaction = await database.write(async () => {
    return await transactionsCollection.create((tx) => {
      tx.userId = userId;
      tx.accountId = accountId;
      tx.amount = Math.abs(parsed.amount); // Amount is always positive
      tx.currency = parsed.currency;
      tx.type = parsed.isIncome ? "INCOME" : "EXPENSE";
      tx.categoryId = parsed.detectedCategory || "other"; // Will need category lookup
      tx.merchant = parsed.merchant || parsed.description || undefined;
      tx.note = parsed.description || undefined;
      tx.date = new Date();
      tx.source = "VOICE";
      tx.isDraft = false; // Voice transactions are confirmed
      tx.deleted = false;
    });
  });

  // Update account balance
  await updateAccountBalance(accountId, parsed.amount, !parsed.isIncome);

  return newTransaction;
}

/**
 * Create a transaction from manual input
 */
export async function createTransaction(data: {
  amount: number;
  currency: CurrencyType;
  categoryId?: string;
  merchant?: string;
  accountId: string;
  note?: string;
  type: TransactionType;
  date?: Date;
}): Promise<Transaction> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const transactionsCollection = database.get<Transaction>("transactions");

  const newTransaction = await database.write(async () => {
    return await transactionsCollection.create((tx) => {
      tx.userId = userId;
      tx.accountId = data.accountId;
      tx.amount = Math.abs(data.amount); // Amount is always positive
      tx.currency = data.currency;
      tx.type = data.type;
      tx.categoryId = data.categoryId || "other";
      tx.merchant = data.merchant || undefined;
      tx.note = data.note || undefined;
      tx.date = data.date || new Date();
      tx.source = "MANUAL";
      tx.isDraft = false;
      tx.deleted = false;
    });
  });

  await updateAccountBalance(
    data.accountId,
    data.amount,
    data.type === "EXPENSE"
  );

  return newTransaction;
}

/**
 * Update account balance after transaction
 */
async function updateAccountBalance(
  accountId: string,
  amount: number,
  isExpense: boolean
): Promise<void> {
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const account = await accountsCollection.find(accountId);
    await account.update((acc) => {
      if (isExpense) {
        acc.balance -= amount;
      } else {
        acc.balance += amount;
      }
    });
  });
}

/**
 * Get all transactions for an account
 */
export async function getAccountTransactions(
  accountId: string
): Promise<Transaction[]> {
  const transactionsCollection = database.get<Transaction>("transactions");
  const { Q } = await import("@nozbe/watermelondb");
  return await transactionsCollection
    .query(Q.where("account_id", accountId), Q.where("deleted", false))
    .fetch();
}

/**
 * Get default account (first cash account or create one)
 */
export async function getOrCreateDefaultAccount(): Promise<Account> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const accountsCollection = database.get<Account>("accounts");
  const { Q } = await import("@nozbe/watermelondb");

  // Try to find existing cash account for this user
  const cashAccounts = await accountsCollection
    .query(
      Q.where("user_id", userId),
      Q.where("type", "CASH"),
      Q.where("deleted", false)
    )
    .fetch();

  if (cashAccounts.length > 0) {
    return cashAccounts[0];
  }

  // Create default cash account
  return await database.write(async () => {
    return await accountsCollection.create((acc) => {
      acc.userId = userId;
      acc.name = "Cash";
      acc.type = "CASH";
      acc.currency = "EGP";
      acc.balance = 0;
      acc.deleted = false;
    });
  });
}

/**
 * Mark a transaction as deleted (soft delete)
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
