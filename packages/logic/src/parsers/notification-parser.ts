/**
 * Bank Notification Parser for Astik
 * Parses Egyptian bank notifications (InstaPay, Debit Cards)
 * Based on specification in notification_parser_spec.md
 */

import { CurrencyType } from "@astik/db";
import { ParsedNotification } from "../types";

/**
 * Parse InstaPay (IPN) transfer sent notification
 * Example: "IPN transfer sent with amount of EGP 1235.00 from 7660 on 03/12 at 08:43 PM. Ref# 2b7c9e0e."
 */
function parseInstPaySent(text: string): ParsedNotification | null {
  const pattern =
    /IPN transfer sent with amount of (EGP|USD) ([\d,]+\.\d{2}) from (\d+) on ([\d/]+) at ([\d:]+\s*[AP]M)\. Ref# ([a-f0-9]+)/i;
  const match = text.match(pattern);

  if (!match) return null;

  const [, currency, amountStr, accountNumber, , , reference] = match;
  const amount = parseFloat(amountStr.replace(/,/g, ""));

  return {
    type: "EXPENSE",
    amount,
    currency: currency as CurrencyType,
    description: "InstaPay Transfer",
    counterparty: "InstaPay",
    accountNumber,
    reference,
    detectedCategory: "Transfer",
  };
}

/**
 * Parse InstaPay (IPN) transfer received notification
 * Example: "IPN transfer received with amount of EGP 500.00 on 7660 on 24/11 at 09:41 AM. Ref# 70ca617b."
 */
function parseInstPayReceived(text: string): ParsedNotification | null {
  const pattern =
    /IPN transfer received with amount of (EGP|USD) ([\d,]+\.\d{2}) on (\d+) on ([\d/]+) at ([\d:]+\s*[AP]M)\. Ref# ([a-f0-9]+)/i;
  const match = text.match(pattern);

  if (!match) return null;

  const [, currency, amountStr, accountNumber, , , reference] = match;
  const amount = parseFloat(amountStr.replace(/,/g, ""));

  return {
    type: "INCOME",
    amount,
    currency: currency as CurrencyType,
    description: "InstaPay Received",
    counterparty: "InstaPay",
    accountNumber,
    reference,
    detectedCategory: "Income",
  };
}

/**
 * Parse Debit Card successful transaction notification
 * Example: "Your Debit Card **2132 had a Successful transaction of EGP 1824.00 @KAMONA,your available bal.EGP181869.22"
 */
function parseDebitCardTransaction(text: string): ParsedNotification | null {
  const pattern =
    /Your Debit Card \*+(\d{4}) had a Successful transaction of (EGP|USD) ([\d,]+\.\d{2}) @([^,]+),your available bal\.(EGP|USD)([\d,]+\.\d{2})/i;
  const match = text.match(pattern);

  if (!match) return null;

  const [, cardLast4, currency, amountStr, merchant, , balanceStr] = match;
  const amount = parseFloat(amountStr.replace(/,/g, ""));
  const availableBalance = parseFloat(balanceStr.replace(/,/g, ""));

  // Detect category from merchant name (will use categories utils)
  const detectedCategory = detectCategoryFromMerchant(merchant);

  return {
    type: "EXPENSE",
    amount,
    currency: currency as CurrencyType,
    counterparty: merchant.trim(),
    description: `Purchase at ${merchant.trim()}`,
    cardLast4,
    availableBalance,
    detectedCategory,
  };
}

/**
 * Parse Debit Card reversed transaction notification
 * Example: "Your transaction with Debit Card **2132 @Bill Payment ETISALAT with EGP 769.50 has been reversed"
 */
function parseDebitCardReversal(text: string): ParsedNotification | null {
  const pattern =
    /Your transaction with Debit Card \*+(\d{4}) @([^,]+) with (EGP|USD) ([\d,]+\.\d{2}) has been reversed/i;
  const match = text.match(pattern);

  if (!match) return null;

  const [, cardLast4, merchant, currency, amountStr] = match;
  const amount = parseFloat(amountStr.replace(/,/g, ""));

  return {
    type: "INCOME", // Reversal means money returned
    amount,
    currency: currency as CurrencyType,
    counterparty: merchant.trim(),
    description: `Reversal: ${merchant.trim()}`,
    cardLast4,
    detectedCategory: "Income",
  };
}

/**
 * Detect category from merchant name
 * TODO: Move to categories utils for better organization
 */
function detectCategoryFromMerchant(merchant: string): string | null {
  const lowerMerchant = merchant.toLowerCase();

  // Fuel/Transport
  if (
    lowerMerchant.includes("fuel") ||
    lowerMerchant.includes("petrol") ||
    lowerMerchant.includes("gas") ||
    lowerMerchant.includes("total")
  ) {
    return "Transport";
  }

  // Utilities/Bills
  if (
    lowerMerchant.includes("vodafone") ||
    lowerMerchant.includes("etisalat") ||
    lowerMerchant.includes("bill payment") ||
    lowerMerchant.includes("top up")
  ) {
    return "Utilities";
  }

  // Food
  if (
    lowerMerchant.includes("restaurant") ||
    lowerMerchant.includes("cafe") ||
    lowerMerchant.includes("coffee") ||
    lowerMerchant.includes("pizza")
  ) {
    return "Food";
  }

  // Entertainment
  if (
    lowerMerchant.includes("cinema") ||
    lowerMerchant.includes("netflix") ||
    lowerMerchant.includes("spotify")
  ) {
    return "Entertainment";
  }

  return null; // Unknown category
}

/**
 * Main notification parser - attempts all patterns
 */
export function parseNotification(
  notificationText: string
): ParsedNotification | null {
  if (!notificationText || notificationText.trim().length === 0) {
    return null;
  }

  // Try each parser in order
  let result: ParsedNotification | null;

  result = parseInstPaySent(notificationText);
  if (result) return result;

  result = parseInstPayReceived(notificationText);
  if (result) return result;

  result = parseDebitCardTransaction(notificationText);
  if (result) return result;

  result = parseDebitCardReversal(notificationText);
  if (result) return result;

  // No pattern matched
  return null;
}

/**
 * Example usage:
 * parseNotification("IPN transfer sent with amount of EGP 1235.00 from 7660...")
 *   → { type: 'EXPENSE', amount: 1235, currency: 'EGP', accountNumber: '7660', ... }
 */
