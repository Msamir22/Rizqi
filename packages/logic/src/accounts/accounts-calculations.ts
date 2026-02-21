import type { Account, MarketRate } from "@astik/db";
import { convertCurrency } from "../utils/currency";

/**
 * Calculate total balance across all accounts in USD.
 * Converts each account's balance from its native currency to USD
 * using market rates. Returns 0 if conversion is not possible
 * (e.g., missing rates).
 *
 * @param accounts - The accounts whose balances will be converted and summed
 * @param latestMarketRates - Market rates used for currency conversion to USD
 * @returns The sum of all account balances converted to USD
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
