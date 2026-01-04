/**
 * useMarketRates Hook
 * Hook for fetching and refreshing market rates from Supabase
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchMarketRates,
  refreshMarketRates,
  MarketRates,
} from "../services/rates";

interface UseMarketRatesResult {
  rates: MarketRates | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get market rates with auto-refresh
 * @param autoRefreshMs - Auto-refresh interval in milliseconds (default: 30 minutes)
 */
export function useMarketRates(
  autoRefreshMs: number = 30 * 60 * 1000
): UseMarketRatesResult {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRates = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(true);
      const result = forceRefresh
        ? await refreshMarketRates()
        : await fetchMarketRates();
      setRates(result);
      setError(null);
    } catch (err) {
      console.error("Error fetching rates:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch rates"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadRates(true);
  }, [loadRates]);

  // Initial fetch
  useEffect(() => {
    loadRates(false);
  }, [loadRates]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshMs <= 0) return;

    const interval = setInterval(() => {
      loadRates(false);
    }, autoRefreshMs);

    return () => clearInterval(interval);
  }, [autoRefreshMs, loadRates]);

  return {
    rates,
    isLoading,
    error,
    refresh,
  };
}
