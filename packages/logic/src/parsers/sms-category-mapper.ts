/**
 * @deprecated MARKED FOR DELETION — Replaced by AI-driven categorization.
 * AI assigns categories directly. This file is kept as fallback
 * when AI calls fail (used by `ai-sms-parser-service.ts`).
 */

/**
 * SMS Category Mapper
 *
 * Maps a sender identity and optional SMS keywords to the most specific
 * category `system_name` in the existing L1/L2 hierarchy.
 *
 * Falls back to the sender's `defaultCategorySystemName` when no
 * keyword-based mapping matches.
 *
 * @module sms-category-mapper
 */

import type { FinancialSenderConfig } from "./financial-sender-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeywordCategoryRule {
  /** Keywords to search for in the SMS body (case-insensitive) */
  readonly keywords: readonly string[];
  /** Category system_name to use when matched */
  readonly categorySystemName: string;
}

// ---------------------------------------------------------------------------
// Keyword → Category rules (ordered by specificity, most specific first)
// ---------------------------------------------------------------------------

const KEYWORD_CATEGORY_RULES: readonly KeywordCategoryRule[] = [
  // Bills & Utilities
  {
    keywords: ["electricity", "كهرباء", "electric"],
    categorySystemName: "electricity",
  },
  {
    keywords: ["water", "مياه", "water bill"],
    categorySystemName: "water",
  },
  {
    keywords: ["gas", "غاز", "gas bill"],
    categorySystemName: "gas",
  },
  {
    keywords: ["internet", "انترنت", "wifi", "broadband"],
    categorySystemName: "internet",
  },
  {
    keywords: ["phone", "mobile", "هاتف", "موبايل", "recharge", "bundle"],
    categorySystemName: "phone",
  },

  // Food & Dining
  {
    keywords: ["restaurant", "مطعم", "cafe", "coffee", "كافيه"],
    categorySystemName: "restaurants",
  },
  {
    keywords: ["grocery", "بقالة", "supermarket", "سوبر ماركت", "market"],
    categorySystemName: "groceries",
  },

  // Transport
  {
    keywords: ["uber", "careem", "اوبر", "كريم", "ride", "taxi"],
    categorySystemName: "ride_hailing",
  },
  {
    keywords: ["fuel", "petrol", "بنزين", "gas station", "وقود"],
    categorySystemName: "fuel",
  },

  // Shopping
  {
    keywords: ["amazon", "jumia", "noon", "shopping", "تسوق"],
    categorySystemName: "online_shopping",
  },

  // Health
  {
    keywords: ["pharmacy", "صيدلية", "medicine", "دواء"],
    categorySystemName: "pharmacy",
  },
  {
    keywords: ["hospital", "clinic", "مستشفى", "عيادة", "doctor", "طبيب"],
    categorySystemName: "medical",
  },

  // Education
  {
    keywords: ["tuition", "university", "school", "مدرسة", "جامعة"],
    categorySystemName: "education",
  },

  // Entertainment
  {
    keywords: ["netflix", "spotify", "subscription", "اشتراك"],
    categorySystemName: "subscriptions",
  },

  // Transfers
  {
    keywords: ["transfer", "تحويل", "IPN", "instapay"],
    categorySystemName: "transfers",
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine the best category `system_name` for a parsed SMS.
 *
 * Priority:
 * 1. Keyword match from SMS body (most specific wins)
 * 2. Sender's default category mapping (fallback)
 *
 * @param smsBody       - The raw SMS text content
 * @param senderConfig  - The matched sender configuration
 * @returns The category system_name string
 */
export function mapSmsToCategory(
  smsBody: string,
  senderConfig: FinancialSenderConfig
): string {
  const bodyLower = smsBody.toLowerCase();

  for (const rule of KEYWORD_CATEGORY_RULES) {
    const matched = rule.keywords.some((kw) =>
      bodyLower.includes(kw.toLowerCase())
    );
    if (matched) {
      return rule.categorySystemName;
    }
  }

  return senderConfig.defaultCategorySystemName;
}
