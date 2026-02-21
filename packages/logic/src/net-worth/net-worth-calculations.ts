/**
 * Net Worth Calculations
 * Combine accounts and assets to calculate total net worth.
 * All values are denominated in the base currency (USD) unless
 * explicitly converted to a preferred currency for display.
 */

export interface NetWorthData {
  totalAccounts: number;
  totalAssets: number;
  totalNetWorth: number;
  calculatedAt: Date;
}

/**
 * Calculate net worth from accounts and assets totals.
 * @param totalAccounts - Total accounts balance in the given currency
 * @param totalAssets - Total assets value in the given currency
 */
export function calculateNetWorth(
  totalAccounts: number,
  totalAssets: number
): NetWorthData {
  return {
    totalAccounts,
    totalAssets,
    totalNetWorth: totalAccounts + totalAssets,
    calculatedAt: new Date(),
  };
}
