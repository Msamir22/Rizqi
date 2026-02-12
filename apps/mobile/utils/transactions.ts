import {
  Account,
  CurrencyType,
  database,
  RecurringAction,
  RecurringFrequency,
  RecurringPayment,
  Transaction,
  TransactionType,
  Transfer,
} from "@astik/db";
import { ParsedVoiceTransaction } from "@astik/logic";
import { getCurrentUserId } from "../services/supabase";

export interface TransferData {
  amount: number;
  convertedAmount?: number;
  currency: CurrencyType;
  fromAccountId: string;
  toAccountId: string;
  date?: Date;
  notes?: string;
  exchangeRate?: number;
}

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
      tx.counterparty = parsed.counterparty || parsed.description || undefined;
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
 * Update an existing transaction
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
 * Update account balance after transaction
 */
async function updateAccountBalance(
  accountId: string,
  amount: number,
  isExpense: boolean
): Promise<void> {
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    try {
      const account = await accountsCollection.find(accountId);
      await account.update((acc) => {
        if (isExpense) {
          acc.balance -= amount;
        } else {
          acc.balance += amount;
        }
      });
    } catch (error) {
      console.error("Error updating account balance:", error);
    }
  });
}

/**
 * Get default account (first cash account or create one)
 */

// TODO : Remove or update
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
 * Create a new transfer between accounts
 */
export async function createTransfer(data: TransferData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    // 1. Create Transfer Record
    await transfersCollection.create((transfer: Transfer) => {
      transfer.userId = userId;
      transfer.fromAccountId = data.fromAccountId;
      transfer.toAccountId = data.toAccountId;
      transfer.amount = Math.abs(data.amount);
      transfer.currency = data.currency;
      transfer.date = data.date || new Date();
      transfer.notes = data.notes;

      // Multi-currency fields
      if (data.convertedAmount) {
        transfer.convertedAmount = Math.abs(data.convertedAmount);
        transfer.exchangeRate = data.exchangeRate;
      }

      transfer.deleted = false;
    });

    // 2. Update From Account (Decrease Balance)
    const fromAccount = await accountsCollection.find(data.fromAccountId);
    await fromAccount.update((acc) => {
      acc.balance -= Math.abs(data.amount);
    });

    // 3. Update To Account (Increase Balance)
    const toAccount = await accountsCollection.find(data.toAccountId);
    await toAccount.update((acc) => {
      // Use converted amount if available, otherwise original amount
      const depositAmount = data.convertedAmount
        ? Math.abs(data.convertedAmount)
        : Math.abs(data.amount);

      acc.balance += depositAmount;
    });
  });
}

export interface RecurringPaymentData {
  name: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: Date;
  action: RecurringAction;
}

export async function createRecurringPayment(
  data: RecurringPaymentData
): Promise<RecurringPayment> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const recurringCollection =
    database.get<RecurringPayment>("recurring_payments");

  return await database.write(async () => {
    return await recurringCollection.create((rec) => {
      rec.userId = userId;
      rec.name = data.name;
      rec.amount = Math.abs(data.amount);
      rec.type = data.type;
      rec.accountId = data.accountId;
      rec.categoryId = data.categoryId;
      rec.frequency = data.frequency;
      rec.startDate = data.startDate;
      rec.nextDueDate = data.startDate;
      rec.action = data.action;
      rec.status = "ACTIVE";
      rec.deleted = false;
    });
  });
}

/**
 * Update an existing transfer
 */
export async function updateTransfer(
  transferId: string,
  updates: {
    amount?: number;
    notes?: string;
    date?: Date;
  }
): Promise<void> {
  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transfer = await transfersCollection.find(transferId);

    // Handle Amount Update
    if (updates.amount !== undefined && updates.amount !== transfer.amount) {
      const fromAccount = await accountsCollection.find(transfer.fromAccountId);
      const toAccount = await accountsCollection.find(transfer.toAccountId);

      const oldAmount = transfer.amount;
      const newAmount = Math.abs(updates.amount);

      // Update From Account
      if (newAmount > oldAmount) {
        const diff = newAmount - oldAmount;
        if (fromAccount.balance < diff) {
          throw new Error("Insufficient funds in source account");
        }
      }

      await fromAccount.update((acc) => {
        // Revert old withdrawal (+) -> Apply new withdrawal (-)
        acc.balance = acc.balance + oldAmount - newAmount;
      });

      // Update To Account (Only if single currency or careful logic)
      // Assuming single currency updates for now if convertedAmount is not set
      if (!transfer.convertedAmount) {
        await toAccount.update((acc) => {
          // Revert old deposit (-) -> Apply new deposit (+)
          acc.balance = acc.balance - oldAmount + newAmount;
        });
      }
    }

    await transfer.update((t) => {
      if (updates.amount !== undefined) t.amount = Math.abs(updates.amount);
      if (updates.notes !== undefined) t.notes = updates.notes;
      if (updates.date !== undefined) t.date = updates.date;
    });
  });
}
