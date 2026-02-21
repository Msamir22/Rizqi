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
 * Compute net worth from account and asset totals.
 *
 * Values are denominated in USD by default and may be converted for display elsewhere.
 *
 * @param totalAccounts - Total account balances (denominated in USD by default)
 * @param totalAssets - Total asset value (denominated in USD by default)
 * @returns An object containing `totalAccounts`, `totalAssets`, `totalNetWorth` (their sum), and `calculatedAt` (timestamp of calculation)
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