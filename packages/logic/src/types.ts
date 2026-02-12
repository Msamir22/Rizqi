/**
 * Core types for Astik application
 */

import { CurrencyType, SupabaseDatabase, TransactionType } from "@astik/db";

export type DailySnapshotNetWorth =
  SupabaseDatabase["public"]["Tables"]["daily_snapshot_net_worth"]["Row"];

export interface NetWorthComparison {
  currentNetWorth: number;
  previousNetWorth: number | null;
  percentageChange: number | null;
  comparisonDate: string | null;
}

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
