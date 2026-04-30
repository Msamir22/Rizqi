import type { MarketRate } from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { useDatabase } from "../providers/DatabaseProvider";
import { useMarketRatesRealtime } from "../providers/MarketRatesRealtimeProvider";

interface UseMarketRatesResult {
  readonly latestRates: MarketRate | null;
  readonly previousDayRate: MarketRate | null;
  readonly isLoading: boolean;
  readonly isConnected: boolean;
  readonly lastUpdated: Date | null;
  readonly isStale: boolean;
}

/**
 * Hook to get market rates from local WatermelonDB.
 *
 * Connection state (`isConnected`) is provided by the app-level
 * `MarketRatesRealtimeProvider`, so the realtime channel persists
 * across screen navigations without re-subscribing.
 *
 * Single source of truth: WatermelonDB (synced from Supabase)
 */
export function useMarketRates(): UseMarketRatesResult {
  const database = useDatabase();
  const { isConnected } = useMarketRatesRealtime();
  const [latestRates, setLatestRates] = useState<MarketRate | null>(null);
  const [previousDayRate, setPreviousDayRate] = useState<MarketRate | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Query latest market rate from local DB
  useEffect(() => {
    const subscription = database
      .get<MarketRate>("market_rates")
      .query(Q.sortBy("created_at", Q.desc), Q.take(1))
      .observe()
      .subscribe((rates) => {
        const latest = rates.at(0) ?? null;
        setLatestRates(latest);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [database]);

  // Query previous day rate (before today)
  useEffect(() => {
    const fetchPreviousDay = async (): Promise<void> => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const rates = await database
          .get<MarketRate>("market_rates")
          .query(
            Q.where("created_at", Q.lt(todayStart.getTime())),
            Q.sortBy("created_at", Q.desc),
            Q.take(1)
          )
          .fetch();

        setPreviousDayRate(rates.at(0) ?? null);
      } catch (err) {
        console.error("Error fetching previous day rate:", err);
      }
    };

    fetchPreviousDay().catch(console.error);
  }, [database, latestRates]); // Re-fetch when latest rate changes

  // Memoize the return object so consumers can rely on referential stability
  // between observe emits when the underlying values are unchanged. Without
  // this, every render of a parent that calls `useMarketRates()` would produce
  // a fresh object identity (and a fresh `isStale()` boolean from the method
  // call), defeating `React.memo` on downstream components like `AccountCard`.
  return useMemo(
    () => ({
      latestRates,
      previousDayRate,
      isLoading,
      isConnected,
      lastUpdated: latestRates?.createdAt ?? null,
      isStale: latestRates?.isStale() ?? false,
    }),
    [latestRates, previousDayRate, isLoading, isConnected]
  );
}
