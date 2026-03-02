/**
 * Currency Detection Utility
 *
 * Detects the user's likely currency from the device timezone.
 * Used for:
 * - Suggesting a currency in the onboarding picker (sorted to top)
 * - Display fallback in usePreferredCurrency
 *
 * Not used for account creation — the user always makes the final
 * choice via the currency picker during onboarding.
 *
 * @module currency-detection
 */

import type { CurrencyType } from "@astik/db";
import { TIMEZONE_TO_CURRENCY } from "@astik/logic";
import { getCalendars } from "expo-localization";

export const DEFAULT_CURRENCY: CurrencyType = "USD";

/**
 * Detect the user's likely currency from the device timezone.
 *
 * Reads the IANA timezone from `getCalendars()` (expo-localization,
 * no permissions required) and maps it via `TIMEZONE_TO_CURRENCY`.
 *
 * This is the most reliable cross-platform signal because
 * the timezone is independent of the language/locale setting.
 *
 * @returns The timezone-inferred currency code, or `null` if unmapped.
 */
export function detectCurrencyFromTimezone(): CurrencyType | null {
  const calendars = getCalendars();
  const timezone = calendars[0]?.timeZone ?? null;

  if (!timezone) return null;

  return TIMEZONE_TO_CURRENCY[timezone] ?? null;
}
