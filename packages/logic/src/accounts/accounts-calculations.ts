import type { Account, MarketRate } from "@astik/db";
import { convertCurrency } from "../utils/currency";

/**
 * Compute the combined USD value of the provided accounts.
 *
 * Converts each account's balance from its currency to USD using the supplied market rates and returns the sum.
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