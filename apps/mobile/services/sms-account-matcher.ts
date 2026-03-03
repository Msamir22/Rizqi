/**
 * SMS Account Matcher Service
 *
 * Single source of truth for all SMS → Account matching logic.
 * Both live detection (`resolveAccountForSms`) and batch review-page matching
 * delegate to `matchAccountCore` — a pure function implementing a 5-step
 * resolution chain using `senderAddress` only (no `financialEntity`).
 *
 * Resolution chain (highest confidence → lowest):
 * 1. Card last 4 + sender match against bank_details
 * 2. Sender match alone against bank_details / account name
 * 3. Name + currency match via bank registry (isKnownFinancialSender)
 * 4. Default account (isDefault flag)
 * 5. First bank account fallback (sorted by created_at ASC)
 *
 * Architecture & Design Rationale:
 * - Pattern: Strategy (multi-strategy matching with priority ordering)
 * - Why: Different data quality across SMS sources means no single match
 *   strategy covers all cases. Priority ordering ensures best-match first.
 * - SOLID: SRP — only handles account matching, no transaction creation.
 *   OCP — new matching strategies can be added without modifying existing ones.
 *   DRY — both live and batch paths use the same core function.
 *
 * @module sms-account-matcher
 */

import {
  Account,
  AccountType,
  BankDetails,
  database,
  type CurrencyType,
} from "@astik/db";
import { ParsedSmsTransaction, isKnownFinancialSender } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How the match was determined. */
type MatchReason =
  | "card_last4"
  | "sms_sender"
  | "account_name"
  | "bank_registry"
  | "default"
  | "first_bank"
  | "none";

interface AccountMatch {
  readonly accountId: string;
  readonly accountName: string;
  readonly matchReason: MatchReason;
}

interface AccountWithBankDetails {
  readonly id: string;
  readonly name: string;
  readonly currency: CurrencyType;
  readonly isDefault: boolean;
  readonly createdAt: Date;
  readonly type: AccountType;
  readonly smsSenderName?: string;
  readonly bankName?: string;
  readonly cardLast4?: string;
}

/**
 * Input for the pure `matchAccountCore` function.
 * Both live detection and batch matching map their data into this shape.
 */
interface MatchInput {
  readonly senderAddress: string;
  readonly cardLast4?: string;
  readonly currency?: CurrencyType;
}

/** Optional filter for `fetchAccountsWithDetails`. */
type AccountTypeFilter = AccountType | undefined;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 20;

/** Escape special regex characters in a string to prevent injection / ReDoS. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex patterns for extracting card last 4 digits from SMS body.
 * Matches common formats used by Egyptian banks:
 * - *1234 or *XXXX
 * - ending 1234 / ending in 1234
 * - xxxx1234 (masked card numbers)
 */
const CARD_LAST_4_PATTERNS: readonly RegExp[] = [
  /\*(\d{4})/,
  /ending\s+(?:in\s+)?(\d{4})/i,
  /x{4,}(\d{4})/i,
  /card\s+(?:no\.?\s+)?(?:\*+|\d+)(\d{4})/i,
];

// ---------------------------------------------------------------------------
// Internal helpers — card extraction
// ---------------------------------------------------------------------------

/**
 * Extract card last 4 digits from an SMS body.
 * Tries multiple patterns in order; returns first match.
 *
 * @param smsBody - The raw SMS message body
 * @returns The last 4 digits string, or null if not found
 */
function extractCardLast4(smsBody: string): string | null {
  for (const pattern of CARD_LAST_4_PATTERNS) {
    const match = pattern.exec(smsBody);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers — sender matching
// ---------------------------------------------------------------------------

/**
 * Check if an SMS sender address matches account-level bank details.
 *
 * Uses case-insensitive bidirectional substring matching to handle
 * variations in how carrier/bank SMS sender names appear.
 *
 * @param smsSenderAddress - The sender address from the SMS
 * @param fields - The comparison targets from bank_details and account
 * @returns Whether the sender matches
 */
function isSenderMatch(
  smsSenderAddress: string,
  {
    bankSmsSenderName,
    bankName,
    accountName,
  }: {
    readonly bankSmsSenderName?: string;
    readonly bankName?: string;
    readonly accountName?: string;
  }
): boolean {
  if (!bankSmsSenderName && !bankName && !accountName) {
    return false;
  }

  const normalizedSender = smsSenderAddress.toLowerCase().trim();
  if (!normalizedSender) {
    return false;
  }
  const normalizedBankSmsSenderName = bankSmsSenderName?.toLowerCase().trim();
  const normalizedBankName = bankName?.toLowerCase().trim();
  const normalizedAccountName = accountName?.toLowerCase().trim();

  // Direct equality check first (fastest path)
  if (
    normalizedSender === normalizedBankSmsSenderName ||
    normalizedSender === normalizedBankName ||
    normalizedSender === normalizedAccountName
  ) {
    return true;
  }

  // Bidirectional substring match — sender contained in target or vice versa
  if (normalizedBankSmsSenderName) {
    if (
      normalizedSender.includes(normalizedBankSmsSenderName) ||
      normalizedBankSmsSenderName.includes(normalizedSender)
    ) {
      return true;
    }
  }

  if (normalizedBankName) {
    if (
      normalizedSender.includes(normalizedBankName) ||
      normalizedBankName.includes(normalizedSender)
    ) {
      return true;
    }
  }

  if (normalizedAccountName) {
    if (
      normalizedSender.includes(normalizedAccountName) ||
      normalizedAccountName.includes(normalizedSender)
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Data Access
// ---------------------------------------------------------------------------

/**
 * Fetches all non-deleted accounts with their bank details for the current user.
 * Optionally filtered by account type (e.g., BANK only for review page).
 *
 * @param userId - The current user's ID
 * @param accountType - Optional filter: "BANK", "CASH", or undefined for all
 * @returns Accounts enriched with bank_details data, sorted by created_at ASC
 */
async function fetchAccountsWithDetails(
  userId: string,
  accountType?: AccountTypeFilter
): Promise<readonly AccountWithBankDetails[]> {
  const clauses = [Q.where("user_id", userId), Q.where("deleted", false)];

  if (accountType) {
    clauses.push(Q.where("type", accountType));
  }

  const accounts = await database
    .get<Account>("accounts")
    .query(...clauses)
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
      currency: account.currency,
      isDefault: account.isDefault,
      createdAt: account.createdAt,
      type: account.type,
      smsSenderName: bankDetails?.smsSenderName ?? undefined,
      bankName: bankDetails?.bankName ?? undefined,
      cardLast4: bankDetails?.cardLast4 ?? undefined,
    });
  }

  // Sort by created_at ASC for deterministic fallback ordering
  results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return results;
}

// ---------------------------------------------------------------------------
// Core matching logic — PURE FUNCTION
// ---------------------------------------------------------------------------

/**
 * Pure function implementing the 5-step account resolution chain.
 * Uses `senderAddress` only — no `financialEntity`.
 *
 * This is the single source of truth used by both:
 * - `resolveAccountForSms` (live detection, single SMS)
 * - `matchTransactionsBatched` (review page, batch processing)
 *
 * @param input - The match criteria (senderAddress, cardLast4, currency)
 * @param accounts - Pre-fetched accounts with bank details
 * @returns The best match, or a "none" match if nothing fits
 */
function matchAccountCore(
  input: MatchInput,
  accounts: readonly AccountWithBankDetails[]
): AccountMatch {
  const { senderAddress, cardLast4, currency } = input;

  // Step 1: Card last 4 + sender match (highest confidence)
  if (cardLast4) {
    for (const acc of accounts) {
      if (acc.cardLast4 && acc.cardLast4 === cardLast4) {
        // Card match found — verify sender also matches for highest confidence
        if (
          isSenderMatch(senderAddress, {
            bankSmsSenderName: acc.smsSenderName,
            bankName: acc.bankName,
            accountName: acc.name,
          })
        ) {
          return {
            accountId: acc.id,
            accountName: acc.name,
            matchReason: "card_last4",
          };
        }
      }
    }

    // Card match without sender verification (still high confidence)
    for (const acc of accounts) {
      if (acc.cardLast4 && acc.cardLast4 === cardLast4) {
        return {
          accountId: acc.id,
          accountName: acc.name,
          matchReason: "card_last4",
        };
      }
    }
  }

  // Step 2: Sender match alone against bank_details / account name
  for (const acc of accounts) {
    if (
      isSenderMatch(senderAddress, {
        bankSmsSenderName: acc.smsSenderName,
        bankName: acc.bankName,
        accountName: acc.name,
      })
    ) {
      return {
        accountId: acc.id,
        accountName: acc.name,
        matchReason: "sms_sender",
      };
    }
  }

  // Step 3: Name + currency match via bank registry
  if (currency) {
    const bankInfo = isKnownFinancialSender(senderAddress);
    if (bankInfo) {
      const normalizedBankName = bankInfo.shortName.toLowerCase().trim();

      for (const acc of accounts) {
        if (acc.currency !== currency) continue;

        const existingName = acc.name.toLowerCase().trim();
        if (
          existingName === normalizedBankName ||
          // Word boundary match: "CIB" matches "CIB Egypt" but not "NCIB"
          new RegExp(`\\b${escapeRegExp(normalizedBankName)}\\b`).test(
            existingName
          ) ||
          new RegExp(`\\b${escapeRegExp(existingName)}\\b`).test(
            normalizedBankName
          )
        ) {
          return {
            accountId: acc.id,
            accountName: acc.name,
            matchReason: "bank_registry",
          };
        }
      }
    }
  }

  // Step 4: Default account fallback
  const defaultAcc = accounts.find((a) => a.isDefault);
  if (defaultAcc) {
    return {
      accountId: defaultAcc.id,
      accountName: defaultAcc.name,
      matchReason: "default",
    };
  }

  // Step 5: First bank account fallback (NEW — sorted by created_at ASC)
  const firstBankAccount = accounts.find((a) => a.type === "BANK");
  if (firstBankAccount) {
    return {
      accountId: firstBankAccount.id,
      accountName: firstBankAccount.name,
      matchReason: "first_bank",
    };
  }

  // No match at all
  return { accountId: "", accountName: "", matchReason: "none" };
}

// ---------------------------------------------------------------------------
// Public API — single transaction matching
// ---------------------------------------------------------------------------

/**
 * Matches a single parsed SMS transaction to the best-fit user account.
 * Maps `ParsedSmsTransaction` → `MatchInput` and delegates to `matchAccountCore`.
 *
 * @param transaction - The parsed SMS transaction
 * @param accounts - Pre-fetched list of accounts with bank details
 * @returns The best match, or a "none" match if nothing fits
 */
function matchTransaction(
  transaction: ParsedSmsTransaction,
  accounts: readonly AccountWithBankDetails[]
): AccountMatch {
  const input: MatchInput = {
    senderAddress: transaction.senderAddress,
    cardLast4: transaction.cardLast4 ?? undefined,
    currency: transaction.currency ?? undefined,
  };

  return matchAccountCore(input, accounts);
}

// ---------------------------------------------------------------------------
// Public API — batched matching for review page
// ---------------------------------------------------------------------------

/**
 * Matches parsed SMS transactions to user accounts in batches.
 * Fetches accounts once, then processes ~20 txns/batch, calling
 * `matchAccountCore` for each. Yields results via callback for
 * progressive rendering.
 *
 * @param transactions - Array of parsed SMS transactions
 * @param userId - Current user's ID
 * @param batchSize - Number of transactions per batch (default: 20)
 * @param onBatchComplete - Called after each batch with index → match map
 */
async function matchTransactionsBatched(
  transactions: readonly ParsedSmsTransaction[],
  userId: string,
  batchSize: number = DEFAULT_BATCH_SIZE,
  onBatchComplete: (batch: ReadonlyMap<number, AccountMatch>) => void
): Promise<void> {
  const accounts = await fetchAccountsWithDetails(userId);

  for (let start = 0; start < transactions.length; start += batchSize) {
    const end = Math.min(start + batchSize, transactions.length);
    const batchResults = new Map<number, AccountMatch>();

    for (let i = start; i < end; i++) {
      batchResults.set(i, matchTransaction(transactions[i], accounts));
    }

    onBatchComplete(batchResults);

    // Yield to the event loop between batches for progressive rendering
    if (end < transactions.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — legacy bulk matching (kept for backward compatibility)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  CARD_LAST_4_PATTERNS,
  extractCardLast4,
  fetchAccountsWithDetails,
  isSenderMatch,
  matchAccountCore,
  matchAllTransactions,
  matchTransaction,
  matchTransactionsBatched,
};

export type {
  AccountMatch,
  AccountTypeFilter,
  AccountWithBankDetails,
  MatchInput,
  MatchReason,
};
