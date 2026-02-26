/**
 * @deprecated MARKED FOR DELETION — Replaced by AI-driven parsing.
 * New approach: `ai-sms-parser-service.ts` calls Gemini Edge Function.
 * Kept temporarily as fallback and until AI approach is validated.
 */

/**
 * Regex-based SMS Parser
 *
 * Implements the SmsParserStrategy interface using the financial sender
 * registry and regex templates to extract structured transaction data
 * from Egyptian financial SMS messages.
 *
 * Architecture & Design Rationale:
 * - Pattern: Strategy Pattern (implements SmsParserStrategy)
 * - Why: Allows future LLM-based parser to be swapped in without
 *   changing callers. Open/Closed Principle upheld.
 * - SOLID: Single Responsibility — this class only parses, it does not
 *   read SMS or save transactions.
 *
 * @module regex-sms-parser
 */

import type { SmsParserStrategy } from "./sms-parser-strategy";
import type { ParsedSmsTransaction } from "../types";
import {
  findSenderConfig,
  parseAmount,
  type FinancialSenderConfig,
  type SmsTemplate,
} from "./financial-sender-registry";
import { mapSmsToCategory } from "./sms-category-mapper";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract a Date from named capture groups.
 * Falls back to current date if no date group is found.
 */
function extractDate(groups: Record<string, string | undefined>): Date {
  const dateStr = groups["date"];
  if (!dateStr) {
    return new Date();
  }

  // Common Egyptian SMS date formats:
  // "dd/MM" — assume current year
  // "dd/MM/yyyy" or "dd/MM/yy"
  const parts = dateStr.split("/");
  const now = new Date();

  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parts.length >= 3 ? parseYear(parts[2]) : now.getFullYear();

    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return now;
}

/**
 * Parse a year value from a string — handles 2-digit and 4-digit years.
 */
function parseYear(yearStr: string): number {
  const year = parseInt(yearStr, 10);
  if (year < 100) {
    return 2000 + year;
  }
  return year;
}

/**
 * Extract counterparty from named capture groups.
 * Cleans trailing punctuation/whitespace.
 * Falls back to empty string.
 */
function extractCounterparty(
  groups: Record<string, string | undefined>
): string {
  const raw = groups["counterparty"]?.trim() ?? "";
  // Strip trailing punctuation commonly left over from regex matches
  return raw.replace(/[.;:,!]+$/, "").trim();
}

// ---------------------------------------------------------------------------
// Promotional SMS blocklist
// ---------------------------------------------------------------------------

/**
 * Keywords that indicate an SMS is promotional / informational,
 * not a financial transaction. Used to reject false positives.
 */
const PROMOTIONAL_KEYWORDS: readonly string[] = [
  "offer",
  "cashback",
  "reward",
  "congratulations",
  "win ",
  "won ",
  "prize",
  "limited time",
  "exclusive deal",
  "subscribe",
  "activate now",
  "download",
  "click here",
  "رسالة ترويجية", // Arabic: promotional message
  "عرض خاص", // Arabic: special offer
] as const;

/**
 * Returns true if the SMS body is likely promotional, not transactional.
 */
function isPromotionalSms(smsBody: string): boolean {
  const lowerBody = smsBody.toLowerCase();
  return PROMOTIONAL_KEYWORDS.some((kw) =>
    lowerBody.includes(kw.toLowerCase())
  );
}

// ---------------------------------------------------------------------------
// Parser Implementation
// ---------------------------------------------------------------------------

/**
 * Regex-based SMS parser.
 *
 * Iterates through the financial sender registry to:
 * 1. Match the sender address against known sender patterns
 * 2. Try each template's regex against the SMS body
 * 3. Extract structured data using named capture groups
 * 4. Map to the best category via keyword analysis
 */
export class RegexSmsParser implements SmsParserStrategy {
  /**
   * Parse an SMS body into a structured transaction.
   *
   * @param smsBody - The full SMS text content
   * @param sender  - The SMS sender address
   * @returns ParsedSmsTransaction or null if unrecognised
   */
  parse(smsBody: string, sender: string): ParsedSmsTransaction | null {
    const config = findSenderConfig(sender);
    if (!config) {
      return null;
    }

    return this.tryTemplates(smsBody, sender, config);
  }

  /**
   * Try each template in the sender config against the SMS body.
   * Returns the first successful match or null.
   */
  private tryTemplates(
    smsBody: string,
    sender: string,
    config: FinancialSenderConfig
  ): ParsedSmsTransaction | null {
    for (const template of config.templates) {
      const result = this.tryTemplate(smsBody, sender, config, template);
      if (result) {
        return result;
      }
    }
    return null;
  }

  /**
   * Try a single template against the SMS body.
   */
  private tryTemplate(
    smsBody: string,
    sender: string,
    config: FinancialSenderConfig,
    template: SmsTemplate
  ): ParsedSmsTransaction | null {
    const match = template.pattern.exec(smsBody);
    if (!match?.groups) {
      return null;
    }

    const groups = match.groups as Record<string, string | undefined>;
    // Support both `amount` and `amount2` (for alternation-based patterns like CIB)
    const amountRaw = groups["amount"] ?? groups["amount2"];
    if (!amountRaw) {
      return null;
    }

    const amount = parseAmount(amountRaw);
    if (amount < 0.01) {
      return null;
    }

    // Reject promotional / informational SMS that happen to match amount patterns
    if (isPromotionalSms(smsBody)) {
      return null;
    }

    const categorySystemName = mapSmsToCategory(smsBody, config);

    return {
      amount,
      currency: "EGP", // Default to EGP for Egyptian senders
      type: template.transactionType,
      counterparty: extractCounterparty(groups),
      date: extractDate(groups),
      smsBodyHash: "", // Hash is computed asynchronously by the sync service
      senderAddress: sender,
      senderDisplayName: config.displayName,
      senderConfigId: config.id,
      categorySystemName,
      rawSmsBody: smsBody,
      confidence: 0.85, // Regex-based parsing has moderate confidence
    };
  }
}
