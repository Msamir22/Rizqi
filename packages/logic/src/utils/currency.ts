import type { CurrencyType, MarketRate } from "@monyvi/db";

const EXCHANGE_RATE_UNAVAILABLE_MESSAGE = "Exchange rate unavailable";
const CONVERSION_UNAVAILABLE_MESSAGE = "Conversion unavailable";
const PRIMARY_RATE_FRACTION_DIGITS = 2;
const SECONDARY_RATE_MAX_FRACTION_DIGITS = 4;

/**
 * Converts an amount from one currency to another.
 *
 * If `marketRates` is `null`, `amount` is `0`, or `fromCurrency` equals `toCurrency`,
 * the original `amount` is returned unchanged. Otherwise the function uses `marketRates`
 * to compute the converted value.
 *
 * **Offline-first behavior**: When a specific currency pair rate is unavailable,
 * `MarketRate.getRate()` returns 1 (identity) so the unconverted amount is shown
 * rather than crashing. The UI should display staleness warnings (via `isStale`)
 * to alert the user that rates may be outdated.
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
  const rate = marketRates.getRate(fromCurrency, toCurrency);
  const result = amount * rate;
  // Guard against NaN / missing rates — return 0 to signal conversion failure
  // rather than silently returning the unconverted source amount.
  return Number.isFinite(result) ? result : 0;
}

/**
 * Formats a given exchange rate between two currencies.
 * To avoid showing very small decimals (like 1 EGP = 0.020 USD),
 * it treats the "stronger" currency as the base (the "1") by checking
 * which direction yields a rate >= 1.
 * For example, if from=EGP and to=USD, it returns "1 USD = 49.70 EGP",
 * rather than "1 EGP = 0.02 USD" as doing so reflects the conventional way
 * rates are displayed (like in LiveRates).
 */
export function formatExchangeRate(
  currencyA: CurrencyType,
  currencyB: CurrencyType,
  rates: MarketRate | null
): string {
  if (!rates) return EXCHANGE_RATE_UNAVAILABLE_MESSAGE;
  if (currencyA === currencyB) return `1 ${currencyA} = 1 ${currencyA}`;

  const rateAToB = rates.getRate(currencyA, currencyB);

  if (rateAToB >= 1) {
    // 1 currencyA = rateAToB currencyB
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
      minimumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
    }).format(rateAToB);
    return `1 ${currencyA} = ${formatted} ${currencyB}`;
  } else {
    // 1 currencyB = rateBToA currencyA
    const rateBToA = rates.getRate(currencyB, currencyA);
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: SECONDARY_RATE_MAX_FRACTION_DIGITS,
      minimumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
    }).format(rateBToA);
    return `1 ${currencyB} = ${formatted} ${currencyA}`;
  }
}

/**
 * Builds the "≈ X.XX EGP at rate 1 USD = 49.70 EGP" preview string
 * for cross-currency transactions dynamically.
 */
export function formatConversionPreview(
  amount: number | string,
  fromCurrency: CurrencyType,
  toCurrency: CurrencyType,
  rates: MarketRate | null
): string {
  if (!rates) return EXCHANGE_RATE_UNAVAILABLE_MESSAGE;
  try {
    const rawVal = typeof amount === "string" ? parseFloat(amount) : amount;
    const safeAmount = Number.isFinite(rawVal) ? rawVal : 0;

    if (fromCurrency === toCurrency) {
      return formatCurrency({
        amount: safeAmount,
        currency: toCurrency,
        minimumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
        maximumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
      });
    }

    const converted = convertCurrency(
      safeAmount,
      fromCurrency,
      toCurrency,
      rates
    );
    const rateDisplay = formatExchangeRate(fromCurrency, toCurrency, rates);
    return `≈ ${formatCurrency({
      amount: converted,
      currency: toCurrency,
      minimumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
      maximumFractionDigits: PRIMARY_RATE_FRACTION_DIGITS,
    })} at rate ${rateDisplay}`;
  } catch {
    return CONVERSION_UNAVAILABLE_MESSAGE;
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

/**
 * Default decimal precision per currency.
 * Most currencies allow up to 2 decimal places (ISO 4217 standard).
 * Whole amounts hide their fractional part unless the caller overrides
 * `minimumFractionDigits`.
 * BHD/KWD/OMR = 3 (ISO 4217 three-decimal currencies).
 * BTC = 8 (satoshi precision).
 * Override per call via `minimumFractionDigits`/`maximumFractionDigits`.
 */
const CURRENCY_PRECISION: Partial<Record<CurrencyType, number>> = {
  // Three-decimal currencies (ISO 4217)
  BHD: 3,
  KWD: 3,
  OMR: 3,
  // Crypto
  BTC: 8,
  // All other currencies default to 2 via DEFAULT_PRECISION
};

/** Default precision for currencies not listed in CURRENCY_PRECISION (ISO 4217 standard) */
const DEFAULT_PRECISION = 2;

function hasNonZeroFractionAtPrecision(
  amount: number,
  precision: number
): boolean {
  if (precision <= 0) return false;
  const factor = 10 ** precision;
  const roundedMinorUnits = Math.round(Math.abs(amount) * factor);
  return roundedMinorUnits % factor !== 0;
}

export const formatCurrency = ({
  amount,
  currency,
  signDisplay = "auto",
  minimumFractionDigits,
  maximumFractionDigits,
}: {
  amount: number;
  currency: CurrencyType;
  signDisplay?: "always" | "exceptZero" | "negative" | "never" | "auto";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  // Use currency-specific precision when caller doesn't override
  const precision = CURRENCY_PRECISION[currency] ?? DEFAULT_PRECISION;
  // Normalize -0 to 0 (IEEE 754 artifact from floating-point arithmetic)
  const normalizedAmount = amount || 0;
  const hasFraction = hasNonZeroFractionAtPrecision(
    normalizedAmount,
    precision
  );
  const minDigits = minimumFractionDigits ?? (hasFraction ? precision : 0);
  const maxDigits = maximumFractionDigits ?? precision;

  const formattedNumber = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
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
      // Strip the leading minus sign from the formatted number and prepend -symbol
      return `-${symbol}${formattedNumber.replace(/^-/, "")}`;
    }
    return `${symbol}${formattedNumber}`;
  }

  // For currencies with suffix (EGP, SAR, and other Middle Eastern currencies)
  return `${formattedNumber} ${symbol}`;
};
