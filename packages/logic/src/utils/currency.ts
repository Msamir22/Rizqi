import { MarketRate } from "@astik/db";

export function egpToCurrency(
  amountInEgp: number,
  currencyRate: number
): number {
  return amountInEgp / currencyRate;
}

export function currencyToEGP(
  amountInCurrency: number,
  currencyRate: number
): number {
  return amountInCurrency * currencyRate;
}

/**
 * Convert balance to EGP using market rates
 */
export function convertToEGP(
  balance: number,
  currency: string,
  marketRates: NonNullable<MarketRate>
): number {
  switch (currency) {
    case "EGP":
      return balance;
    case "USD":
      return currencyToEGP(balance, marketRates.usdEgp);
    case "EUR":
      return currencyToEGP(balance, marketRates.eurEgp);
    case "GBP":
      return currencyToEGP(balance, marketRates.gbpEgp);
    case "SAR":
      return currencyToEGP(balance, marketRates.sarEgp);
    case "AED":
      return currencyToEGP(balance, marketRates.aedEgp);
    default:
      return balance;
  }
}

export const formatCurrency = (
  amount: number,
  currency: string,
  minimumFractionDigits: number = 0,
  maximumFractionDigits: number = 0
): string => {
  return (
    new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount) + (currency ? ` ${currency}` : "")
  );
};
