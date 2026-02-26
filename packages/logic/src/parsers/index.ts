/**
 * Parsers Barrel Exports
 *
 * Re-exports all SMS parser modules for clean imports from
 * `@astik/logic` or `packages/logic/src/parsers`.
 *
 * @module parsers/index
 */

export { computeSmsHash } from "./sms-hash";
export { mapSmsToCategory } from "./sms-category-mapper";
export { RegexSmsParser } from "./regex-sms-parser";
export { isLikelyFinancialSms } from "./sms-keyword-filter";
export { isKnownFinancialSender } from "./egyptian-bank-registry";
export type { BankInfo } from "./egyptian-bank-registry";
export {
  FINANCIAL_SENDER_REGISTRY,
  findSenderConfig,
  findSenderConfigById,
  parseAmount,
} from "./financial-sender-registry";
export type { SmsParserStrategy } from "./sms-parser-strategy";
export type {
  FinancialSenderConfig,
  SmsTemplate,
} from "./financial-sender-registry";
