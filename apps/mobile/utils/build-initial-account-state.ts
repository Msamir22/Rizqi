/**
 * Build Initial Account State
 *
 * Pure utility that computes initial account cards and auto-linked
 * account mappings from parsed SMS transactions, existing bank accounts,
 * and AI account suggestions.
 *
 * Framework-agnostic — uses plain interfaces rather than WatermelonDB models.
 *
 * @module build-initial-account-state
 */

import { resolveAccountForSms } from "@/services/sms-account-resolver";
import type { AccountType, CurrencyType } from "@astik/db";
import { ParsedSmsAccountSuggestion, ParsedSmsTransaction } from "@astik/logic";
import { Database } from "@nozbe/watermelondb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal representation of an existing bank account with optional bank details. */
export interface ExistingBankAccount {
  readonly id: string;
  readonly name: string;
  readonly currency: CurrencyType;
  readonly bankDetails?: {
    readonly smsSenderName?: string;
    readonly cardLast4?: string;
  };
}

/** Form data for a single account card (framework-agnostic). */
export interface AccountCardState {
  readonly key: string;
  name: string;
  accountType: AccountType;
  currency: CurrencyType;
  isDefault: boolean;
}

/** Result of building the initial account setup state. */
export interface InitialAccountState {
  /** Account cards for new accounts suggested by AI */
  readonly cards: readonly AccountCardState[];
  /** Auto-linked financial entities: financialEntity → existing account ID */
  readonly existingAccountMapping: Readonly<Record<string, string>>;
}

/** A group of transactions sharing the same financial entity and currency. */
interface GroupedTransactionsBySender {
  readonly senderAddress: string;
  readonly currency: CurrencyType;
  readonly cardLast4?: string;
  readonly smsBody: string;
  readonly count: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Generate a short random key for new account cards. */
export function generateAccountCardKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Group transactions by composite key `financialEntity::currency`.
 *
 * Deduplicates transactions from the same entity+currency pair and
 * preserves the first `cardLast4` seen for bank account matching.
 *
 * @param transactions - Parsed SMS transactions from AI
 * @returns Map of composite key → grouped sender data
 */
function groupTransactionsBySender(
  transactions: readonly ParsedSmsTransaction[]
): ReadonlyMap<string, GroupedTransactionsBySender> {
  const groups = new Map<string, GroupedTransactionsBySender>();

  for (const tx of transactions) {
    const entityKey = (
      tx.financialEntity?.trim() || tx.senderAddress
    ).toLowerCase();
    const compositeKey = `${entityKey}::${tx.currency}`;
    const existing = groups.get(compositeKey);

    if (!existing) {
      groups.set(compositeKey, {
        senderAddress: tx.senderAddress,
        currency: tx.currency,
        cardLast4: tx.cardLast4,
        smsBody: tx.rawSmsBody,
        count: 1,
      });
    } else {
      groups.set(compositeKey, {
        ...existing,
        count: existing.count + 1,
      });
    }
  }

  return groups;
}

/**
 * Match sender groups against existing accounts by cardLast4,
 * smsSenderName, or fuzzy name+currency match.
 *
 * @param groups - Sender groups from `groupTransactionsBySender`
 * @param existingAccounts - User's existing bank accounts with details
 * @returns Mapping of senderAddress → matched existing account ID
 */
async function matchGroupsToExistingAccounts(
  groups: ReadonlyMap<string, GroupedTransactionsBySender>,
  db: Database
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};

  for (const group of groups.values()) {
    const matched = await resolveAccountForSms(
      group.senderAddress,
      group.smsBody,
      db
    );

    if (matched) {
      mapping[group.senderAddress] = matched.accountId;
    }
  }

  return mapping;
}

/**
 * Convert AI account suggestions into account card state,
 * ensuring exactly one card is marked as default.
 *
 * @param suggestions - AI-suggested accounts to create
 * @returns Account card state array
 */
function suggestionsToCards(
  suggestions: readonly ParsedSmsAccountSuggestion[]
): AccountCardState[] {
  if (suggestions.length === 0) return [];

  const cards: AccountCardState[] = suggestions.map((s) => ({
    key: generateAccountCardKey(),
    name: s.name,
    accountType: s.accountType,
    currency: s.currency,
    isDefault: s.isDefault,
  }));

  // Ensure exactly one default
  const firstDefaultIndex = cards.findIndex((c) => c.isDefault);
  if (firstDefaultIndex === -1) {
    cards[0] = { ...cards[0], isDefault: true };
  } else {
    for (let i = 0; i < cards.length; i++) {
      cards[i] = { ...cards[i], isDefault: i === firstDefaultIndex };
    }
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the initial account setup state for the SMS review wizard.
 *
 * Composes three pure steps:
 * 1. {@link groupTransactionsBySender} — deduplicate by entity+currency
 * 2. {@link matchGroupsToExistingAccounts} — auto-link to existing accounts
 * 3. {@link suggestionsToCards} — map AI suggestions to editable card state
 *
 * @param transactions - Parsed SMS transactions from AI
 * @param existingAccounts - User's existing bank accounts with details
 * @param aiSuggestions - AI-suggested accounts to create
 * @returns Account cards + auto-linked mapping
 */
export async function buildInitialAccountState(
  transactions: readonly ParsedSmsTransaction[],
  aiSuggestions: readonly ParsedSmsAccountSuggestion[],
  db: Database
): Promise<InitialAccountState> {
  const senderGroups = groupTransactionsBySender(transactions);
  const existingAccountMapping = await matchGroupsToExistingAccounts(
    senderGroups,
    db
  );
  const cards = suggestionsToCards(aiSuggestions);

  return { cards, existingAccountMapping };
}
