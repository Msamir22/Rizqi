import { Account } from "@astik/db";
import { Currency, MarketRates } from "../types";

export function calculateTotalBalance(
  accounts: Account[],
  latestMarketRates: MarketRates
) {
  // If market rates are available, calculate total balance using rates
  return latestMarketRates
    ? accounts.reduce((total, account) => {
        switch (account.currency) {
          case Currency.EGP:
            return total + account.balance;
          case Currency.USD:
            return total + account.balance * latestMarketRates.usd_egp!;
          case Currency.EUR:
            return total + account.balance * latestMarketRates.eur_egp!;
          default:
            return total;
        }
      }, 0)
    : // If no market rates, only consider EGP accounts
      accounts
        .filter((account) => account.currency === Currency.EGP)
        .reduce((total, account) => total + account.balance, 0);
}
