/**
 * Unit tests for net worth calculation functions.
 *
 * Covers:
 * - calculateNetWorth: happy path, zero values, negative numbers,
 *   large values, mixed positive/negative, single-value scenarios
 *
 * @module net-worth-calculations.test
 */

import { calculateNetWorth } from "../net-worth-calculations";

// =============================================================================
// calculateNetWorth
// =============================================================================

describe("calculateNetWorth", () => {
  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it("should sum totalAccounts and totalAssets into totalNetWorth", () => {
    const result = calculateNetWorth(5000, 3000);

    expect(result.totalAccounts).toBe(5000);
    expect(result.totalAssets).toBe(3000);
    expect(result.totalNetWorth).toBe(8000);
  });

  it("should include a calculatedAt timestamp close to now", () => {
    const before = Date.now();
    const result = calculateNetWorth(100, 200);
    const after = Date.now();

    expect(result.calculatedAt).toBeInstanceOf(Date);
    expect(result.calculatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.calculatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("should return the correct shape matching NetWorthData", () => {
    const result = calculateNetWorth(1000, 2000);
    const keys = Object.keys(result).sort();

    expect(keys).toEqual(
      ["calculatedAt", "totalAccounts", "totalAssets", "totalNetWorth"].sort()
    );
  });

  // ---------------------------------------------------------------------------
  // Zero values
  // ---------------------------------------------------------------------------

  describe("zero values", () => {
    it("should return 0 net worth when both inputs are 0", () => {
      const result = calculateNetWorth(0, 0);

      expect(result.totalNetWorth).toBe(0);
      expect(result.totalAccounts).toBe(0);
      expect(result.totalAssets).toBe(0);
    });

    it("should return totalAssets as net worth when accounts are 0", () => {
      const result = calculateNetWorth(0, 7500);

      expect(result.totalNetWorth).toBe(7500);
    });

    it("should return totalAccounts as net worth when assets are 0", () => {
      const result = calculateNetWorth(4200, 0);

      expect(result.totalNetWorth).toBe(4200);
    });
  });

  // ---------------------------------------------------------------------------
  // Negative numbers (e.g., debt exceeds balance)
  // ---------------------------------------------------------------------------

  describe("negative numbers", () => {
    it("should handle negative totalAccounts (net debt)", () => {
      const result = calculateNetWorth(-2000, 5000);

      expect(result.totalNetWorth).toBe(3000);
      expect(result.totalAccounts).toBe(-2000);
    });

    it("should handle negative totalAssets (unlikely but mathematically valid)", () => {
      const result = calculateNetWorth(3000, -1000);

      expect(result.totalNetWorth).toBe(2000);
    });

    it("should handle both values negative", () => {
      const result = calculateNetWorth(-1500, -500);

      expect(result.totalNetWorth).toBe(-2000);
    });

    it("should return negative net worth when accounts debt exceeds assets", () => {
      const result = calculateNetWorth(-10000, 3000);

      expect(result.totalNetWorth).toBe(-7000);
    });
  });

  // ---------------------------------------------------------------------------
  // Large values
  // ---------------------------------------------------------------------------

  describe("large values", () => {
    it("should handle very large positive values", () => {
      const result = calculateNetWorth(1_000_000_000, 500_000_000);

      expect(result.totalNetWorth).toBe(1_500_000_000);
    });

    it("should handle fractional cent values (floating point)", () => {
      const result = calculateNetWorth(100.505, 200.123);

      expect(result.totalNetWorth).toBeCloseTo(300.628, 10);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("should handle Number.MAX_SAFE_INTEGER without losing precision", () => {
      const result = calculateNetWorth(Number.MAX_SAFE_INTEGER, 0);

      expect(result.totalNetWorth).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should handle very small fractional values", () => {
      const result = calculateNetWorth(0.0001, 0.0002);

      expect(result.totalNetWorth).toBeCloseTo(0.0003, 10);
    });

    it("should preserve original input values in the returned data", () => {
      const accounts = 12345.67;
      const assets = 89012.34;
      const result = calculateNetWorth(accounts, assets);

      expect(result.totalAccounts).toBe(accounts);
      expect(result.totalAssets).toBe(assets);
    });
  });
});
