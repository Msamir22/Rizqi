/**
 * SMS Account Resolver
 *
 * Resolves which account an incoming SMS transaction belongs to by
 * matching against the `bank_details` table in WatermelonDB.
 *
 * @module sms-account-resolver
 */

import { Q, type Database } from "@nozbe/watermelondb";
import type { BankDetails, Account } from "@astik/db";
import { getDefaultAccountId } from "./sender-account-mapping";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of account resolution */
export interface ResolvedAccount {
  readonly accountId: string;
  readonly accountName: string;
}

// ---------------------------------------------------------------------------
// Card extraction
// ---------------------------------------------------------------------------

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
// Sender matching
// ---------------------------------------------------------------------------

/**
 * Check if an SMS sender address matches a bank_details sms_sender_name.
 *
 * Uses case-insensitive substring matching to handle variations
 * in how carrier/bank SMS sender names appear.
 *
 * @param smsSenderAddress  - The sender address from the SMS
 * @param { bankSmsSenderName, bankName, accountName } - The sms_sender_name , bankName from bank_details & accountName
 * @returns Whether the sender matches
 */
function isSenderMatch(
  smsSenderAddress: string,
  {
    bankSmsSenderName,
    bankName,
    accountName,
  }: {
    bankSmsSenderName?: string;
    bankName?: string;
    accountName?: string;
  }
): boolean {
  if (!bankSmsSenderName && !bankName && !accountName) {
    return false;
  }

  const normalizedSender = smsSenderAddress.toLowerCase().trim();
  const normalizedBankSmsSenderName = bankSmsSenderName?.toLowerCase().trim();
  const normalizedBankName = bankName?.toLowerCase().trim();
  const normalizedAccountName = accountName?.toLowerCase().trim();

  // Direct equality
  if (
    normalizedSender === normalizedBankSmsSenderName ||
    normalizedSender === normalizedBankName ||
    normalizedSender === normalizedAccountName
  ) {
    return true;
  }

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve which account an incoming SMS transaction belongs to.
 *
 * Resolution chain (highest confidence → lowest):
 * 1. SMS sender + card last 4 digits match a bank_details record → 1.0
 * 2. SMS sender alone matches a bank_details record → 0.7
 * 3. Default account from user Settings → 0.3
 *
 * @param senderAddress - The SMS sender address (e.g., "CIB", "NBE")
 * @param smsBody       - The raw SMS body text
 * @param db            - WatermelonDB database instance
 * @returns Resolved account with match details, or null if no match
 */
export async function resolveAccountForSms(
  senderAddress: string,
  smsBody: string,
  db: Database
): Promise<ResolvedAccount | null> {
  // Step 1 & 2: Query bank_details with non-null sms_sender_name
  const bankDetails = await db
    .get<BankDetails>("bank_details")
    .query(
      Q.and(
        Q.where("deleted", Q.notEq(true)),
        Q.or(
          Q.where("sms_sender_name", Q.notEq(null)),
          Q.where("card_last_4", Q.notEq(null))
        )
      )
    )
    .fetch();

  // Extract card last 4 from SMS body for Step 1 matching
  const cardFromSms = extractCardLast4(smsBody);

  for (const detail of bankDetails) {
    const account = await detail.account.fetch();
    // Skip soft-deleted accounts in the primary matching path
    if (!account || account.deleted) {
      continue;
    }
    const isCardMatch = cardFromSms && cardFromSms === detail.cardLast4;

    if (
      isCardMatch ||
      isSenderMatch(senderAddress, {
        bankSmsSenderName: detail.smsSenderName,
        bankName: detail.bankName,
        accountName: account.name,
      })
    ) {
      return {
        accountId: account.id,
        accountName: account.name,
      };
    }
  }

  // Step 3: Default account fallback
  const defaultAccountId = await getDefaultAccountId();
  if (defaultAccountId) {
    const account = await fetchAccount(db, defaultAccountId);
    if (account) {
      return {
        accountId: defaultAccountId,
        accountName: account.name,
      };
    }
  }

  // No resolution possible — caller should prompt user to configure
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch an account by ID from WatermelonDB.
 * Returns null if the account doesn't exist or is deleted.
 */
async function fetchAccount(
  db: Database,
  accountId: string
): Promise<Account | null> {
  try {
    const account = await db.get<Account>("accounts").find(accountId);
    if (account.deleted) {
      return null;
    }

    return account;
  } catch {
    // Account not found
    return null;
  }
}
