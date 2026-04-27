/**
 * Unit tests for the account-display helper.
 *
 * Behavioral contract (per spec 026-followup, 2026-04-26):
 *   - Accounts whose `name` (trimmed) is unique → render as-is.
 *   - Accounts whose `name` (trimmed) collides with at least one other →
 *     render `"{name} ({currency})"`.
 *   - Underlying `account.name` MUST NEVER be mutated.
 *   - Comparison is trimmed but case-sensitive (preserves user intent).
 */

import {
  buildAccountDisplayNames,
  resolveAccountDisplayName,
  type AccountDisplayInput,
} from "@/utils/account-display";

// =============================================================================
// Helpers
// =============================================================================

function acct(id: string, name: string, currency: string): AccountDisplayInput {
  return { id, name, currency };
}

// =============================================================================
// resolveAccountDisplayName
// =============================================================================

describe("resolveAccountDisplayName", () => {
  it("returns the trimmed name when it is unique across the list", () => {
    const accounts = [
      acct("1", "Cash", "EGP"),
      acct("2", "CIB Main", "EGP"),
      acct("3", "Vodafone Cash", "EGP"),
    ];
    expect(resolveAccountDisplayName(accounts[0], accounts)).toBe("Cash");
    expect(resolveAccountDisplayName(accounts[1], accounts)).toBe("CIB Main");
    expect(resolveAccountDisplayName(accounts[2], accounts)).toBe(
      "Vodafone Cash"
    );
  });

  it("suffixes the currency when the name collides with another account", () => {
    const accounts = [
      acct("1", "Cash", "EGP"),
      acct("2", "Cash", "USD"),
      acct("3", "CIB Main", "EGP"),
    ];
    expect(resolveAccountDisplayName(accounts[0], accounts)).toBe("Cash (EGP)");
    expect(resolveAccountDisplayName(accounts[1], accounts)).toBe("Cash (USD)");
    expect(resolveAccountDisplayName(accounts[2], accounts)).toBe("CIB Main");
  });

  it("trims leading/trailing whitespace before comparing", () => {
    const accounts = [acct("1", "  Cash  ", "EGP"), acct("2", "Cash", "USD")];
    expect(resolveAccountDisplayName(accounts[0], accounts)).toBe("Cash (EGP)");
    expect(resolveAccountDisplayName(accounts[1], accounts)).toBe("Cash (USD)");
  });

  it("treats names with different casing as DISTINCT (case-sensitive)", () => {
    const accounts = [acct("1", "Cash", "EGP"), acct("2", "cash", "USD")];
    expect(resolveAccountDisplayName(accounts[0], accounts)).toBe("Cash");
    expect(resolveAccountDisplayName(accounts[1], accounts)).toBe("cash");
  });

  it("does NOT mutate the source `name` field", () => {
    const acc = acct("1", "  Cash  ", "EGP");
    const accounts = [acc, acct("2", "Cash", "USD")];
    resolveAccountDisplayName(acc, accounts);
    expect(acc.name).toBe("  Cash  ");
  });

  it("handles a triple collision across 3+ currencies", () => {
    const accounts = [
      acct("1", "Cash", "EGP"),
      acct("2", "Cash", "USD"),
      acct("3", "Cash", "EUR"),
    ];
    expect(resolveAccountDisplayName(accounts[0], accounts)).toBe("Cash (EGP)");
    expect(resolveAccountDisplayName(accounts[1], accounts)).toBe("Cash (USD)");
    expect(resolveAccountDisplayName(accounts[2], accounts)).toBe("Cash (EUR)");
  });

  it("handles a single-account list (no possible duplicates)", () => {
    const accounts = [acct("1", "Cash", "EGP")];
    expect(resolveAccountDisplayName(accounts[0], accounts)).toBe("Cash");
  });

  it("returns the trimmed name when the account is not present in the list (defensive)", () => {
    const accounts = [acct("2", "CIB Main", "EGP")];
    const orphan = acct("99", "Pocket", "USD");
    // `orphan` doesn't appear in the list → no collision count, returns plain.
    expect(resolveAccountDisplayName(orphan, accounts)).toBe("Pocket");
  });
});

// =============================================================================
// buildAccountDisplayNames
// =============================================================================

describe("buildAccountDisplayNames", () => {
  it("returns an empty Map for an empty list", () => {
    expect(buildAccountDisplayNames([])).toEqual(new Map());
  });

  it("returns trimmed names for a list with no duplicates", () => {
    const accounts = [
      acct("1", "Cash", "EGP"),
      acct("2", "CIB Main", "EGP"),
      acct("3", "Vodafone Cash", "EGP"),
    ];
    const map = buildAccountDisplayNames(accounts);
    expect(map.get("1")).toBe("Cash");
    expect(map.get("2")).toBe("CIB Main");
    expect(map.get("3")).toBe("Vodafone Cash");
    expect(map.size).toBe(3);
  });

  it("suffixes currency only on the duplicate-name accounts; leaves unique ones alone", () => {
    const accounts = [
      acct("1", "Cash", "EGP"),
      acct("2", "Cash", "USD"),
      acct("3", "CIB Main", "EGP"),
      acct("4", "Vodafone Cash", "EGP"),
    ];
    const map = buildAccountDisplayNames(accounts);
    expect(map.get("1")).toBe("Cash (EGP)");
    expect(map.get("2")).toBe("Cash (USD)");
    expect(map.get("3")).toBe("CIB Main"); // unique → no suffix
    expect(map.get("4")).toBe("Vodafone Cash"); // unique → no suffix
  });

  it("treats whitespace-only differences as duplicates", () => {
    const accounts = [acct("1", "Cash", "EGP"), acct("2", "  Cash  ", "USD")];
    const map = buildAccountDisplayNames(accounts);
    expect(map.get("1")).toBe("Cash (EGP)");
    expect(map.get("2")).toBe("Cash (USD)");
  });

  it("treats different casings as DISTINCT", () => {
    const accounts = [acct("1", "Cash", "EGP"), acct("2", "cash", "USD")];
    const map = buildAccountDisplayNames(accounts);
    expect(map.get("1")).toBe("Cash");
    expect(map.get("2")).toBe("cash");
  });

  it("handles 3+ collisions correctly", () => {
    const accounts = [
      acct("1", "Cash", "EGP"),
      acct("2", "Cash", "USD"),
      acct("3", "Cash", "EUR"),
    ];
    const map = buildAccountDisplayNames(accounts);
    expect(map.get("1")).toBe("Cash (EGP)");
    expect(map.get("2")).toBe("Cash (USD)");
    expect(map.get("3")).toBe("Cash (EUR)");
  });

  it("does NOT mutate the input array or any account object", () => {
    const accounts = [acct("1", "  Cash  ", "EGP"), acct("2", "Cash", "USD")];
    const snapshot = JSON.stringify(accounts);
    buildAccountDisplayNames(accounts);
    expect(JSON.stringify(accounts)).toBe(snapshot);
  });

  it("returns lookups by id, so callers can `map.get(account.id)` regardless of input order", () => {
    const accounts = [
      acct("z", "Cash", "EGP"),
      acct("a", "Cash", "USD"),
      acct("m", "Wallet", "EGP"),
    ];
    const map = buildAccountDisplayNames(accounts);
    // Order-independent — id-keyed lookup.
    expect(map.get("z")).toBe("Cash (EGP)");
    expect(map.get("a")).toBe("Cash (USD)");
    expect(map.get("m")).toBe("Wallet");
  });
});
