/**
 * Voice Transaction Parser for Astik
 * Parses Egyptian Arabic and English voice input to extract transaction details
 */

import { CurrencyType } from "@astik/db";
import { ParsedVoiceTransaction } from "../types";

// Arabic character detection regex
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Egyptian Arabic number words
// const ARABIC_NUMBERS: Record<string, number> = {
//   واحد: 1,
//   إثنين: 2,
//   ثلاثة: 3,
//   أربعة: 4,
//   خمسة: 5,
//   ستة: 6,
//   سبعة: 7,
//   ثمانية: 8,
//   تسعة: 9,
//   عشرة: 10,
//   عشرين: 20,
//   ثلاثين: 30,
//   أربعين: 40,
//   خمسين: 50,
//   ستين: 60,
//   سبعين: 70,
//   ثمانين: 80,
//   تسعين: 90,
//   مية: 100,
//   ألف: 1000,
//   // Eastern Arabic numerals (٠-٩)
//   "٠": 0,
//   "١": 1,
//   "٢": 2,
//   "٣": 3,
//   "٤": 4,
//   "٥": 5,
//   "٦": 6,
//   "٧": 7,
//   "٨": 8,
//   "٩": 9,
// };

// Currency keywords
const CURRENCY_KEYWORDS = {
  egp: ["جنيه", "جنية", "جني", "pounds", "pound", "egp", "ج", "egyptian"],
  usd: ["دولار", "dollars", "dollar", "usd", "$", "دولارات"],
};

// Income keywords (both languages)
const INCOME_KEYWORDS = [
  "salary",
  "income",
  "received",
  "earned",
  "got paid",
  "payment received",
  "freelance",
  "مرتب",
  "راتب",
  "دخل",
  "استلمت",
  "قبضت",
  "تحويل",
  "فريلانس",
];

/**
 * Convert Eastern Arabic numerals to Western Arabic
 */
export function convertEasternArabicNumbers(text: string): string {
  return text
    .replace(/٠/g, "0")
    .replace(/١/g, "1")
    .replace(/٢/g, "2")
    .replace(/٣/g, "3")
    .replace(/٤/g, "4")
    .replace(/٥/g, "5")
    .replace(/٦/g, "6")
    .replace(/٧/g, "7")
    .replace(/٨/g, "8")
    .replace(/٩/g, "9");
}

/**
 * Auto-detect language from text
 */
export function detectLanguage(text: string): "ar" | "en" {
  // Count Arabic characters
  const arabicMatches = text.match(new RegExp(ARABIC_REGEX, "g"));
  const arabicCount = arabicMatches ? arabicMatches.length : 0;

  // If more than 20% Arabic characters, it's Arabic
  if (arabicCount > 0 && arabicCount / text.length > 0.2) {
    return "ar";
  }
  return "en";
}

/**
 * Extract amount from voice text
 */
function extractAmount(text: string): number | null {
  // Convert Eastern Arabic numerals first
  const normalizedText = convertEasternArabicNumbers(text);

  // Pattern 1: Direct numbers (75, 100.5, etc.)
  const directNumberMatch = normalizedText.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  if (directNumberMatch) {
    return parseFloat(directNumberMatch[1]);
  }

  // Pattern 2: Arabic number words (مية جنيه = 100)
  // This would need more sophisticated parsing for production
  // For now, prioritize direct numbers

  return null;
}

/**
 * Extract currency from voice text
 */
function extractCurrency(text: string): CurrencyType {
  const lowerText = text.toLowerCase();

  // Check for USD keywords
  if (CURRENCY_KEYWORDS.usd.some((keyword) => lowerText.includes(keyword))) {
    return "USD";
  }

  // Check for EGP keywords
  if (CURRENCY_KEYWORDS.egp.some((keyword) => lowerText.includes(keyword))) {
    return "EGP";
  }

  // Default to EGP for Egyptian market
  return "EGP";
}

/**
 * Extract counterparty/description from voice text
 */
function extractDescription(text: string): string {
  // Remove amount and currency keywords
  const description = text
    .replace(/\d+(?:\.\d{1,2})?/g, "") // Remove numbers
    .replace(/[٠-٩]+/g, "") // Remove Eastern Arabic numbers
    .replace(/جنيه|جنية|دولار|pounds?|dollars?|egp|usd/gi, "") // Remove currency
    .replace(/\b(ب|في|من|على|فى)\b/g, "") // Remove Arabic prepositions
    .trim();

  return description || "Transaction";
}

/**
 * Check if transaction is income
 */
function isIncomeTransaction(text: string): boolean {
  const lowerText = text.toLowerCase();
  return INCOME_KEYWORDS.some(
    (keyword) => lowerText.includes(keyword) || text.includes(keyword)
  );
}

/**
 * Parse voice input into transaction data
 */
export function parseVoiceTransaction(
  voiceText: string
): ParsedVoiceTransaction | null {
  if (!voiceText || voiceText.trim().length === 0) {
    return null;
  }

  const amount = extractAmount(voiceText);
  if (amount === null || amount <= 0) {
    return null; // Invalid transaction
  }

  const currency = extractCurrency(voiceText);
  const description = extractDescription(voiceText);
  const isIncome = isIncomeTransaction(voiceText);

  // Use category detection from utils
  // const { category: detectedCategory, confidence } =
  //   detectCategory(description);

  // Auto-detect language
  const detectedLanguage = detectLanguage(voiceText);

  return {
    amount,
    currency,
    description,
    counterparty: description !== "Transaction" ? description : undefined,
    detectedCategory: isIncome ? "Income" : "Other",
    confidence: isIncome ? 0.9 : 1,
    isIncome,
    detectedLanguage,
  };
}

/**
 * Example usage:
 * parseVoiceTransaction("فطار ب 75 جنيه")
 *   → { amount: 75, currency: 'EGP', description: 'فطار', detectedCategory: 'Food', confidence: 0.8, isIncome: false, detectedLanguage: 'ar' }
 *
 * parseVoiceTransaction("Breakfast 75 pounds")
 *   → { amount: 75, currency: 'EGP', description: 'Breakfast', detectedCategory: 'Food', confidence: 0.8, isIncome: false, detectedLanguage: 'en' }
 */
