import type { CurrencyType, MarketRate } from "@astik/db";

/**
 * Converts an amount from one currency to another.
 *
 * If `marketRates` is `null`, `amount` is `0`, or `fromCurrency` equals `toCurrency`,
 * the original `amount` is returned unchanged. Otherwise the function uses `marketRates`
 * to compute the converted value.
 *
 * @param amount - The amount in the source currency
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param marketRates - Market rate data used to compute cross-currency conversion
 * @returns The converted amount expressed in the target currency
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyType,
  toCurrency: CurrencyType,
  marketRates: MarketRate | null
): number {
  if (!marketRates || amount === 0 || fromCurrency === toCurrency)
    return amount;
  return amount * marketRates.getRate(fromCurrency, toCurrency);
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
  // Normalize -0 to 0 (IEEE 754 artifact from floating-point arithmetic)
  const normalizedAmount = amount || 0;

  const formattedNumber = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay,
  }).format(normalizedAmount);

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
