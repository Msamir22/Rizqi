/**
 * Net Worth Calculations
 * Combine accounts and assets to calculate total net worth
 */

export interface NetWorthData {
  totalAccounts: number;
  totalAssets: number;
  totalNetWorth: number;
  calculatedAt: Date;
}

/**
 * Calculate net worth from accounts and assets totals
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
