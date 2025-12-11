/**
 * Transaction helper functions for Astik
 */

import { database } from "../providers/DatabaseProvider";
import { Transaction, Account } from "@astik/db";
import { ParsedVoiceTransaction } from "@astik/logic";

/**
 * Create a new transaction from voice input
 */
export async function createTransactionFromVoice(
  parsed: ParsedVoiceTransaction,
  accountId: string
): Promise<Transaction> {
  const transactionsCollection = database.get<Transaction>("transactions");

  const newTransaction = await database.write(async () => {
    return await transactionsCollection.create((tx) => {
      tx.amount = parsed.amount;
      tx.currency = parsed.currency as "EGP" | "USD" | "XAU";
      tx.category = parsed.detectedCategory || "Other";
      tx.merchant = parsed.merchant || parsed.description || "";
      tx.accountId = accountId;
      tx.note = parsed.description || "";
      tx.isDraft = false; // Voice transactions are confirmed
      tx.isExpense = !parsed.isIncome;
      tx.notificationSource = "voice";
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
  currency: "EGP" | "USD" | "XAU";
  category?: string | null;
  merchant?: string;
  accountId: string;
  note?: string;
  isExpense: boolean;
}): Promise<Transaction> {
  const transactionsCollection = database.get<Transaction>("transactions");

  const newTransaction = await database.write(async () => {
    return await transactionsCollection.create((tx) => {
      tx.amount = data.amount;
      tx.currency = data.currency;
      tx.category = data.category || "Other";
      tx.merchant = data.merchant || "";
      tx.accountId = data.accountId;
      tx.note = data.note || "";
      tx.isDraft = false;
      tx.isExpense = data.isExpense;
      tx.notificationSource = "manual";
    });
  });

  await updateAccountBalance(data.accountId, data.amount, data.isExpense);

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
  return await transactionsCollection.query().fetch();
}

/**
 * Get default account (first cash account or create one)
 */
export async function getOrCreateDefaultAccount(): Promise<Account> {
  const accountsCollection = database.get<Account>("accounts");

  // Try to find existing cash account
  const accounts = await accountsCollection.query().fetch();
  const cashAccount = accounts.find((a) => a.type === "CASH");

  if (cashAccount) {
    return cashAccount;
  }

  // Create default cash account
  return await database.write(async () => {
    return await accountsCollection.create((acc) => {
      acc.name = "Cash";
      acc.type = "CASH";
      acc.currency = "EGP";
      acc.balance = 0;
      acc.isLiquid = true;
    });
  });
}
