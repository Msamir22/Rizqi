/**
 * useNetWorthSummary Hook
 * Local-first net worth calculation using WatermelonDB
 */

import { Account, AssetMetal, database } from "@astik/db";
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalBalance,
  NetWorthSummary,
} from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { useMarketRates } from "./useMarketRates";
import { getNetWorthComparison } from "@/services/net-worth";

interface UseNetWorthSummaryResult {
  summary: NetWorthSummary | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook to get user's net worth summary
 */
export function useNetWorthSummary(): UseNetWorthSummaryResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assetMetals, setAssetMetals] = useState<AssetMetal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { rates, isLoading: isRatesLoading } = useMarketRates();

  const refresh = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    const accountsCollection = database.get<Account>("accounts");
    const query = accountsCollection.query(Q.where("deleted", false));

    const subscription = query.observe().subscribe({
      next: (result) => setAccounts(result),
      error: (err) => {
        console.error("Error observing accounts:", err);
        setError(err);
      },
    });

    return () => subscription.unsubscribe();
  }, [refreshKey]);

  useEffect(() => {
    const assetMetalsCollection = database.get<AssetMetal>("asset_metals");
    const query = assetMetalsCollection.query(Q.where("deleted", false));

    const subscription = query.observe().subscribe({
      next: (result) => {
        setAssetMetals(result);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("Error observing asset metals:", err);
        setError(err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [refreshKey]);

  // Calculate summary when data changes
  const summary = useMemo<NetWorthSummary | null>(() => {
    if (isLoading || isRatesLoading || !rates) {
      return null;
    }

    // Calculate total accounts in EGP
    const totalAccounts = calculateTotalBalance(accounts, rates);

    // Calculate total assets in EGP
    const totalAssets = calculateTotalAssets(assetMetals, rates);

    return calculateNetWorth(totalAccounts, totalAssets);
  }, [accounts, assetMetals, rates, isLoading, isRatesLoading]);

  return {
    summary,
    isLoading: isLoading || isRatesLoading,
    error,
    refresh,
  };
}

/**
 * Simplified hook that just returns the net worth value
 * Useful for components that only need the total
 * Also fetches monthly percentage change from API via service layer
 */
export function useNetWorth(): {
  netWorth: number | null;
  monthlyPercentageChange: number | null;
  isLoading: boolean;
} {
  const { summary, isLoading } = useNetWorthSummary();
  const [monthlyPercentageChange, setMonthlyPercentageChange] = useState<
    number | null
  >(null);
  const [isComparisonLoading, setIsComparisonLoading] = useState(true);

  const netWorth = useMemo(() => {
    return summary?.totalNetWorth ?? null;
  }, [summary]);

  useEffect(() => {
    async function fetchComparison(): Promise<void> {
      const data = await getNetWorthComparison();
      setMonthlyPercentageChange(data?.percentageChange ?? null);
      setIsComparisonLoading(false);
    }

    if (!isLoading) {
      fetchComparison();
    }
  }, [isLoading]);

  return {
    netWorth,
    monthlyPercentageChange,
    isLoading: isLoading || isComparisonLoading,
  };
}
