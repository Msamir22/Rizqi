/**
 * SMS Edit Modal Service
 *
 * Pure business logic extracted from TransactionEditModal.
 * Handles duplicate account detection, pending account construction,
 * and transaction edits building.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service Layer (pure functions, no React dependencies)
 * - Why: Keeps the modal component purely presentational while
 *   making validation and data construction independently testable.
 * - SOLID: SRP — business logic only, no UI concerns.
 *
 * @module sms-edit-modal-service
 */

import type { AccountWithBankDetails } from "@/services/sms-account-matcher";
import type { PendingAccount } from "@/services/pending-account-service";
import type { ParsedSmsTransaction } from "@astik/logic";
import type { TransactionType } from "@astik/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields that can be overridden in the edit modal */
interface TransactionEdits {
  readonly amount: number;
  readonly counterparty: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  readonly accountId: string | null;
  readonly accountName: string | null;
  /** Cash account ID for ATM withdrawal destination (optional) */
  readonly toAccountId?: string | null;
  /** Cash account name for ATM withdrawal destination (optional) */
  readonly toAccountName?: string | null;
}

interface BuildPendingAccountInput {
  readonly name: string;
  readonly currency: ParsedSmsTransaction["currency"];
  readonly senderDisplayName: string;
  readonly cardLast4?: string;
}

interface BuildTransactionEditsInput {
  readonly accountId: string | null;
  readonly accountName: string | null;
  readonly counterparty: string;
  readonly type: TransactionType;
  readonly categoryId: string;
  readonly amount: number;
  /** Cash account ID for ATM withdrawal destination (optional) */
  readonly toAccountId?: string | null;
  /** Cash account name for ATM withdrawal destination (optional) */
  readonly toAccountName?: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an account with the same name AND currency already exists
 * (case-insensitive) in either the persisted accounts or the in-memory
 * pending accounts.
 */
function isDuplicateAccount(
  name: string,
  currency: string,
  accounts: readonly AccountWithBankDetails[],
  pendingAccounts: readonly PendingAccount[]
): boolean {
  const normalize = (value: string): string => value.trim().toLowerCase();
  const normalized = normalize(name);
  if (!normalized) return false;
  const existsInAccounts = accounts.some(
    (acc) => normalize(acc.name) === normalized && acc.currency === currency
  );
  const existsInPending = pendingAccounts.some(
    (pa) => normalize(pa.name) === normalized && pa.currency === currency
  );
  return existsInAccounts || existsInPending;
}

/**
 * Generate a unique temporary ID for a pending account.
 */
function generatePendingTempId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build a PendingAccount from the edit modal inputs.
 * Does NOT perform validation — caller should validate first.
 */
function buildPendingAccount(
  tempId: string,
  input: BuildPendingAccountInput
): PendingAccount {
  return {
    tempId,
    name: input.name,
    currency: input.currency,
    type: "BANK",
    senderDisplayName: input.senderDisplayName,
    cardLast4: input.cardLast4,
  };
}

/**
 * Build the TransactionEdits payload from the edit modal form state.
 */
function buildTransactionEdits(
  input: BuildTransactionEditsInput
): TransactionEdits {
  return {
    accountId: input.accountId,
    accountName: input.accountName,
    counterparty: input.counterparty,
    type: input.type,
    categoryId: input.categoryId,
    amount: input.amount,
    toAccountId: input.toAccountId,
    toAccountName: input.toAccountName,
  };
}

export {
  isDuplicateAccount,
  generatePendingTempId,
  buildPendingAccount,
  buildTransactionEdits,
};
export type {
  TransactionEdits,
  BuildPendingAccountInput,
  BuildTransactionEditsInput,
};
