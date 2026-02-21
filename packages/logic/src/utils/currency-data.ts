/**
 * Currency metadata for the 35 supported currencies.
 * Used by the currency picker component for display.
 */

import type { CurrencyType } from "@astik/db";

export interface CurrencyInfo {
  readonly code: CurrencyType;
  readonly name: string;
  readonly symbol: string;
  /** ISO 3166-1 emoji flag (for countries) or icon name */
  readonly flag: string;
}

/**
 * All 35 supported currencies with display metadata.
 */
export const SUPPORTED_CURRENCIES: readonly CurrencyInfo[] = [
  // Middle East & North Africa (target users)
  { code: "EGP", name: "Egyptian Pound", symbol: "EGP", flag: "🇪🇬" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", flag: "🇸🇦" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", flag: "🇦🇪" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", flag: "🇰🇼" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR", flag: "🇶🇦" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BHD", flag: "🇧🇭" },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", flag: "🇴🇲" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "JOD", flag: "🇯🇴" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "IQD", flag: "🇮🇶" },
  { code: "LYD", name: "Libyan Dinar", symbol: "LYD", flag: "🇱🇾" },
  { code: "TND", name: "Tunisian Dinar", symbol: "TND", flag: "🇹🇳" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD", flag: "🇲🇦" },
  { code: "DZD", name: "Algerian Dinar", symbol: "DZD", flag: "🇩🇿" },

  // Major global currencies
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭" },

  // Asia-Pacific
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "KPW", name: "North Korean Won", symbol: "₩", flag: "🇰🇵" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "MYR", flag: "🇲🇾" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },

  // Americas
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },

  // Europe (non-EUR)
  { code: "SEK", name: "Swedish Krona", symbol: "SEK", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", symbol: "NOK", flag: "🇳🇴" },
  { code: "DKK", name: "Danish Krone", symbol: "DKK", flag: "🇩🇰" },
  { code: "ISK", name: "Icelandic Króna", symbol: "ISK", flag: "🇮🇸" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", flag: "🇷🇺" },

  // Africa
  { code: "ZAR", name: "South African Rand", symbol: "ZAR", flag: "🇿🇦" },

  // Crypto
  { code: "BTC", name: "Bitcoin", symbol: "₿", flag: "₿" },
] as const;

/**
 * Lookup map for quick access by currency code.
 */
export const CURRENCY_INFO_MAP: Readonly<
  Record<CurrencyType, CurrencyInfo | undefined>
> = Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c.code, c])) as Record<
  CurrencyType,
  CurrencyInfo | undefined
>;
