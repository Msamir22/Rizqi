/**
 * Core types for Astik application
 */

import type {
  AccountType,
  Category,
  CurrencyType,
  Transaction,
  TransactionType,
} from "@astik/db";

// ---------------------------------------------------------------------------
// Shared Transaction Interfaces
// ---------------------------------------------------------------------------

/**
 * Common interface for parsed transactions shared by the generic
 * TransactionReview component. Both SMS and Voice parsers produce
 * types that satisfy this contract.
 *
 * Architecture & Design Rationale:
 * - Pattern: Common Interface (ISP — Interface Segregation Principle)
 * - Why: The review component needs a contract that works for both
 *   SMS and Voice transactions without knowing the source.
 */
export interface ReviewableTransaction {
  readonly amount: number;
  readonly currency: CurrencyType;
  readonly type: TransactionType;
  readonly counterparty: string;
  readonly date: Date;
  readonly categoryId: Category["id"];
  readonly categoryDisplayName: Category["displayName"];
  /** Parsing confidence score (0–1) */
  readonly confidence: number;
  /** AI-matched account ID (undefined if no match) */
  readonly accountId?: string;
}

/**
 * Voice-specific parsed transaction.
 * Extends ReviewableTransaction with fields unique to voice input.
 */
export interface ParsedVoiceTransaction extends ReviewableTransaction {
  /** AI-extracted description/note */
  readonly note: string;
  /** Original spoken text in the user's language */
  readonly originalTranscript: string;
  /** ISO 639-1 language code detected by the AI (e.g., "ar", "en") */
  readonly detectedLanguage: string;
}

// ---------------------------------------------------------------------------
// Voice Parser Error
// ---------------------------------------------------------------------------

/** Error types for structured voice parser error handling */
export type VoiceParserErrorKind = "timeout" | "network" | "empty" | "unknown";

/** Structured error returned by parseVoiceWithAi instead of throwing. */
export interface VoiceParserError {
  readonly kind: VoiceParserErrorKind;
  readonly message: string;
}

export interface ParsedNotification {
  type: TransactionType;
  amount: number;
  currency: CurrencyType;
  counterparty?: string;
  description: string;

  // Account matching data
  cardLast4?: string;
  accountNumber?: string;
  bankIdentifier?: string;

  // Balance sync
  availableBalance?: number;

  // Reference tracking
  reference?: string;

  // Auto-detected category
  detectedCategory?: string | null;
}

/**
 * Raw SMS message from the Android SMS inbox.
 * Represents a single entry from the device SMS ContentProvider.
 */
export interface SmsMessage {
  readonly id: string;
  readonly address: string;
  readonly body: string;
  /** Timestamp in milliseconds since epoch */
  readonly date: number;
  readonly read: boolean;
}

/**
 * Fully parsed SMS transaction ready for user review.
 * Contains all extracted financial data and metadata needed for saving.
 */
export interface ParsedSmsTransaction {
  readonly amount: number;
  readonly currency: CurrencyType;
  readonly type: TransactionType;
  readonly counterparty: string;
  readonly date: Date;
  readonly smsBodyHash: string;
  readonly senderDisplayName: string;
  readonly categoryId: Category["id"];
  readonly categoryDisplayName: Category["displayName"];
  readonly rawSmsBody: string;
  /** Parsing confidence score (0–1) */
  readonly confidence: number;
  /** AI-extracted merchant name (may differ from counterparty) */
  readonly merchant?: Transaction["counterparty"];
  /** True if this is an ATM/Bank cash withdrawal (should be saved as transfer) */
  readonly isAtmWithdrawal?: boolean;
  /** Last 4 digits of card extracted from SMS (for bank account matching) */
  readonly cardLast4?: string;
  /** AI-matched account ID from voice input (undefined if no match) */
  readonly accountId?: string;
}

export interface ParsedSmsAccountSuggestion {
  readonly name: string;
  readonly currency: CurrencyType;
  readonly accountType: AccountType;
  readonly isDefault: boolean;
}
