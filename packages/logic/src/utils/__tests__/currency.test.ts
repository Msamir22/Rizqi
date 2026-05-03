/**
 * Unit tests for currency utility functions.
 *
 * Covers:
 * - convertCurrency: same currency, zero amount, null rates, NaN guard, normal conversion
 * - formatCurrency: currency-specific precision, prefix/suffix symbols, signDisplay, -0 normalization
 * - formatExchangeRate: null rates, same currency, rate >= 1, rate < 1
 * - formatConversionPreview: null rates, same currency, string amounts, NaN amounts, cross-currency
 *
 * @module currency.test
 */

import {
  convertCurrency,
  formatCurrency,
  formatExchangeRate,
  formatConversionPreview,
} from "../currency";
import type { CurrencyType, MarketRate } from "@monyvi/db";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates a mock MarketRate object with a configurable getRate implementation.
 */
function createMockRates(
  getRateImpl: (from: CurrencyType, to: CurrencyType) => number
): MarketRate {
  return { getRate: getRateImpl } as unknown as MarketRate;
}

/** A standard mock where 1 USD = 49.70 EGP */
const standardRates = createMockRates(
  (from: CurrencyType, to: CurrencyType): number => {
    if (from === to) return 1;
    if (from === "USD" && to === "EGP") return 49.7;
    if (from === "EGP" && to === "USD") return 1 / 49.7;
    if (from === "USD" && to === "EUR") return 0.92;
    if (from === "EUR" && to === "USD") return 1 / 0.92;
    if (from === "EGP" && to === "EUR") return (1 / 49.7) * 0.92;
    if (from === "EUR" && to === "EGP") return 49.7 / 0.92;
    return 1; // fallback identity
  }
);

/** A mock that returns NaN for any cross-currency conversion */
const nanRates = createMockRates(
  (from: CurrencyType, to: CurrencyType): number => {
    if (from === to) return 1;
    return NaN;
  }
);

/** A mock that returns Infinity for any cross-currency conversion */
const infinityRates = createMockRates(
  (from: CurrencyType, to: CurrencyType): number => {
    if (from === to) return 1;
    return Infinity;
  }
);

// =============================================================================
// convertCurrency
// =============================================================================

describe("convertCurrency", () => {
  it("returns the original amount when fromCurrency equals toCurrency", () => {
    expect(convertCurrency(100, "USD", "USD", standardRates)).toBe(100);
  });

  it("returns the original amount when amount is 0", () => {
    expect(convertCurrency(0, "USD", "EGP", standardRates)).toBe(0);
  });

  it("returns the original amount when marketRates is null", () => {
    expect(convertCurrency(100, "USD", "EGP", null)).toBe(100);
  });

  it("converts USD to EGP correctly", () => {
    const result = convertCurrency(100, "USD", "EGP", standardRates);
    expect(result).toBeCloseTo(4970, 2);
  });

  it("converts EGP to USD correctly", () => {
    const result = convertCurrency(4970, "EGP", "USD", standardRates);
    expect(result).toBeCloseTo(100, 0);
  });

  it("handles negative amounts", () => {
    const result = convertCurrency(-50, "USD", "EGP", standardRates);
    expect(result).toBeCloseTo(-2485, 2);
  });

  it("handles very small amounts", () => {
    const result = convertCurrency(0.01, "USD", "EGP", standardRates);
    expect(result).toBeCloseTo(0.497, 3);
  });

  it("returns 0 when rate produces NaN", () => {
    const result = convertCurrency(100, "USD", "EGP", nanRates);
    expect(result).toBe(0);
  });

  it("returns 0 when rate produces Infinity", () => {
    const result = convertCurrency(100, "USD", "EGP", infinityRates);
    expect(result).toBe(0);
  });

  it("returns -0 as 0 when amount is -0 (short-circuits on amount === 0)", () => {
    // -0 === 0 is true in JavaScript, so convertCurrency returns -0 directly
    const result = convertCurrency(-0, "USD", "EGP", standardRates);
    expect(Object.is(result, -0)).toBe(true); // it returns the raw -0 since -0 === 0
  });
});

// =============================================================================
// formatCurrency
// =============================================================================

describe("formatCurrency", () => {
  describe("currency-specific precision (CURRENCY_PRECISION)", () => {
    it("formats EGP with 2 decimal places by default", () => {
      expect(formatCurrency({ amount: 1234.56, currency: "EGP" })).toBe(
        "1,234.56 EGP"
      );
    });

    it("formats USD with 2 decimal places by default", () => {
      expect(formatCurrency({ amount: 1234.5, currency: "USD" })).toBe(
        "$1,234.50"
      );
    });

    it("formats EUR with 2 decimal places by default", () => {
      expect(formatCurrency({ amount: 99.9, currency: "EUR" })).toBe(
        "\u20AC99.90"
      );
    });

    it("hides decimal places when the rounded fraction is zero", () => {
      expect(formatCurrency({ amount: 50, currency: "GBP" })).toBe("\u00A350");
    });

    it("keeps currency precision when the rounded fraction is non-zero", () => {
      expect(formatCurrency({ amount: 50.5, currency: "GBP" })).toBe(
        "\u00A350.50"
      );
    });

    it("formats SAR with 2 decimal places by default", () => {
      expect(formatCurrency({ amount: 100.99, currency: "SAR" })).toBe(
        "100.99 SAR"
      );
    });

    it("formats BTC with 8 decimal places by default", () => {
      expect(formatCurrency({ amount: 0.00012345, currency: "BTC" })).toBe(
        "\u20BF0.00012345"
      );
    });

    it("uses DEFAULT_PRECISION (2) for unlisted currencies", () => {
      // MAD is in CURRENCY_SYMBOLS but not in CURRENCY_PRECISION
      expect(formatCurrency({ amount: 100.75, currency: "MAD" })).toBe(
        "100.75 MAD"
      );
    });
  });

  describe("caller overrides for fraction digits", () => {
    it("overrides minimumFractionDigits for EGP", () => {
      expect(
        formatCurrency({
          amount: 100,
          currency: "EGP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      ).toBe("100.00 EGP");
    });

    it("overrides maximumFractionDigits for USD", () => {
      expect(
        formatCurrency({
          amount: 9.999,
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      ).toBe("$10");
    });
  });

  describe("negative zero normalization", () => {
    it("normalizes -0 to 0 for EGP", () => {
      const result = formatCurrency({ amount: -0, currency: "EGP" });
      expect(result).toBe("0 EGP");
    });

    it("normalizes -0 to 0 for USD", () => {
      const result = formatCurrency({ amount: -0, currency: "USD" });
      expect(result).toBe("$0");
    });
  });

  describe("zero values", () => {
    it("formats zero EGP correctly", () => {
      expect(formatCurrency({ amount: 0, currency: "EGP" })).toBe("0 EGP");
    });

    it("formats zero USD correctly", () => {
      expect(formatCurrency({ amount: 0, currency: "USD" })).toBe("$0");
    });
  });

  describe("negative values", () => {
    it("formats negative EGP as suffix currency", () => {
      expect(formatCurrency({ amount: -500, currency: "EGP" })).toBe(
        "-500 EGP"
      );
    });

    it("formats negative USD with minus before symbol", () => {
      expect(formatCurrency({ amount: -25.5, currency: "USD" })).toBe(
        "-$25.50"
      );
    });

    it("formats negative EUR with minus before symbol", () => {
      expect(formatCurrency({ amount: -10.99, currency: "EUR" })).toBe(
        "-\u20AC10.99"
      );
    });
  });

  describe("prefix vs suffix currencies", () => {
    it("uses prefix symbol for USD", () => {
      expect(formatCurrency({ amount: 100, currency: "USD" })).toMatch(/^\$/);
    });

    it("uses prefix symbol for JPY", () => {
      expect(formatCurrency({ amount: 1000, currency: "JPY" })).toMatch(
        /^\u00A5/
      );
    });

    it("uses suffix for EGP", () => {
      expect(formatCurrency({ amount: 100, currency: "EGP" })).toMatch(/EGP$/);
    });

    it("uses suffix for SAR", () => {
      expect(formatCurrency({ amount: 100, currency: "SAR" })).toMatch(/SAR$/);
    });
  });

  describe("signDisplay option", () => {
    it("shows plus sign with signDisplay 'always' for positive amount", () => {
      const result = formatCurrency({
        amount: 50,
        currency: "EGP",
        signDisplay: "always",
      });
      expect(result).toContain("+");
    });

    it("shows minus sign with signDisplay 'always' for negative amount", () => {
      const result = formatCurrency({
        amount: -50,
        currency: "EGP",
        signDisplay: "always",
      });
      expect(result).toContain("-");
    });

    it("hides sign with signDisplay 'never'", () => {
      const result = formatCurrency({
        amount: -50,
        currency: "EGP",
        signDisplay: "never",
      });
      expect(result).not.toContain("-");
      expect(result).toBe("50 EGP");
    });
  });

  describe("large numbers", () => {
    it("adds thousands separators", () => {
      expect(formatCurrency({ amount: 1234567, currency: "EGP" })).toBe(
        "1,234,567 EGP"
      );
    });

    it("adds thousands separators for USD with decimals", () => {
      expect(formatCurrency({ amount: 1234567.89, currency: "USD" })).toBe(
        "$1,234,567.89"
      );
    });
  });
});

// =============================================================================
// formatExchangeRate
// =============================================================================

describe("formatExchangeRate", () => {
  it("returns unavailable message when rates is null", () => {
    expect(formatExchangeRate("USD", "EGP", null)).toBe(
      "Exchange rate unavailable"
    );
  });

  it("returns identity string when both currencies are the same", () => {
    expect(formatExchangeRate("USD", "USD", standardRates)).toBe(
      "1 USD = 1 USD"
    );
  });

  it("formats rate >= 1 with currencyA as base", () => {
    // 1 USD = 49.70 EGP (rate is 49.7 which is >= 1)
    expect(formatExchangeRate("USD", "EGP", standardRates)).toBe(
      "1 USD = 49.70 EGP"
    );
  });

  it("flips to stronger currency as base when rate < 1", () => {
    // EGP to USD rate is ~0.02, so it flips: 1 USD = 49.70 EGP
    expect(formatExchangeRate("EGP", "USD", standardRates)).toBe(
      "1 USD = 49.70 EGP"
    );
  });

  it("uses up to 4 decimal places for the secondary direction", () => {
    // Create a rate where the flipped direction has significant decimals
    const customRates = createMockRates(
      (from: CurrencyType, to: CurrencyType): number => {
        if (from === to) return 1;
        if (from === "EGP" && to === "EUR") return 0.018; // < 1, will flip
        if (from === "EUR" && to === "EGP") return 55.5556;
        return 1;
      }
    );
    const result = formatExchangeRate("EGP", "EUR", customRates);
    // maximumFractionDigits is 4 for the secondary direction
    expect(result).toBe("1 EUR = 55.5556 EGP");
  });

  it("formats exactly rate = 1 with base currencyA", () => {
    const oneToOneRates = createMockRates((): number => 1);
    expect(formatExchangeRate("USD", "EUR", oneToOneRates)).toBe(
      "1 USD = 1.00 EUR"
    );
  });
});

// =============================================================================
// formatConversionPreview
// =============================================================================

describe("formatConversionPreview", () => {
  it("returns unavailable message when rates is null", () => {
    expect(formatConversionPreview(100, "USD", "EGP", null)).toBe(
      "Exchange rate unavailable"
    );
  });

  it("returns formatted amount without rate info when currencies are the same", () => {
    const result = formatConversionPreview(100, "USD", "USD", standardRates);
    // Same currency just formats with 2 decimal places
    expect(result).toBe("$100.00");
  });

  it("builds preview string for cross-currency conversion", () => {
    const result = formatConversionPreview(100, "USD", "EGP", standardRates);
    expect(result).toContain("\u2248"); // approximately sign
    expect(result).toContain("EGP");
    expect(result).toContain("at rate");
    expect(result).toContain("1 USD = 49.70 EGP");
  });

  it("handles string amount input", () => {
    const result = formatConversionPreview("50", "USD", "EGP", standardRates);
    expect(result).toContain("\u2248");
    expect(result).toContain("EGP");
  });

  it("handles empty string amount (treated as 0)", () => {
    const result = formatConversionPreview("", "USD", "EGP", standardRates);
    // parseFloat("") is NaN, falls back to 0, convertCurrency(0, ...) returns 0
    expect(result).toContain("\u2248");
    expect(result).toContain("0");
  });

  it("handles NaN string amount gracefully", () => {
    const result = formatConversionPreview(
      "not-a-number",
      "USD",
      "EGP",
      standardRates
    );
    expect(result).toContain("\u2248");
    expect(result).toContain("0");
  });

  it("handles numeric NaN input gracefully", () => {
    const result = formatConversionPreview(NaN, "USD", "EGP", standardRates);
    expect(result).toContain("\u2248");
    expect(result).toContain("0");
  });

  it("handles negative amount", () => {
    const result = formatConversionPreview(-100, "USD", "EGP", standardRates);
    expect(result).toContain("\u2248");
    expect(result).toContain("EGP");
  });

  it("handles zero amount for same currency (EGP)", () => {
    const result = formatConversionPreview(0, "EGP", "EGP", standardRates);
    // formatConversionPreview uses PRIMARY_RATE_FRACTION_DIGITS (2) for same-currency
    expect(result).toBe("0.00 EGP");
  });

  it("handles zero amount for cross-currency", () => {
    const result = formatConversionPreview(0, "USD", "EGP", standardRates);
    // convertCurrency returns 0 for amount === 0 (short circuit)
    expect(result).toContain("\u2248");
    expect(result).toContain("0.00 EGP");
  });
});
