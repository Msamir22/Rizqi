/**
 * useAccounts Hook
 * Reactive hook for account data from WatermelonDB
 */

import { Account, database } from "@astik/db";
import { calculateAccountsTotalBalance, convertCurrency } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { useMarketRates } from "./useMarketRates";
import { usePreferredCurrency } from "./usePreferredCurrency";

interface UseAccountsResult {
  readonly accounts: Account[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly totalAccountsBalance: number;
  readonly refetch: () => void;
}

/**
 * Hook to get all user accounts reactively
 */
export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { latestRates } = useMarketRates();
  const { preferredCurrency } = usePreferredCurrency();

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const accountsCollection = database.get<Account>("accounts");

    // Query non-deleted accounts sorted by created_at (newest first)
    const query = accountsCollection.query(Q.where("deleted", false));

    // Subscribe to changes
    const subscription = query.observe().subscribe({
      next: (result) => {
        setAccounts(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        console.error("Error observing accounts:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [refreshKey]);

  const totalAccountsBalance = useMemo(() => {
    if (!latestRates) return 0;
    const totalUsd = calculateAccountsTotalBalance(accounts, latestRates);
    if (preferredCurrency === "USD") return totalUsd;
    return convertCurrency(totalUsd, "USD", preferredCurrency, latestRates);
  }, [accounts, latestRates, preferredCurrency]);

  return {
    accounts,
    isLoading,
    error,
    totalAccountsBalance,
    refetch,
  };
}

export interface UseTopAccountsResult {
  accounts: Account[];
  isLoading: boolean;
}

/**
 * Hook to get top N accounts ordered by balance (highest first)
 * Used for dashboard display
 */
export function useTopAccounts(limit: number = 3): UseTopAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    const accountsCollection = database.get<Account>("accounts");

    // Query non-deleted accounts, ordered by balance descending, limited
    const query = accountsCollection.query(
      Q.where("deleted", false),
      Q.sortBy("created_at", Q.desc),
      Q.take(limit)
    );

    // Use observeWithColumns to react to balance changes, not just add/remove
    const subscription = query.observe().subscribe({
      next: (result) => {
        setAccounts(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        console.error("Error observing top accounts:", err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  return { accounts, isLoading };
}

export interface UseAccountResult {
  account: Account | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to get a single account by ID
 */
export function useAccount(accountId: string | null): UseAccountResult {
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
        error: (err: unknown) => {
          console.error("Error observing account:", err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [accountId]);

  return { account, isLoading, error };
}
