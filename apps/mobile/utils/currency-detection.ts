/**
 * Currency Detection Utility
 *
 * Detects the user's preferred currency from the device locale.
 * Extracted from usePreferredCurrency hook for use in non-hook contexts
 * (e.g., service functions).
 *
 * @module currency-detection
 */

import type { CurrencyType } from "@astik/db";
import { SUPPORTED_CURRENCIES } from "@astik/logic";
import { getLocales } from "expo-localization";

const DEFAULT_CURRENCY: CurrencyType = "USD";

/**
 * Determine the currency code from the device locale.
 *
 * Reads the first locale's ISO 4217 currency code and checks
 * it against the app's supported currencies list.
 *
 * @returns The device locale's currency code if supported, otherwise "USD".
 */
export function detectCurrencyFromDevice(): CurrencyType {
  const locales = getLocales();
  const currencyCode = locales[0]?.currencyCode ?? null;

  if (!currencyCode) return DEFAULT_CURRENCY;

  const isSupported = SUPPORTED_CURRENCIES.some((c) => c.code === currencyCode);
  return isSupported ? (currencyCode as CurrencyType) : DEFAULT_CURRENCY;
}
