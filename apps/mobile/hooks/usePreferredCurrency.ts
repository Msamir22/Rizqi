import { useToast } from "@/components/ui/Toast";
import {
  DEFAULT_CURRENCY,
  detectCurrencyFromTimezone,
} from "@/utils/currency-detection";
import { database, Profile, type CurrencyType } from "@monyvi/db";
import { SUPPORTED_CURRENCIES } from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUserId } from "./useCurrentUserId";
import { queryOwned } from "@/services/user-data-access";
import { logger } from "@/utils/logger";

interface UsePreferredCurrencyResult {
  /** The user's preferred display currency */
  readonly preferredCurrency: CurrencyType;
  /** Update the preferred currency in the profile */
  readonly setPreferredCurrency: (currency: CurrencyType) => Promise<void>;
  readonly isLoading: boolean;
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
  const { showToast } = useToast();
  const { userId, isResolvingUser } = useCurrentUserId();

  useEffect(() => {
    if (isResolvingUser) {
      setProfile(null);
      setIsLoading(true);
      return;
    }

    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setProfile(null);
    setIsLoading(true);

    const collection = database.get<Profile>("profiles");
    const subscription = queryOwned(
      collection,
      userId,
      Q.where("deleted", false),
      Q.take(1)
    )
      .observe()
      .subscribe({
        next: (profiles) => {
          setProfile(profiles[0] ?? null);
          setIsLoading(false);
        },
        error: (err: unknown) => {
          logger.error("preferredCurrency.profile.observe.failed", err, {
            userId,
          });
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [userId, isResolvingUser]);

  const preferredCurrency = useMemo<CurrencyType>(() => {
    if (profile?.preferredCurrency) {
      const isSupported = SUPPORTED_CURRENCIES.some(
        (c) => c.code === profile.preferredCurrency
      );
      if (isSupported) {
        return profile.preferredCurrency;
      }
    }
    // No profile or unsupported currency — detect from device timezone.
    // Falls back to DEFAULT_CURRENCY (USD) if detection returns null.
    return detectCurrencyFromTimezone() ?? DEFAULT_CURRENCY;
  }, [profile?.preferredCurrency]);

  const setPreferredCurrency = async (
    currency: CurrencyType
  ): Promise<void> => {
    if (!profile) return;
    try {
      await database.write(async () => {
        await profile.update((p) => {
          p.preferredCurrency = currency;
        });
      });
    } catch (error) {
      logger.error("preferredCurrency.save.failed", error);
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to save currency preference",
      });
    }
  };

  return {
    preferredCurrency,
    setPreferredCurrency,
    isLoading,
  };
}
