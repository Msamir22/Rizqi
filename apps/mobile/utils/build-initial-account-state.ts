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
import {
  type ParsedSmsTransaction,
  isKnownFinancialSender,
  type BankInfo,
} from "@astik/logic";

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
  groups: ReadonlyMap<string, GroupedTransactionsBySender>
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};

  for (const group of groups.values()) {
    const matched = await resolveAccountForSms(
      group.senderAddress,
      group.smsBody
    );

    if (matched) {
      mapping[group.senderAddress] = matched.accountId;
    }
  }

  return mapping;
}

/**
 * Map a bank registry InstitutionType to an AccountType.
 * "bank" → BANK; wallet/payment/bnpl → DIGITAL_WALLET.
 */
function mapRegistryType(type: BankInfo["type"]): AccountType {
  if (type === "bank") return "BANK";
  return "DIGITAL_WALLET";
}

/** Max number of deterministic account suggestions to show. */
const MAX_SUGGESTIONS = 5;

/**
 * Build deterministic account suggestions from transaction sender addresses
 * matched against the Egyptian bank registry.
 *
 * Deduplicates by shortName + currency (keeps the most frequent match),
 * marks the most frequent suggestion as default, and caps at {@link MAX_SUGGESTIONS}.
 *
 * @param groups - Sender groups from {@link groupTransactionsBySender}
 * @returns Account card state array (deterministic, no AI).
 */
function buildDeterministicSuggestions(
  groups: ReadonlyMap<string, GroupedTransactionsBySender>
): AccountCardState[] {
  // Deduplicate by shortName|currency, keeping the highest transaction count
  const deduped = new Map<
    string,
    { info: BankInfo; currency: CurrencyType; count: number }
  >();

  for (const group of groups.values()) {
    const bankInfo = isKnownFinancialSender(group.senderAddress);
    if (!bankInfo) continue;

    const key = `${bankInfo.shortName.toLowerCase()}|${group.currency}`;
    const existing = deduped.get(key);

    // Same bank may appear under multiple sender IDs (e.g. "cib" and "cibeg").
    // Keep only the entry with the highest transaction count so that the
    // frequency-based default selection (most-used bank = default) stays accurate.
    if (!existing || group.count > existing.count) {
      deduped.set(key, {
        info: bankInfo,
        currency: group.currency,
        count: group.count,
      });
    }
  }

  if (deduped.size === 0) return [];

  // Sort by count descending, limit to MAX_SUGGESTIONS
  const sorted = [...deduped.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SUGGESTIONS);

  return sorted.map((entry, index) => ({
    key: generateAccountCardKey(),
    name: entry.info.shortName,
    accountType: mapRegistryType(entry.info.type),
    currency: entry.currency,
    isDefault: index === 0, // Most frequent = default
  }));
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
 * 3. {@link buildDeterministicSuggestions} — derive suggestions from bank registry
 *
 * @param transactions - Parsed SMS transactions from AI
 * @returns Account cards + auto-linked mapping
 */
export async function buildInitialAccountState(
  transactions: readonly ParsedSmsTransaction[]
): Promise<InitialAccountState> {
  const senderGroups = groupTransactionsBySender(transactions);
  const existingAccountMapping =
    await matchGroupsToExistingAccounts(senderGroups);

  // Exclude senders already linked to existing accounts so we don't
  // generate duplicate "new account" cards for them.
  const unmatchedGroups = new Map(
    [...senderGroups.entries()].filter(
      ([, group]) => existingAccountMapping[group.senderAddress] === undefined
    )
  );
  const cards = buildDeterministicSuggestions(unmatchedGroups);

  return { cards, existingAccountMapping };
}
