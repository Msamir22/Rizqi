import { getCurrentUserId } from "@/services";
import { Account, CurrencyType, database, Transfer } from "@astik/db";

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

/**
 * Create a new transfer between accounts.
 * Atomically creates the Transfer record and updates both account balances.
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

/**
 * Update an existing transfer.
 * Atomically adjusts account balances to reflect the new amount.
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
