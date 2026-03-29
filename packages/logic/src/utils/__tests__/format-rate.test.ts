/**
 * Unit tests for format-rate utilities.
 *
 * Covers:
 * - formatRate: integer rendering, decimal precision, trailing zero stripping, thousands separators
 * - calculateTrendPercent: positive/negative/flat trends, null/zero previous value edge cases
 *
 * @module format-rate.test
 */

import { calculateTrendPercent, formatRate } from "../format-rate";

// =============================================================================
// formatRate
// =============================================================================

describe("formatRate", () => {
  it("formats integers without decimals", () => {
    expect(formatRate(4850)).toBe("4,850");
  });

  it("formats values with 1 significant decimal place", () => {
    expect(formatRate(50.4)).toBe("50.4");
  });

  it("formats values with 2 decimal places", () => {
    expect(formatRate(4850.87)).toBe("4,850.87");
  });

  it("strips trailing zeros from .X0 values", () => {
    expect(formatRate(50.1)).toBe("50.1");
  });

  it("strips trailing zeros from .00 values", () => {
    // 4850.00 should render as "4,850" not "4,850.00"
    expect(formatRate(4850.0)).toBe("4,850");
  });

  it("rounds to 2 decimal places", () => {
    // 50.456 → "50.46" (banker's rounding)
    expect(formatRate(50.456)).toBe("50.46");
  });

  it("adds thousands separators for large numbers", () => {
    expect(formatRate(1234567.89)).toBe("1,234,567.89");
  });

  it("handles zero", () => {
    expect(formatRate(0)).toBe("0");
  });

  it("handles small decimals", () => {
    expect(formatRate(0.75)).toBe("0.75");
  });

  it("handles negative values", () => {
    expect(formatRate(-123.45)).toBe("-123.45");
  });
});

// =============================================================================
// calculateTrendPercent
// =============================================================================

describe("calculateTrendPercent", () => {
  it("calculates positive trend correctly", () => {
    // (110 - 100) / 100 * 100 = 10%
    expect(calculateTrendPercent(110, 100)).toBeCloseTo(10, 2);
  });

  it("calculates negative trend correctly", () => {
    // (90 - 100) / 100 * 100 = -10%
    expect(calculateTrendPercent(90, 100)).toBeCloseTo(-10, 2);
  });

  it("returns 0 for no change", () => {
    expect(calculateTrendPercent(100, 100)).toBe(0);
  });

  it("returns 0 when previous is null", () => {
    expect(calculateTrendPercent(100, null)).toBe(0);
  });

  it("returns 0 when previous is zero (avoids division by zero)", () => {
    expect(calculateTrendPercent(100, 0)).toBe(0);
  });

  it("handles fractional percentage changes", () => {
    // (101.5 - 100) / 100 * 100 = 1.5%
    expect(calculateTrendPercent(101.5, 100)).toBeCloseTo(1.5, 2);
  });

  it("handles large percentage drops", () => {
    // (50 - 200) / 200 * 100 = -75%
    expect(calculateTrendPercent(50, 200)).toBeCloseTo(-75, 2);
  });
});
