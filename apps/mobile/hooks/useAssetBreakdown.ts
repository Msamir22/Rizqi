/**
 * useAssetBreakdown Hook
 * Reactive hook for asset breakdown data from WatermelonDB
 */

import { AssetMetal, database } from "@monyvi/db";
import {
  AssetBreakdownPercentage,
  calculateAssetBreakdown,
  calculateAssetBreakdownPercentages,
} from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "./useAccounts";
import { useMarketRates } from "./useMarketRates";

interface UseAssetBreakdownResult {
  breakdown: AssetBreakdownPercentage[];
  isLoading: boolean;
}

/**
 * Hook to get asset breakdown (Bank, Cash, Metals) with percentages
 */
export function useAssetBreakdown(): UseAssetBreakdownResult {
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { latestRates, isLoading: ratesLoading } = useMarketRates();
  const [assetMetals, setAssetMetals] = useState<AssetMetal[]>([]);
  const [metalsLoading, setMetalsLoading] = useState(true);

  // Fetch asset metals
  useEffect(() => {
    setMetalsLoading(true);

    const metalsCollection = database.get<AssetMetal>("asset_metals");
    const query = metalsCollection.query(Q.where("deleted", false));

    const subscription = query.observe().subscribe({
      next: (result) => {
        setAssetMetals(result);
        setMetalsLoading(false);
      },
      error: (err: unknown) => {
        console.error("Error observing asset metals:", err);
        setMetalsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  const breakdown = useMemo((): AssetBreakdownPercentage[] => {
    const rawBreakdown = calculateAssetBreakdown(
      accounts,
      assetMetals,
      latestRates
    );
    return calculateAssetBreakdownPercentages(rawBreakdown);
  }, [accounts, assetMetals, latestRates]);

  const isLoading = accountsLoading || ratesLoading || metalsLoading;

  return { breakdown, isLoading };
}
