/**
 * useNetWorth Hook
 * Local-first net worth calculation using WatermelonDB
 */

import { Account, AssetMetal, database } from "@astik/db";
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalBalance,
  NetWorthData,
} from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { getNetWorthComparison } from "@/services/net-worth";
import { useMarketRates } from "./useMarketRates";

interface UseNetWorthResult {
  totalNetWorth: number | null;
  totalAccounts: number | null;
  totalAssets: number | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook to get user's net worth
 */
export function useNetWorth(): UseNetWorthResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assetMetals, setAssetMetals] = useState<AssetMetal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { latestRates, isLoading: isRatesLoading } = useMarketRates();

  const refresh = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    const accountsCollection = database.get<Account>("accounts");
    const query = accountsCollection.query(Q.where("deleted", false));

    // Use observeWithColumns to react to balance changes
    const subscription = query.observeWithColumns(["balance"]).subscribe({
      next: (result) => setAccounts(result),
      error: (err: unknown) => {
        console.error("Error observing accounts:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
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
      error: (err: unknown) => {
        console.error("Error observing asset metals:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [refreshKey]);

  // Calculate net worth when data changes
  const netWorthData = useMemo<NetWorthData | null>(() => {
    if (isLoading || isRatesLoading || !latestRates) {
      return null;
    }

    // Calculate total accounts in EGP
    const totalAccounts = calculateTotalBalance(accounts, latestRates);

    // Calculate total assets in EGP
    const totalAssets = calculateTotalAssets(assetMetals, latestRates);

    return calculateNetWorth(totalAccounts, totalAssets);
  }, [accounts, assetMetals, latestRates, isLoading, isRatesLoading]);

  return {
    totalNetWorth: netWorthData?.totalNetWorth ?? null,
    totalAccounts: netWorthData?.totalAccounts ?? null,
    totalAssets: netWorthData?.totalAssets ?? null,
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
export function useMonthlyPercentageChange(): {
  monthlyPercentageChange: number | null;
  isLoading: boolean;
} {
  const { isLoading } = useNetWorth();
  const [monthlyPercentageChange, setMonthlyPercentageChange] = useState<
    number | null
  >(null);
  const [isComparisonLoading, setIsComparisonLoading] = useState(true);

  useEffect(() => {
    async function fetchComparison(): Promise<void> {
      const data = await getNetWorthComparison();
      setMonthlyPercentageChange(data?.percentageChange ?? null);
      setIsComparisonLoading(false);
    }

    if (!isLoading) {
      fetchComparison().catch(console.error);
    }
  }, [isLoading]);

  return {
    monthlyPercentageChange,
    isLoading: isLoading || isComparisonLoading,
  };
}
