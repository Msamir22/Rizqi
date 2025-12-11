/**
 * Core types for Astik application
 */

export type Currency = "EGP" | "USD" | "XAU";

export type AccountType = "CASH" | "BANK" | "GOLD" | "ASSET";

export type GoldKarat = 24 | 22 | 21 | 18 | 14 | 10;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  is_liquid: boolean;

  // Optional bank integration fields
  bank_name?: string;
  card_last_4?: string;
  account_number?: string;

  // Gold-specific fields
  gold_karat?: GoldKarat;
  gold_weight_grams?: number;

  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: Currency;
  category: string;
  merchant?: string;
  account_id: string;
  note: string;
  is_draft: boolean;
  is_expense: boolean;

  // Source tracking
  notification_source?: "bank_sms" | "voice" | "manual";

  created_at: Date;
}

export interface MarketRates {
  metals: {
    gold: number;
    silver: number;
    platinum: number;
    palladium: number;
  };
  currencies: Record<string, number>; // e.g., { "EGP": 30.85, "EUR": 1.08 }
  timestamp: string;
}

export interface ParsedVoiceTransaction {
  amount: number;
  currency: Currency;
  merchant?: string;
  description?: string;
  detectedCategory?: string | null;
  confidence: number; // 0-1, for category detection
  isIncome?: boolean;
  detectedLanguage?: "ar" | "en";
}

export interface ParsedNotification {
  type: "EXPENSE" | "INCOME";
  amount: number;
  currency: Currency;
  merchant?: string;
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

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Health",
  "Education",
  "Housing",
  "Transfer",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
