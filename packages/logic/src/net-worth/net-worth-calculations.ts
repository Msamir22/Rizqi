/**
 * Net Worth Calculations
 * Combine accounts and assets to calculate total net worth
 */

export interface NetWorthSummary {
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
): NetWorthSummary {
  return {
    totalAccounts,
    totalAssets,
    totalNetWorth: totalAccounts + totalAssets,
    calculatedAt: new Date(),
  };
}
