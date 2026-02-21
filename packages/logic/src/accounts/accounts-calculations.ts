import type { Account, MarketRate } from "@astik/db";
import { convertCurrency } from "../utils/currency";

/**
 * Calculate total balance across all accounts in USD.
 * Converts each account's balance from its native currency to USD.
 * If no market rates are available, only sums USD accounts.
 */
export function calculateAccountsTotalBalance(
  accounts: Account[],
  latestMarketRates: MarketRate
): number {
  return accounts.reduce((total, account) => {
    return (
      total +
      convertCurrency(
        account.balance,
        account.currency,
        "USD",
        latestMarketRates
      )
    );
  }, 0);
}
