/**
 * SMS Account Resolver
 *
 * Resolves which account an incoming SMS transaction belongs to by
 * matching against the `bank_details` table in WatermelonDB.
 *
 * Architecture & Design Rationale:
 * - Pattern: Chain of Responsibility (3-step resolution)
 * - Why: Multiple resolution strategies tried in priority order.
 *   Each step is independent and handles the optional nature of
 *   bank_details gracefully — if no records exist, falls to default.
 * - SOLID: OCP — new resolution strategies can be inserted without
 *   modifying existing ones. SRP — only resolves accounts, no DB writes.
 *
 * Resolution chain:
 * 1. Sender name + card last 4 digits → highest confidence (1.0)
 * 2. Sender name only → medium confidence (0.7)
 * 3. Default account from user Settings → fallback (0.3)
 *
 * @module sms-account-resolver
 */

import { Q, type Database } from "@nozbe/watermelondb";
import type { BankDetails, Account } from "@astik/db";
import { getDefaultAccountId } from "./sender-account-mapping";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Match type indicating how the account was resolved */
type MatchType = "sender_and_card" | "sender_only" | "default";

/** Result of account resolution */
export interface ResolvedAccount {
  readonly accountId: string;
  readonly accountName: string;
  readonly matchType: MatchType;
  readonly confidence: number;
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
 * @param bankSenderName    - The sms_sender_name from bank_details
 * @returns Whether the sender matches
 */
function isSenderMatch(
  smsSenderAddress: string,
  bankSenderName: string
): boolean {
  const normalizedSender = smsSenderAddress.toLowerCase().trim();
  const normalizedBank = bankSenderName.toLowerCase().trim();

  // Direct equality
  if (normalizedSender === normalizedBank) {
    return true;
  }

  // Substring match (sender contains bank name or vice versa)
  return (
    normalizedSender.includes(normalizedBank) ||
    normalizedBank.includes(normalizedSender)
  );
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
        Q.where("sms_sender_name", Q.notEq(null))
      )
    )
    .fetch();

  // Extract card last 4 from SMS body for Step 1 matching
  const cardFromSms = extractCardLast4(smsBody);

  // Track best sender-only match for Step 2 fallback
  let senderOnlyCandidate: {
    readonly bankDetail: BankDetails;
  } | null = null;

  for (const detail of bankDetails) {
    const senderName = (detail as unknown as { sms_sender_name: string })
      .sms_sender_name;
    if (!senderName) {
      continue;
    }

    if (!isSenderMatch(senderAddress, senderName)) {
      continue;
    }

    // Sender matches — now try card matching (Step 1)
    const cardOnRecord = (detail as unknown as { card_last_4: string | null })
      .card_last_4;

    if (cardFromSms && cardOnRecord && cardFromSms === cardOnRecord) {
      // Step 1: Exact match — sender + card both match
      const account = await fetchAccount(db, detail.accountId);
      if (account) {
        return {
          accountId: detail.accountId,
          accountName: account.name,
          matchType: "sender_and_card",
          confidence: 1.0,
        };
      }
    }

    // Save as sender-only candidate for Step 2
    if (!senderOnlyCandidate) {
      senderOnlyCandidate = { bankDetail: detail };
    }
  }

  // Step 2: Sender-only match (no card verification)
  if (senderOnlyCandidate) {
    const account = await fetchAccount(
      db,
      senderOnlyCandidate.bankDetail.accountId
    );
    if (account) {
      return {
        accountId: senderOnlyCandidate.bankDetail.accountId,
        accountName: account.name,
        matchType: "sender_only",
        confidence: 0.7,
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
        matchType: "default",
        confidence: 0.3,
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
    const isDeleted = (account as unknown as { deleted: boolean }).deleted;
    if (isDeleted) {
      return null;
    }
    return account;
  } catch {
    // Account not found
    return null;
  }
}
