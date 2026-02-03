/**
 * useAccounts Hook
 * Reactive hook for account data from WatermelonDB
 */

import { Account, database } from "@astik/db";
import { calculateTotalBalance } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";
import { useMarketRates } from "./useMarketRates";

interface UseAccountsResult {
  accounts: Account[];
  isLoading: boolean;
  error: Error | null;
  totalBalanceEgp: number;
  refetch: () => void;
}

/**
 * Hook to get all user accounts reactively
 */
export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { latestRate } = useMarketRates();

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const accountsCollection = database.get<Account>("accounts");

    // Query non-deleted accounts
    const query = accountsCollection.query(Q.where("deleted", false));

    // Subscribe to changes
    // Use observeWithColumns to trigger updates when balance changes
    const subscription = query
      .observeWithColumns(["balance", "name", "updated_at"])
      .subscribe({
        next: (result) => {
          setAccounts(result);
          setIsLoading(false);
        },
        error: (err) => {
          console.error("Error observing accounts:", err);
          setError(err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [refreshKey]);

  const totalBalanceEgp = calculateTotalBalance(accounts, latestRate);

  return {
    accounts,
    isLoading,
    error,
    totalBalanceEgp,
    refetch,
  };
}

/**
 * Hook to get top N accounts ordered by balance (highest first)
 * Used for dashboard display
 */
export function useTopAccounts(limit: number = 3): {
  accounts: Account[];
  isLoading: boolean;
} {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    const accountsCollection = database.get<Account>("accounts");

    // Query non-deleted accounts, ordered by balance descending, limited
    const query = accountsCollection.query(
      Q.where("deleted", false),
      Q.sortBy("balance", Q.desc),
      Q.take(limit)
    );

    // Use observeWithColumns to react to balance changes, not just add/remove
    const subscription = query.observeWithColumns(["balance"]).subscribe({
      next: (result) => {
        setAccounts(result);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("Error observing top accounts:", err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  return { accounts, isLoading };
}

/**
 * Hook to get a single account by ID
 */
export function useAccount(accountId: string | null): {
  account: Account | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!accountId) {
      setAccount(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const accountsCollection = database.get<Account>("accounts");

    const subscription = accountsCollection
      .findAndObserve(accountId)
      .subscribe({
        next: (result) => {
          setAccount(result);
          setIsLoading(false);
        },
        error: (err) => {
          console.error("Error observing account:", err);
          setError(err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [accountId]);

  return { account, isLoading, error };
}
