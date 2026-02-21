/**
 * usePreferredCurrency Hook
 *
 * Observes the profile's preferred_currency field reactively.
 * Falls back to device locale currency detection, then USD.
 */

import { database, Profile, type CurrencyType } from "@astik/db";
import { SUPPORTED_CURRENCIES } from "@astik/logic";
import { getLocales } from "expo-localization";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_CURRENCY: CurrencyType = "USD";

interface UsePreferredCurrencyResult {
  /** The user's preferred display currency */
  readonly preferredCurrency: CurrencyType;
  /** Update the preferred currency in the profile */
  readonly setPreferredCurrency: (currency: CurrencyType) => Promise<void>;
  readonly isLoading: boolean;
}

/**
 * Determine the initial currency code from the device locale.
 *
 * @returns The device locale's ISO 4217 currency code if the app supports it, otherwise "USD".
 */
function detectCurrencyFromDevice(): CurrencyType {
  const locales = getLocales();
  const currencyCode = locales[0]?.currencyCode ?? null;

  if (!currencyCode) return DEFAULT_CURRENCY;

  const isSupported = SUPPORTED_CURRENCIES.some((c) => c.code === currencyCode);
  return isSupported ? (currencyCode as CurrencyType) : DEFAULT_CURRENCY;
}

/**
 * Exposes the user's preferred currency (from the Profile record or device locale) and a setter to persist changes.
 *
 * @returns An object containing:
 * - `preferredCurrency`: the resolved currency taken from the Profile's `preferredCurrency` when available, otherwise detected from the device locale (defaults to USD if unavailable or unsupported).
 * - `setPreferredCurrency`: a function that persists the provided currency to the current Profile; it does nothing if no Profile is available.
 * - `isLoading`: `true` while the initial Profile observation is pending, `false` otherwise.
 */
export function usePreferredCurrency(): UsePreferredCurrencyResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Observe the first profile record
  useEffect(() => {
    const collection = database.get<Profile>("profiles");
    const subscription = collection
      .query(Q.where("deleted", false), Q.take(1))
      .observe()
      .subscribe({
        next: (profiles) => {
          setProfile(profiles[0] ?? null);
          setIsLoading(false);
        },
        error: (err: unknown) => {
          console.error("Error observing profile:", err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  const preferredCurrency = useMemo<CurrencyType>(() => {
    if (profile?.preferredCurrency) {
      return profile.preferredCurrency as CurrencyType;
    }
    // No profile yet — detect from device locale
    return detectCurrencyFromDevice();
  }, [profile?.preferredCurrency]);

  const setPreferredCurrency = async (
    currency: CurrencyType
  ): Promise<void> => {
    if (!profile) return;
    await database.write(async () => {
      await profile.update((p) => {
        p.preferredCurrency = currency;
      });
    });
  };

  return {
    preferredCurrency,
    setPreferredCurrency,
    isLoading,
  };
}