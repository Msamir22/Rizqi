import { CurrencyType, MarketRate } from "@astik/db";

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

const CURRENCY_SYMBOLS: Partial<Record<CurrencyType, string>> = {
  // Major currencies with symbols
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  RUB: "₽",
  TRY: "₺",
  KRW: "₩",

  // Middle Eastern & African currencies - use codes for clarity
  EGP: "EGP",
  SAR: "SAR",
  AED: "AED",
  KWD: "KWD",
  BHD: "BHD",
  OMR: "OMR",
  QAR: "QAR",
  JOD: "JOD",
  IQD: "IQD",
  LYD: "LYD",
  TND: "TND",
  MAD: "MAD",
  DZD: "DZD",

  // Crypto
  BTC: "₿",

  // Others
  CAD: "C$",
  AUD: "A$",
  NZD: "NZ$",
  SGD: "S$",
  HKD: "HK$",
  CHF: "CHF",
  SEK: "SEK",
  NOK: "NOK",
  DKK: "DKK",
  ZAR: "ZAR",
  MYR: "MYR",
};

export const formatCurrency = ({
  amount,
  currency,
  signDisplay = "auto",
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
}: {
  amount: number;
  currency: CurrencyType;
  signDisplay?: "always" | "exceptZero" | "negative" | "never" | "auto";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  const formattedNumber = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay,
  }).format(amount);

  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  // For currencies with prefix symbols (USD, EUR, GBP, etc.)
  const prefixCurrencies = [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CNY",
    "INR",
    "RUB",
    "TRY",
    "KRW",
    "BTC",
    "CAD",
    "AUD",
    "NZD",
    "SGD",
    "HKD",
  ];

  if (prefixCurrencies.includes(currency)) {
    if (amount < 0) {
      return `-${symbol}${Math.abs(Number(formattedNumber))}`;
    }
    return `${symbol}${formattedNumber}`;
  }

  // For currencies with suffix (EGP, SAR, and other Middle Eastern currencies)
  return `${formattedNumber} ${symbol}`;
};
