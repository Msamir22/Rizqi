/**
 * useAccountDisplayNames Hook
 *
 * Reactive Map<accountId, resolvedName> derived from `useAccounts`.
 *
 * Resolves each account's UI display name by suffixing the currency in
 * parentheses iff the trimmed name collides with another visible account
 * (per spec 026-followup, 2026-04-26). Single-name accounts render as-is.
 *
 * Usage in a list:
 *   const displayNames = useAccountDisplayNames();
 *   ...
 *   <Text>{displayNames.get(account.id) ?? account.name}</Text>
 *
 * The fallback to `account.name` covers the boundary where an account is
 * passed in from outside the `useAccounts` subscription (e.g., during a
 * fresh transaction creation flow before the optimistic insert lands).
 *
 * @module useAccountDisplayNames
 */

import { useMemo } from "react";
import type { Account } from "@rizqi/db";
import { useAccounts } from "@/hooks/useAccounts";
import {
  buildAccountDisplayNames,
  resolveAccountDisplayName,
  type AccountDisplayInput,
} from "@/utils/account-display";

// =============================================================================
// Public API
// =============================================================================

/**
 * Returns a memoized Map<accountId, resolvedDisplayName> for every visible
 * account. Re-computes when the account list (or any account's name /
 * currency) changes.
 */
export function useAccountDisplayNames(): Map<string, string> {
  const { accounts } = useAccounts();
  return useMemo(
    (): Map<string, string> => buildAccountDisplayNames(accounts),
    [accounts]
  );
}

/**
 * Single-account variant — resolves the display name for one account.
 * Equivalent to `useAccountDisplayNames().get(account.id) ?? account.name`
 * but skips the Map allocation when only one display name is needed.
 */
export function useAccountDisplayName(account: Account | null): string {
  const { accounts } = useAccounts();
  return useMemo((): string => {
    if (!account) return "";
    const visible: readonly AccountDisplayInput[] = accounts.map(
      (a): AccountDisplayInput => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
      })
    );
    const target: AccountDisplayInput = {
      id: account.id,
      name: account.name,
      currency: account.currency,
    };
    return resolveAccountDisplayName(target, visible);
  }, [account, accounts]);
}
