import { Account, MarketRate } from "@astik/db";

export function calculateTotalBalance(
  accounts: Account[],
  latestMarketRates: MarketRate | null
) {
  // If market rates are available, calculate total balance using rates
  return latestMarketRates
    ? accounts.reduce((total, account) => {
        switch (account.currency) {
          case "EGP":
            return total + account.balance;
          case "USD":
            return total + account.balance * latestMarketRates.usdEgp;
          case "EUR":
            return total + account.balance * latestMarketRates.eurEgp;
          default:
            return total;
        }
      }, 0)
    : // If no market rates, only consider EGP accounts
      accounts
        .filter((account) => account.currency === "EGP")
        .reduce((total, account) => total + account.balance, 0);
}
