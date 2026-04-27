/**
 * Account display-name resolution.
 *
 * UX requirement (2026-04-26): when the user has multiple accounts that
 * share the same name (e.g. two "Cash" accounts in EGP and USD, or two
 * bank accounts both named "CIB Main"), the UI MUST disambiguate them by
 * suffixing the currency code in parentheses. Accounts whose name is
 * unique stay rendered as-is.
 *
 * The underlying `account.name` is NEVER mutated — this is a pure display
 * concern handled at the rendering layer.
 *
 * Examples:
 *   accounts = [
 *     { id: "1", name: "Cash",     currency: "EGP" },
 *     { id: "2", name: "Cash",     currency: "USD" },
 *     { id: "3", name: "CIB Main", currency: "EGP" },
 *   ]
 *
 *   resolveAccountDisplayName(accounts[0], accounts) === "Cash (EGP)"
 *   resolveAccountDisplayName(accounts[1], accounts) === "Cash (USD)"
 *   resolveAccountDisplayName(accounts[2], accounts) === "CIB Main"
 *
 * Comparison rules:
 *   - Trim leading/trailing whitespace on both sides before comparing.
 *   - Case-sensitive — "Cash" and "cash" are NOT considered duplicates,
 *     mirroring the user's typed intent. (If product wants case-insensitive
 *     dedup later, swap `trimmedName` for `trimmedName.toLocaleLowerCase()`
 *     in both places.)
 *   - Soft-deleted accounts (`deleted === true`) are EXCLUDED from the
 *     duplicate count by callers — pass only the visible-account list.
 *
 * Architecture: pure function — no React, no DB, no hooks. Lives in `utils/`
 * and is hook-wrapped by `useAccountDisplayNames` for component consumers.
 *
 * @module account-display
 */

// =============================================================================
// Types
// =============================================================================

/** Minimal account shape this helper needs to resolve a display name. */
export interface AccountDisplayInput {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Returns the display name for a single account, suffixing the currency in
 * parentheses iff another account in `allAccounts` shares the same trimmed
 * name. The original `name` is otherwise returned verbatim (only the
 * leading/trailing whitespace is stripped).
 *
 * O(n) per call — for a list, prefer `buildAccountDisplayNames` which
 * computes the whole Map in O(n) total instead of O(n²).
 */
export function resolveAccountDisplayName(
  account: AccountDisplayInput,
  allAccounts: readonly AccountDisplayInput[]
): string {
  const trimmedName = account.name.trim();
  let duplicateCount = 0;
  for (const other of allAccounts) {
    if (other.name.trim() === trimmedName) {
      duplicateCount += 1;
      if (duplicateCount > 1) break;
    }
  }
  if (duplicateCount <= 1) return trimmedName;
  return `${trimmedName} (${account.currency})`;
}

/**
 * Returns a Map<accountId, resolvedDisplayName> for the entire account list.
 *
 * Single O(n) pass to count occurrences of each trimmed name, then a second
 * O(n) pass to build the lookup map. Components rendering lists should call
 * this once (memoized via `useAccountDisplayNames`) and look up by id —
 * avoids the quadratic blowup of calling `resolveAccountDisplayName` inside
 * a render loop.
 */
export function buildAccountDisplayNames(
  accounts: readonly AccountDisplayInput[]
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const a of accounts) {
    const k = a.name.trim();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const out = new Map<string, string>();
  for (const a of accounts) {
    const k = a.name.trim();
    const isDuplicate = (counts.get(k) ?? 0) > 1;
    out.set(a.id, isDuplicate ? `${k} (${a.currency})` : k);
  }
  return out;
}
