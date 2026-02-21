/**
 * Unit tests for convertCurrency()
 *
 * Since MarketRate is a WatermelonDB model, we create a mock object
 * that replicates the getRate() logic: rate = fromUsd / toUsd.
 *
 * We define local interfaces instead of importing from @astik/db because
 * Jest's Babel transform cannot parse WatermelonDB decorators. TypeScript's
 * structural typing ensures our mock is compatible with the real MarketRate.
 */

import { convertCurrency, formatCurrency } from "@astik/logic";

// ---------------------------------------------------------------------------
// Local type definitions (structurally compatible with @astik/db)
// ---------------------------------------------------------------------------

/** Mirrors the subset of MarketRate that convertCurrency() requires */
interface MockMarketRate {
  readonly getRate: (from: string, to: string) => number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Mock MarketRate factory
// ---------------------------------------------------------------------------

/**
 * Create a mock MarketRate with given USD rates.
 * Each rate represents the value of 1 unit of the currency in USD.
 * USD itself is implicitly 1.
 */
function createMockRates(rates: Record<string, number>): MockMarketRate {
  const rateEntries: Record<string, number> = Object.fromEntries(
    Object.entries(rates).map(([currency, value]) => [
      `${currency.toLowerCase()}Usd`,
      value,
    ])
  );

  const mock: MockMarketRate = {
    ...rateEntries,
    getRate(from: string, to: string): number {
      if (from === to) return 1;

      const getUsdValue = (currency: string): number | null => {
        if (currency === "USD") return 1;
        const key = `${currency.toLowerCase()}Usd`;
        const rate = rateEntries[key];
        if (typeof rate !== "number" || rate === 0) {
          return null;
        }
        return rate;
      };

      const fromUsd = getUsdValue(from);
      const toUsd = getUsdValue(to);
      if (fromUsd === null || toUsd === null) return 1;
      return fromUsd / toUsd;
    },
  };

  return mock;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Structural cast: our MockMarketRate is compatible with MarketRate.getRate()
// but doesn't implement the full WatermelonDB model surface.
const RATES = createMockRates({
  EGP: 0.02, // 1 EGP = $0.02 (i.e. 50 EGP per USD)
  EUR: 1.05, // 1 EUR = $1.05
  JPY: 0.0067, // 1 JPY = $0.0067
  GBP: 1.27, // 1 GBP = $1.27
  SAR: 0.2667, // 1 SAR = $0.2667
}) as unknown as Parameters<typeof convertCurrency>[3];

// ---------------------------------------------------------------------------
// Tests: convertCurrency
// ---------------------------------------------------------------------------

describe("convertCurrency", () => {
  it("returns the same amount for identity conversion (same currency)", () => {
    expect(convertCurrency(100, "USD", "USD", RATES)).toBe(100);
    expect(convertCurrency(250.5, "EGP", "EGP", RATES)).toBe(250.5);
    expect(convertCurrency(0, "EUR", "EUR", RATES)).toBe(0);
  });

  it("returns 0 for zero amount regardless of currencies", () => {
    expect(convertCurrency(0, "USD", "EGP", RATES)).toBe(0);
    expect(convertCurrency(0, "EUR", "JPY", RATES)).toBe(0);
  });

  it("converts USD → EGP correctly", () => {
    // 1 USD = 1 / 0.02 = 50 EGP
    const result = convertCurrency(1, "USD", "EGP", RATES);
    expect(result).toBeCloseTo(50, 2);
  });

  it("converts EGP → USD correctly", () => {
    // 100 EGP = 100 × 0.02 = $2.00
    const result = convertCurrency(100, "EGP", "USD", RATES);
    expect(result).toBeCloseTo(2, 2);
  });

  it("converts EUR → JPY (cross-currency via USD)", () => {
    // 100 EUR → JPY = 100 × (1.05 / 0.0067) ≈ 15,671.64
    const result = convertCurrency(100, "EUR", "JPY", RATES);
    const expected = 100 * (1.05 / 0.0067);
    expect(result).toBeCloseTo(expected, 2);
  });

  it("handles A → B → A roundtrip (reversibility)", () => {
    const original = 1000;
    const eurAmount = convertCurrency(original, "USD", "EUR", RATES);
    const backToUsd = convertCurrency(eurAmount, "EUR", "USD", RATES);
    expect(backToUsd).toBeCloseTo(original, 6);
  });

  it("handles multi-hop A → B → C roundtrip", () => {
    const original = 500;
    const step1 = convertCurrency(original, "EGP", "EUR", RATES);
    const step2 = convertCurrency(step1, "EUR", "JPY", RATES);
    const step3 = convertCurrency(step2, "JPY", "EGP", RATES);
    expect(step3).toBeCloseTo(original, 4);
  });

  it("returns unconverted amount for a currency with missing rate", () => {
    // BTC is not in our mock rates — getRate returns 1 (fallback)
    const result = convertCurrency(42, "BTC", "USD", RATES);
    expect(result).toBe(42);
  });

  it("handles large amounts without precision issues", () => {
    const result = convertCurrency(1_000_000, "USD", "EGP", RATES);
    expect(result).toBeCloseTo(50_000_000, 0);
  });

  it("handles very small amounts", () => {
    const result = convertCurrency(0.01, "USD", "EGP", RATES);
    expect(result).toBeCloseTo(0.5, 2);
  });
});

// ---------------------------------------------------------------------------
// Tests: formatCurrency
// ---------------------------------------------------------------------------

describe("formatCurrency", () => {
  it("formats USD with prefix symbol", () => {
    expect(formatCurrency({ amount: 1234, currency: "USD" })).toBe("$1,234");
  });

  it("formats EGP with suffix code", () => {
    expect(formatCurrency({ amount: 1234, currency: "EGP" })).toBe("1,234 EGP");
  });

  it("formats negative amounts correctly", () => {
    expect(formatCurrency({ amount: -500, currency: "USD" })).toBe("-$500");
  });

  it("respects fraction digit options", () => {
    expect(
      formatCurrency({
        amount: 99.456,
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    ).toBe("€99.46");
  });
});
