/**
 * SMS Account Matcher Service
 *
 * Matches parsed SMS transactions to user accounts using multiple strategies:
 * 1. SMS sender name (bank_details.sms_sender_name) — substring match against financialEntity
 * 2. Account name — substring match against financialEntity
 * 3. Card last 4 digits — exact match against bank_details.card_last_4
 * 4. Fallback — default account (is_default = true)
 *
 * Architecture & Design Rationale:
 * - Pattern: Strategy (multi-strategy matching with priority ordering)
 * - Why: Different data quality across SMS sources means no single match
 *   strategy covers all cases. Priority ordering ensures best-match first.
 * - SOLID: SRP — only handles account matching, no transaction creation.
 *   OCP — new matching strategies can be added without modifying existing ones.
 *
 * @module sms-account-matcher
 */

import { Account, BankDetails, database } from "@astik/db";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountMatch {
  readonly accountId: string;
  readonly accountName: string;
  /** How the match was determined */
  readonly matchReason:
    | "sms_sender"
    | "account_name"
    | "card_last4"
    | "default"
    | "none";
}

interface AccountWithBankDetails {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly smsSenderName?: string;
  readonly cardLast4?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Case-insensitive substring match.
 * Returns true if `haystack` contains `needle` (both normalised to lowercase).
 */
function substringMatch(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Fetches all non-deleted accounts with their bank details for the current user.
 */
async function fetchAccountsWithDetails(
  userId: string
): Promise<readonly AccountWithBankDetails[]> {
  const accounts = await database
    .get<Account>("accounts")
    .query(Q.where("user_id", userId), Q.where("deleted", false))
    .fetch();

  const results: AccountWithBankDetails[] = [];

  for (const account of accounts) {
    const bankDetailsList = await database
      .get<BankDetails>("bank_details")
      .query(Q.where("account_id", account.id), Q.where("deleted", false))
      .fetch();

    // An account may have 0..N bank_details rows; we use the first one that has data.
    const bankDetails = bankDetailsList[0];

    results.push({
      id: account.id,
      name: account.name,
      isDefault: account.isDefault,
      smsSenderName: bankDetails?.smsSenderName ?? undefined,
      cardLast4: bankDetails?.cardLast4 ?? undefined,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Matches a single parsed SMS transaction to the best-fit user account.
 *
 * @param transaction - The parsed SMS transaction
 * @param accounts - Pre-fetched list of accounts with bank details
 * @returns The best match, or a "none" match if nothing fits
 */
function matchTransaction(
  transaction: ParsedSmsTransaction,
  accounts: readonly AccountWithBankDetails[]
): AccountMatch {
  const entity = transaction.financialEntity ?? transaction.senderDisplayName;

  // Strategy 1: SMS sender name match (highest priority)
  for (const acc of accounts) {
    if (acc.smsSenderName && substringMatch(entity, acc.smsSenderName)) {
      return {
        accountId: acc.id,
        accountName: acc.name,
        matchReason: "sms_sender",
      };
    }
  }

  // Strategy 2: Account name match
  for (const acc of accounts) {
    if (substringMatch(entity, acc.name)) {
      return {
        accountId: acc.id,
        accountName: acc.name,
        matchReason: "account_name",
      };
    }
  }

  // Strategy 3: Card last 4 digits exact match
  if (transaction.cardLast4) {
    for (const acc of accounts) {
      if (acc.cardLast4 && acc.cardLast4 === transaction.cardLast4) {
        return {
          accountId: acc.id,
          accountName: acc.name,
          matchReason: "card_last4",
        };
      }
    }
  }

  // Strategy 4: Default account fallback
  const defaultAcc = accounts.find((a) => a.isDefault);
  if (defaultAcc) {
    return {
      accountId: defaultAcc.id,
      accountName: defaultAcc.name,
      matchReason: "default",
    };
  }

  // No match at all
  return { accountId: "", accountName: "", matchReason: "none" };
}

/**
 * Matches all parsed SMS transactions to user accounts.
 *
 * @param transactions - Array of parsed SMS transactions
 * @param userId - Current user's ID
 * @returns Map of transaction index → AccountMatch
 */
async function matchAllTransactions(
  transactions: readonly ParsedSmsTransaction[],
  userId: string
): Promise<ReadonlyMap<number, AccountMatch>> {
  const accounts = await fetchAccountsWithDetails(userId);
  const matches = new Map<number, AccountMatch>();

  for (let i = 0; i < transactions.length; i++) {
    matches.set(i, matchTransaction(transactions[i], accounts));
  }

  return matches;
}

export { matchAllTransactions, matchTransaction, fetchAccountsWithDetails };
export type { AccountMatch, AccountWithBankDetails };
