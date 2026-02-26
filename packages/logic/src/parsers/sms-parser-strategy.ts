/**
 * SMS Parser Strategy Interface
 *
 * Defines the Strategy pattern contract for SMS parsing implementations.
 * The RegexSmsParser is the initial implementation; future LlmSmsParser
 * can be swapped in without changing callers.
 *
 * @module sms-parser-strategy
 */

import type { ParsedSmsTransaction } from "../types";

/**
 * Strategy interface for parsing financial SMS messages.
 *
 * Implementations must:
 * - Return a ParsedSmsTransaction when a financial SMS is recognised
 * - Return null when the SMS is not financial or cannot be parsed
 * - Never throw — unrecognised input must return null
 */
export interface SmsParserStrategy {
  /**
   * Attempt to parse an SMS body into a structured transaction.
   *
   * @param smsBody  - The full SMS text content
   * @param sender   - The sender address / phone number
   * @returns Parsed transaction or null if unrecognised
   */
  parse(smsBody: string, sender: string): ParsedSmsTransaction | null;
}
