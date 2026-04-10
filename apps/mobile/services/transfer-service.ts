import { getCurrentUserId } from "./supabase";
import {
  Account,
  CurrencyType,
  database,
  Transaction,
  Transfer,
  type TransactionSource,
  type TransactionType,
} from "@astik/db";
import { ensureCashAccount } from "./account-service";

export interface TransferData {
  amount: number;
  convertedAmount?: number;
  currency: CurrencyType;
  fromAccountId: string;
  toAccountId: string;
  date?: Date;
  notes?: string;
  exchangeRate?: number;
  /** SMS body hash for deduplication (persisted in DB) */
  smsBodyHash?: string;
}

// ---------------------------------------------------------------------------
// SMS ATM Transfer
// ---------------------------------------------------------------------------

const ATM_WITHDRAWAL_NOTE_PREFIX = "ATM Withdrawal" as const;

/**
 * Input for creating an ATM withdrawal transfer from a live-detected SMS.
 *
 * Architecture & Design Rationale:
 * - Pattern: Facade — wraps `ensureCashAccount` + `createTransfer` into a
 *   single domain-specific call for ATM withdrawals.
 * - Why: Both the live detection handler and future callers need the same
 *   "ensure cash account → create bank→cash transfer" sequence.
 *   Centralising it here prevents DRY violations and ensures consistent
 *   ATM handling across all SMS entry points.
 * - SOLID: SRP — `createSmsAtmTransfer` only handles ATM routing.
 *   OCP — new transfer types can be added as separate functions.
 */
interface SmsAtmTransferInput {
  /** Bank account ID to debit */
  readonly bankAccountId: string;
  /** Withdrawal amount (always positive) */
  readonly amount: number;
  /** Currency of the transaction */
  readonly currency: CurrencyType;
  /** Transaction date */
  readonly date: Date;
  /** SMS body hash for deduplication */
  readonly smsBodyHash?: string;
  /** Sender display name for notes */
  readonly senderDisplayName?: string;
}

interface SmsAtmTransferResult {
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Create an ATM withdrawal as a bank → cash transfer.
 *
 * Ensures the cash account exists, then atomically creates the transfer
 * and updates both account balances. Used by the live SMS detection handler.
 *
 * The batch flow (`batch-create-transactions.ts`) uses `prepareCreate`
 * for atomic batch writes and calls `ensureCashAccount` separately,
 * so it does NOT use this function.
 *
 * @param input - ATM transfer parameters
 * @returns Result with success flag and optional error
 */
export async function createSmsAtmTransfer(
  input: SmsAtmTransferInput
): Promise<SmsAtmTransferResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "User not authenticated" };
  }

  const cashResult = await ensureCashAccount(userId, input.currency);
  if (!cashResult.accountId) {
    return {
      success: false,
      error: `Failed to resolve Cash account in ${input.currency}: ${cashResult.error ?? "unknown"}`,
    };
  }

  try {
    await createTransfer({
      fromAccountId: input.bankAccountId,
      toAccountId: cashResult.accountId,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      notes: `${ATM_WITHDRAWAL_NOTE_PREFIX}${input.senderDisplayName ? ` — ${input.senderDisplayName}` : ""}`,
      smsBodyHash: input.smsBodyHash,
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to create ATM transfer: ${errorMessage}`,
    };
  }
}

/**
 * Create a new transfer between accounts.
 * Atomically creates the Transfer record and updates both account balances.
 */
export async function createTransfer(data: TransferData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    // i18n-ignore — developer-facing error
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
      transfer.smsBodyHash = data.smsBodyHash;

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
 *
 * Supports editing: amount, notes, date, fromAccountId, toAccountId.
 *
 * Balance adjustment strategies:
 * - **Amount only**: revert old amounts on both accounts, apply new amounts
 * - **Account swap**: revert old accounts, apply to new accounts
 * - **Combined**: both can change simultaneously in a single atomic write
 */
export async function updateTransfer(
  transferId: string,
  updates: {
    readonly amount?: number;
    readonly convertedAmount?: number;
    readonly notes?: string;
    readonly date?: Date;
    readonly fromAccountId?: string;
    readonly toAccountId?: string;
  }
): Promise<void> {
  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transfer = await transfersCollection.find(transferId);

    const oldFromId = transfer.fromAccountId;
    const oldToId = transfer.toAccountId;
    const oldAmount = transfer.amount;
    const oldConvertedAmount = transfer.convertedAmount;

    const newFromId = updates.fromAccountId ?? oldFromId;
    const newToId = updates.toAccountId ?? oldToId;
    const newAmount =
      updates.amount !== undefined ? Math.abs(updates.amount) : oldAmount;

    const isFromChanging = newFromId !== oldFromId;
    const isToChanging = newToId !== oldToId;
    const isAmountChanging = newAmount !== oldAmount;

    // Only adjust balances when amount or accounts change
    if (isFromChanging || isToChanging || isAmountChanging) {
      // --- Revert old from-account (add back withdrawn amount) ---
      const oldFromAccount = await accountsCollection.find(oldFromId);
      await oldFromAccount.update((acc) => {
        acc.balance += oldAmount;
      });

      // --- Revert old to-account (subtract deposited amount) ---
      const oldToAccount = await accountsCollection.find(oldToId);
      const oldDepositAmount = oldConvertedAmount ?? oldAmount;
      await oldToAccount.update((acc) => {
        acc.balance -= oldDepositAmount;
      });

      // --- Apply new from-account (withdraw new amount) ---
      const newFromAccount = isFromChanging
        ? await accountsCollection.find(newFromId)
        : oldFromAccount;
      await newFromAccount.update((acc) => {
        acc.balance -= newAmount;
      });

      // --- Apply new to-account (deposit new amount) ---
      // For same-currency transfers, deposit = withdrawal amount
      // For cross-currency, convertedAmount is preserved unless amount changed
      const newToAccount = isToChanging
        ? await accountsCollection.find(newToId)
        : oldToAccount;
      const newDepositAmount =
        updates.convertedAmount !== undefined
          ? Math.abs(updates.convertedAmount)
          : !isAmountChanging && oldConvertedAmount
            ? oldConvertedAmount
            : newAmount;
      await newToAccount.update((acc) => {
        acc.balance += newDepositAmount;
      });
    }

    await transfer.update((t) => {
      if (updates.amount !== undefined) t.amount = Math.abs(updates.amount);
      if (updates.convertedAmount !== undefined)
        t.convertedAmount = Math.abs(updates.convertedAmount);
      if (updates.notes !== undefined) t.notes = updates.notes;
      if (updates.date !== undefined) t.date = updates.date;
      if (updates.fromAccountId !== undefined)
        t.fromAccountId = updates.fromAccountId;
      if (updates.toAccountId !== undefined)
        t.toAccountId = updates.toAccountId;
    });
  });
}

// =============================================================================
// Delete
// =============================================================================

/**
 * Mark a transfer as deleted (soft delete).
 * Atomically reverses both account balance changes and soft-deletes the record.
 */
export async function deleteTransfer(transferId: string): Promise<void> {
  const transfersCollection = database.get<Transfer>("transfers");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transfer = await transfersCollection.find(transferId);

    // Revert from-account (add back withdrawn amount)
    const fromAccount = await accountsCollection.find(transfer.fromAccountId);
    await fromAccount.update((acc) => {
      acc.balance += transfer.amount;
    });

    // Revert to-account (subtract deposited amount)
    const toAccount = await accountsCollection.find(transfer.toAccountId);
    const depositAmount = transfer.convertedAmount ?? transfer.amount;
    await toAccount.update((acc) => {
      acc.balance -= depositAmount;
    });

    // Soft delete
    await transfer.update((t) => {
      t.deleted = true;
    });
  });
}

// =============================================================================
// Conversion: Transfer → Transaction
// =============================================================================

interface ConvertToTransactionPayload {
  readonly transferId: string;
  readonly accountId: string;
  readonly type: TransactionType;
  readonly categoryId: string;
  readonly counterparty?: string;
}

/**
 * Converts a Transfer into a Transaction.
 *
 * Atomic operation:
 * 1. Soft-delete the transfer and revert both account balances
 * 2. Create a new transaction using the transfer's data
 * 3. Apply the transaction's balance effect on the chosen account
 *
 * The user picks which account (defaults to fromAccountId) and
 * must provide a type (EXPENSE/INCOME) and categoryId.
 */
export async function convertTransferToTransaction(
  payload: ConvertToTransactionPayload
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    // i18n-ignore — developer-facing error
    throw new Error("User not authenticated");
  }

  const transfersCollection = database.get<Transfer>("transfers");
  const transactionsCollection = database.get<Transaction>("transactions");
  const accountsCollection = database.get<Account>("accounts");

  await database.write(async () => {
    const transfer = await transfersCollection.find(payload.transferId);

    // 1. Revert transfer balance effects
    const fromAccount = await accountsCollection.find(transfer.fromAccountId);
    await fromAccount.update((acc) => {
      acc.balance += transfer.amount; // was -amount, revert
    });

    const toAccount = await accountsCollection.find(transfer.toAccountId);
    const depositAmount = transfer.convertedAmount ?? transfer.amount;
    await toAccount.update((acc) => {
      acc.balance -= depositAmount; // was +depositAmount, revert
    });

    // 2. Soft-delete the transfer
    await transfer.update((t) => {
      t.deleted = true;
    });

    // 3. Create the new transaction
    await transactionsCollection.create((tx: Transaction) => {
      tx.userId = userId;
      tx.accountId = payload.accountId;
      tx.amount = transfer.amount;
      tx.currency = transfer.currency;
      tx.type = payload.type;
      tx.categoryId = payload.categoryId;
      tx.counterparty = payload.counterparty;
      tx.date = transfer.date;
      tx.note = transfer.notes;
      tx.source = "MANUAL" as TransactionSource;
      tx.isDraft = false;
      tx.deleted = false;
    });

    // 4. Apply transaction balance effect on the chosen account
    const targetAccount = await accountsCollection.find(payload.accountId);
    await targetAccount.update((acc) => {
      if (payload.type === "EXPENSE") {
        acc.balance -= transfer.amount;
      } else {
        acc.balance += transfer.amount;
      }
    });
  });
}
