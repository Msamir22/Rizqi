/**
 * Core types for Astik application
 */

import { CurrencyType, TransactionType } from "@astik/db";

export interface ParsedVoiceTransaction {
  amount: number;
  currency: CurrencyType;
  counterparty?: string;
  description?: string;
  detectedCategory?: string | null;
  confidence: number; // 0-1, for category detection
  isIncome?: boolean;
  detectedLanguage?: "ar" | "en";
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
  readonly senderAddress: string;
  readonly senderDisplayName: string;
  /** Stable sender config ID for account mapping (e.g., "cib", "nbe"). Optional — AI path uses senderAddress instead. */
  readonly senderConfigId?: string;
  readonly categorySystemName: string;
  readonly rawSmsBody: string;
  /** Parsing confidence score (0–1) */
  readonly confidence: number;
  /** AI-extracted merchant name (may differ from counterparty) */
  readonly merchant?: string;
  /** AI-extracted bank/wallet/fintech name from message content */
  readonly financialEntity?: string;
  /** True if this is an ATM/Bank cash withdrawal (should be saved as transfer) */
  readonly isAtmWithdrawal?: boolean;
  /** Last 4 digits of card extracted from SMS (for bank account matching) */
  readonly cardLast4?: string;
}
