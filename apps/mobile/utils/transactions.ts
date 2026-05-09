import { Account, database, Transaction } from "@monyvi/db";
import { ParsedVoiceTransaction } from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { getCurrentUserDataScope } from "../services/user-data-access";

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
 * because it depends on ParsedVoiceTransaction from @monyvi/logic, which is
 * a voice-input-specific concern, not a core CRUD operation.
 */
export async function createTransactionFromVoice(
  parsed: ParsedVoiceTransaction,
  accountId: string
): Promise<Transaction> {
  const scope = await getCurrentUserDataScope();
  const transactionsCollection = database.get<Transaction>("transactions");
  const account = await scope.findOwned(
    database.get<Account>("accounts"),
    accountId
  );

  const newTransaction = await database.write(async () => {
    return await transactionsCollection.create((tx) => {
      tx.userId = scope.userId;
      tx.accountId = accountId;
      tx.amount = Math.abs(parsed.amount);
      tx.currency = parsed.currency;
      tx.type = parsed.type;
      tx.categoryId = parsed.categoryId;
      tx.counterparty = parsed.counterparty;
      tx.note = parsed.note || undefined;
      tx.date = parsed.date;
      tx.source = "VOICE";
      tx.isDraft = false;
      tx.deleted = false;
    });
  });

  const isExpense = parsed.type === "EXPENSE";
  await updateAccountBalance(account, Math.abs(parsed.amount), isExpense);

  return newTransaction;
}

/**
 * Update account balance after transaction.
 */
async function updateAccountBalance(
  account: Account,
  amount: number,
  isExpense: boolean
): Promise<void> {
  await database.write(async () => {
    try {
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
 * Get default account (first cash account or create one).
 */
// TODO : Remove or update
export async function getOrCreateDefaultAccount(): Promise<Account> {
  const scope = await getCurrentUserDataScope();
  const accountsCollection = database.get<Account>("accounts");

  const cashAccounts = await scope
    .queryOwned(
      accountsCollection,
      Q.where("type", "CASH"),
      Q.where("deleted", false)
    )
    .fetch();

  if (cashAccounts.length > 0) {
    return cashAccounts[0];
  }

  return await database.write(async () => {
    return await accountsCollection.create((acc) => {
      acc.userId = scope.userId;
      acc.name = "Cash";
      acc.type = "CASH";
      acc.currency = "EGP";
      acc.balance = 0;
      acc.deleted = false;
    });
  });
}
