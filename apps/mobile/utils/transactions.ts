import { Account, database, Transaction } from "@astik/db";
import { ParsedVoiceTransaction } from "@astik/logic";
import { getCurrentUserId } from "../services/supabase";

/**
 * Format a transaction date for display.
 * Returns relative labels (Today, Yesterday, weekday) for recent dates.
 */
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
 * Create a new transaction from voice input.
 *
 * NOTE: This function lives here (rather than in transaction-service.ts)
 * because it depends on ParsedVoiceTransaction from @astik/logic, which is
 * a voice-input-specific concern, not a core CRUD operation.
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
