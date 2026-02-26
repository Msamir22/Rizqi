/**
 * @deprecated MARKED FOR DELETION — Replaced by AI-driven parsing.
 * New approach: `sms-keyword-filter.ts` (on-device) + Gemini Edge Function (cloud).
 * Kept temporarily until AI approach is validated in production.
 */

/**
 * Financial Sender Registry
 *
 * Typed registry of Egyptian financial SMS senders. Each entry defines
 * sender address patterns, display name, default category mapping, and
 * regex templates for extracting structured transaction data.
 *
 * Design Rationale:
 * - Each sender config is self-contained (Single Responsibility)
 * - New senders are added without modifying parser logic (Open/Closed)
 * - Named capture groups make extraction explicit and debuggable
 *
 * @module financial-sender-registry
 */

import type { AccountType, TransactionType } from "@astik/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single SMS template with a regex pattern and metadata for extraction.
 * The regex MUST use named capture groups for `amount` at minimum.
 * Optional groups: `counterparty`, `date`, `reference`, `currency`.
 */
export interface SmsTemplate {
  /** Regex with named capture groups. Applied against the SMS body. */
  readonly pattern: RegExp;
  /** Whether this template matches an EXPENSE or INCOME */
  readonly transactionType: TransactionType;
  /** Short label describing this template (for debugging / logging) */
  readonly label: string;
}

/**
 * Configuration for a single financial SMS sender (bank, wallet, etc.).
 */
export interface FinancialSenderConfig {
  /** Stable unique identifier for mapping (e.g., "cib", "nbe", "vodafone_cash") */
  readonly id: string;
  /** Whether this sender represents an institution (creates an account) or a channel (maps to existing) */
  readonly senderType: "institution" | "channel";
  /** Regex patterns matching the SMS "address" / sender field */
  readonly senderPatterns: readonly RegExp[];
  /** Human-readable name shown in the review UI */
  readonly displayName: string;
  /** Default L1/L2 category system_name (fallback when keyword mapping misses) */
  readonly defaultCategorySystemName: string;
  /** Suggested account type for auto-populating the account creation form */
  readonly suggestedAccountType?: AccountType;
  /** Ordered list of templates to try against SMS body */
  readonly templates: readonly SmsTemplate[];
}

// ---------------------------------------------------------------------------
// Amount parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse an amount string that may contain Arabic/English digits and commas.
 * Examples: "1,235.00", "1235", "١٬٢٣٥٫٠٠"
 */
export function parseAmount(raw: string): number {
  // Replace Arabic-Indic digits with Western digits
  const westernised = raw
    .replace(/٬/g, ",") // Arabic thousands separator → comma
    .replace(/٫/g, ".") // Arabic decimal separator → dot
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  // Remove commas used as thousands separators
  const cleaned = westernised.replace(/,/g, "");
  const parsed = parseFloat(cleaned);

  return Number.isNaN(parsed) ? 0 : parsed;
}

// ---------------------------------------------------------------------------
// Sender Registry
// ---------------------------------------------------------------------------

/**
 * Registry of all supported Egyptian financial SMS senders.
 *
 * NOTE: Regex templates here are intentionally basic placeholders.
 * Phase 5 (US3 / T027) will populate detailed, production-ready regex
 * patterns tested against real Egyptian bank SMS formats.
 */
export const FINANCIAL_SENDER_REGISTRY: readonly FinancialSenderConfig[] = [
  // ── Instapay ──────────────────────────────────────────────────────────
  {
    id: "instapay",
    senderType: "channel",
    senderPatterns: [/^Instapay$/i, /^IPN$/i, /^InstaPay$/i, /^INSTAPAY$/i],
    displayName: "Instapay",
    defaultCategorySystemName: "transfers",
    templates: [
      {
        label: "instapay-sent",
        transactionType: "EXPENSE",
        // Real: "IPN transfer sent with amount of EGP 15000.00 from 7660 on 22/02 at 09:23 PM. Ref# 7ccb05f3. For more details call 19700."
        // Also: "IPN transfer sent with amount of EGP 1,500.00 from Acc ...1234 to Mohamed Ali on 15/02"
        pattern:
          /transfer\s+sent\s+.*?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:.*?to\s+(?<counterparty>(?:(?!\s+on\s)[^,.\n])+))?(?:.*?on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
      {
        label: "instapay-received",
        transactionType: "INCOME",
        // "IPN transfer received with amount of EGP 2,000.00 to Acc ...5678 from Ahmed Hassan on 15/02"
        pattern:
          /transfer\s+received\s+.*?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:.*?from\s+(?<counterparty>(?:(?!\s+on\s)[^,.\n])+))?(?:.*?on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
    ],
  },

  // ── NBE (National Bank of Egypt) ──────────────────────────────────────
  {
    id: "nbe",
    senderType: "institution",
    senderPatterns: [
      /^NBE$/i,
      /^NBEEG$/i,
      /^National\s*Bank$/i,
      /^NBEbank$/i,
      /^NBE\s*EGYPT$/i,
      /^NBEmobile$/i,
    ],
    displayName: "National Bank of Egypt",
    defaultCategorySystemName: "banking",
    suggestedAccountType: "BANK",
    templates: [
      {
        label: "nbe-purchase",
        transactionType: "EXPENSE",
        // "Purchase of EGP 350.00 at Carrefour on card ending 1234 on 15/02/25"
        pattern:
          /(?:purchase|POS)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+at\s+(?<counterparty>(?:(?!\s+on\s|\s+was\s)[^,\n])+))?(?:\s+on\s+(?:card\s+ending\s+\d+\s+)?(?:on\s+)?(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
      {
        label: "nbe-debit",
        transactionType: "EXPENSE",
        // "A debit transaction of EGP 1,200.00 has been made on your account"
        // "Debit of EGP 500 from your account ending 4321"
        pattern:
          /(?:debit|withdrawal|ATM)\s+(?:transaction\s+)?(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?/i,
      },
      {
        label: "nbe-credit",
        transactionType: "INCOME",
        // "Credit of EGP 5,000.00 to your account ending 5678 on 15/02"
        // "A credit/salary of EGP 12,500.00 has been deposited"
        pattern:
          /(?:credit|deposit|salary|received)\s+(?:transaction\s+)?(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:.*?(?:from\s+(?<counterparty>(?:(?!\s+on\s)[^,\n])+))?)?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
    ],
  },

  // ── CIB ───────────────────────────────────────────────────────────────
  {
    id: "cib",
    senderType: "institution",
    senderPatterns: [/^CIB$/i, /^CIBEgypt$/i, /^CIBank$/i, /^CIB\s*EGYPT$/i],
    displayName: "CIB",
    defaultCategorySystemName: "banking",
    suggestedAccountType: "BANK",
    templates: [
      {
        label: "cib-purchase",
        transactionType: "EXPENSE",
        // "CIB: A POS purchase of EGP 1,247.50 at Amazon.eg was made on your card ending 9012 on 15/02/25"
        pattern:
          /(?:POS\s+)?purchase\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+at\s+(?<counterparty>(?:(?!\s+on\s|\s+was\s)[^,\n])+))?(?:\s+(?:was\s+made\s+)?on\s+(?:your\s+)?card\s+ending\s+\d+)?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
      {
        label: "cib-debit",
        transactionType: "EXPENSE",
        // "CIB: EGP 2,500.00 was debited from your account ending 3456"
        // "CIB: Debit of EGP 800 from your account"
        pattern:
          /(?:(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)\s*(?:EGP)?\s+was\s+debited|debit\s+(?:of\s+)?(?:EGP\s*)?(?<amount2>[\d,]+(?:\.\d+)?)\s*(?:EGP)?)/i,
      },
      {
        label: "cib-credit",
        transactionType: "INCOME",
        // "CIB: EGP 10,000.00 was credited to your account ending 7890"
        pattern:
          /(?:(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)\s*(?:EGP)?\s+was\s+credited|credit\s+(?:of\s+)?(?:EGP\s*)?(?<amount2>[\d,]+(?:\.\d+)?)\s*(?:EGP)?)/i,
      },
    ],
  },

  // ── Vodafone Cash ─────────────────────────────────────────────────────
  {
    id: "vodafone_cash",
    senderType: "institution",
    senderPatterns: [
      /^Vodafone\s*Cash$/i,
      /^VFCash$/i,
      /^VF-Cash$/i,
      /^VODAFONE$/i,
      /^VF$/i,
    ],
    displayName: "Vodafone Cash",
    defaultCategorySystemName: "digital_wallets",
    suggestedAccountType: "DIGITAL_WALLET",
    templates: [
      {
        label: "vfcash-sent",
        transactionType: "EXPENSE",
        // "You have successfully sent EGP 500.00 to 01012345678"
        // "Vodafone Cash: Transfer of EGP 1,000 to Mohamed Ali"
        pattern:
          /(?:sent|transfer(?:red)?(?:\s+of)?|paid)\s+(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+to\s+(?<counterparty>[^.\n]+))?/i,
      },
      {
        label: "vfcash-received",
        transactionType: "INCOME",
        // "You have received EGP 750.00 from 01098765432"
        pattern:
          /(?:received)\s+(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+from\s+(?<counterparty>[^.\n]+))?/i,
      },
      {
        label: "vfcash-payment",
        transactionType: "EXPENSE",
        // "Payment of EGP 200.00 for Electricity bill"
        pattern:
          /(?:payment)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+for\s+(?<counterparty>(?:(?!\s+has\s|\s+was\s)[^.\n])+))?/i,
      },
    ],
  },

  // ── Fawry ─────────────────────────────────────────────────────────────
  {
    id: "fawry",
    senderType: "channel",
    senderPatterns: [/^Fawry$/i, /^FAWRY$/i, /^FawryPay$/i],
    displayName: "Fawry",
    defaultCategorySystemName: "bills",
    templates: [
      {
        label: "fawry-payment",
        transactionType: "EXPENSE",
        // "Your payment of EGP 150.00 for WE Internet bill has been confirmed. Ref: 12345678"
        // "Fawry: You paid EGP 350 for Electricity"
        pattern:
          /(?:payment\s+(?:of\s+)?|paid\s+)(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+for\s+(?<counterparty>(?:(?!\s+has\s|\s+was\s)[^.\n])+))?(?:\s+(?:has been|was)\s+(?:confirmed|successful))?/i,
      },
      {
        label: "fawry-refund",
        transactionType: "INCOME",
        // "Your refund of EGP 200.00 has been processed"
        pattern:
          /refund\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?/i,
      },
    ],
  },

  // ── Etisalat Cash ─────────────────────────────────────────────────────
  {
    id: "etisalat_cash",
    senderType: "institution",
    senderPatterns: [
      /^Etisalat\s*Cash$/i,
      /^ECash$/i,
      /^ETISALAT$/i,
      /^ET\s*Cash$/i,
    ],
    displayName: "Etisalat Cash",
    defaultCategorySystemName: "digital_wallets",
    suggestedAccountType: "DIGITAL_WALLET",
    templates: [
      {
        label: "etisalat-sent",
        transactionType: "EXPENSE",
        // "You sent EGP 300.00 to 01112345678"
        // "Transfer of EGP 500 to Ahmed"
        pattern:
          /(?:sent|transfer(?:red)?(?:\s+of)?|paid)\s+(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+to\s+(?<counterparty>[^.\n]+))?/i,
      },
      {
        label: "etisalat-received",
        transactionType: "INCOME",
        // "You received EGP 400.00 from 01198765432"
        pattern:
          /(?:received)\s+(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+from\s+(?<counterparty>[^.\n]+))?/i,
      },
      {
        label: "etisalat-payment",
        transactionType: "EXPENSE",
        // "Bill payment of EGP 250 for Mobile Recharge"
        pattern:
          /(?:payment)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+for\s+(?<counterparty>(?:(?!\s+has\s|\s+was\s)[^.\n])+))?/i,
      },
    ],
  },

  // ── Orange Cash ───────────────────────────────────────────────────────
  {
    id: "orange_cash",
    senderType: "institution",
    senderPatterns: [/^Orange\s*Cash$/i, /^ORANGE$/i, /^OrangeMoney$/i],
    displayName: "Orange Cash",
    defaultCategorySystemName: "digital_wallets",
    suggestedAccountType: "DIGITAL_WALLET",
    templates: [
      {
        label: "orange-sent",
        transactionType: "EXPENSE",
        // "You sent EGP 600.00 to 01234567890"
        pattern:
          /(?:sent|transfer(?:red)?(?:\s+of)?|paid)\s+(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+to\s+(?<counterparty>[^.\n]+))?/i,
      },
      {
        label: "orange-received",
        transactionType: "INCOME",
        // "You received EGP 800.00 from 01298765432"
        pattern:
          /(?:received|topped up)\s+(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+from\s+(?<counterparty>[^.\n]+))?/i,
      },
    ],
  },

  // ── BM (Banque Misr) ──────────────────────────────────────────────────
  {
    id: "bm",
    senderType: "institution",
    senderPatterns: [
      /^BM$/i,
      /^Banque\s*Misr$/i,
      /^BanqueMisr$/i,
      /^BM\s*EGYPT$/i,
    ],
    displayName: "Banque Misr",
    defaultCategorySystemName: "banking",
    suggestedAccountType: "BANK",
    templates: [
      {
        label: "bm-purchase",
        transactionType: "EXPENSE",
        // "BM: Purchase of EGP 890.50 at Spinney's on card ending 5678 on 14/02/25"
        pattern:
          /(?:purchase|POS)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+at\s+(?<counterparty>(?:(?!\s+on\s|\s+was\s)[^,\n])+))?(?:\s+on\s+(?:card\s+ending\s+\d+\s+)?(?:on\s+)?(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
      {
        label: "bm-debit",
        transactionType: "EXPENSE",
        // "BM: Debit of EGP 3,000.00 from your account"
        // "BM: ATM withdrawal of EGP 2,000"
        pattern:
          /(?:debit|withdrawal|ATM)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?/i,
      },
      {
        label: "bm-credit",
        transactionType: "INCOME",
        // "BM: Credit of EGP 15,000.00 to your account on 01/02/25"
        pattern:
          /(?:credit|deposit|salary|received)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:.*?(?:from\s+(?<counterparty>(?:(?!\s+on\s)[^,\n])+))?)?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
    ],
  },

  // ── QNB ───────────────────────────────────────────────────────────────
  {
    id: "qnb",
    senderType: "institution",
    senderPatterns: [
      /^QNB$/i,
      /^QNBALAHLI$/i,
      /^QNBAlahli$/i,
      /^QNB\s+EGYPT$/i,
      /^QNB\s+ALAHLI$/i,
    ],
    displayName: "QNB",
    defaultCategorySystemName: "banking",
    suggestedAccountType: "BANK",
    templates: [
      {
        label: "qnb-debit-card-txn",
        transactionType: "EXPENSE",
        // Real: "Your Debit Card **2132 had a Successful transaction of EGP 680.00 @FAWRY*LUXIR SWEETS,your available bal.EGP24496.86"
        pattern:
          /(?:Debit|Credit)\s+Card\s+\*{0,2}\d+\s+had\s+a\s+Successful\s+transaction\s+of\s+EGP\s*(?<amount>[\d,]+(?:\.\d+)?)\s*@(?<counterparty>[^,]+)/i,
      },
      {
        label: "qnb-purchase",
        transactionType: "EXPENSE",
        // "QNB: Purchase of EGP 450.00 at Metro Market on 15/02/25"
        pattern:
          /(?:purchase|POS)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+at\s+(?<counterparty>(?:(?!\s+on\s|\s+was\s)[^,\n])+))?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
      {
        label: "qnb-debit",
        transactionType: "EXPENSE",
        // "QNB: EGP 1,500.00 was debited from your account"
        pattern:
          /(?:debit|withdrawal|ATM)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?/i,
      },
      {
        label: "qnb-credit",
        transactionType: "INCOME",
        // "QNB: EGP 8,000.00 was credited to your account"
        pattern:
          /(?:credit|deposit|salary|received)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:.*?(?:from\s+(?<counterparty>(?:(?!\s+on\s)[^,\n])+))?)?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
    ],
  },

  // ── HSBC Egypt ────────────────────────────────────────────────────────
  {
    id: "hsbc",
    senderType: "institution",
    senderPatterns: [
      /^HSBC$/i,
      /^HSBCEgypt$/i,
      /^HSBC\s*EG$/i,
      /^HSBC\s+EGYPT$/i,
    ],
    displayName: "HSBC Egypt",
    defaultCategorySystemName: "banking",
    suggestedAccountType: "BANK",
    templates: [
      {
        label: "hsbc-purchase",
        transactionType: "EXPENSE",
        // "HSBC: A purchase of EGP 2,340.00 at IKEA was made on your card ending 3456"
        pattern:
          /(?:purchase|POS)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:\s+at\s+(?<counterparty>(?:(?!\s+on\s|\s+was\s)[^,\n])+))?(?:\s+(?:was\s+made\s+)?on\s+(?:your\s+)?card\s+ending\s+\d+)?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
      {
        label: "hsbc-debit",
        transactionType: "EXPENSE",
        // "HSBC: Debit of EGP 5,000.00 from your account"
        pattern:
          /(?:debit|withdrawal|ATM)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?/i,
      },
      {
        label: "hsbc-credit",
        transactionType: "INCOME",
        // "HSBC: Credit of EGP 20,000.00 to your account on 28/01/25"
        pattern:
          /(?:credit|deposit|salary|received)\s+(?:of\s+)?(?:EGP\s*)?(?<amount>[\d,]+(?:\.\d+)?)(?:\s*EGP)?(?:.*?(?:from\s+(?<counterparty>(?:(?!\s+on\s)[^,\n])+))?)?(?:\s+on\s+(?<date>\d{2}\/\d{2}(?:\/\d{2,4})?))?/i,
      },
    ],
  },
];

/**
 * Find the sender config matching a given SMS address.
 *
 * @param senderAddress - The SMS sender address to look up
 * @returns Matching config or undefined
 */
export function findSenderConfig(
  senderAddress: string
): FinancialSenderConfig | undefined {
  return FINANCIAL_SENDER_REGISTRY.find((config) =>
    config.senderPatterns.some((pattern) => pattern.test(senderAddress))
  );
}

/**
 * Find a sender config by its stable ID.
 *
 * @param id - The sender config ID (e.g., "cib", "nbe")
 * @returns Matching config or undefined
 */
export function findSenderConfigById(
  id: string
): FinancialSenderConfig | undefined {
  return FINANCIAL_SENDER_REGISTRY.find((config) => config.id === id);
}
