/**
 * Unit Tests: Budget Pause Utilities
 *
 * Tests for isWithinPauseWindow, filterExcludedTransactions,
 * buildPauseInterval, and parsePauseIntervals.
 */

import {
  isWithinPauseWindow,
  filterExcludedTransactions,
  buildPauseInterval,
  parsePauseIntervals,
  type PauseInterval,
} from "../budget-pause-utils";

// =============================================================================
// FIXTURES
// =============================================================================

/** Helper: create a Date at a specific time offset for readable tests */
function msOf(isoDate: string): number {
  return new Date(isoDate).getTime();
}

/** Simple transaction-like object for testing */
interface FakeTx {
  readonly date: Date;
  readonly amount: number;
}

function fakeTx(isoDate: string, amount = 100): FakeTx {
  return { date: new Date(isoDate), amount };
}

// =============================================================================
// isWithinPauseWindow
// =============================================================================

describe("isWithinPauseWindow", () => {
  const intervals: readonly PauseInterval[] = [
    { from: msOf("2026-03-05T10:00:00Z"), to: msOf("2026-03-08T10:00:00Z") },
    { from: msOf("2026-03-15T10:00:00Z"), to: msOf("2026-03-17T10:00:00Z") },
  ];

  it("returns false for a transaction before all intervals", () => {
    expect(isWithinPauseWindow(msOf("2026-03-01T12:00:00Z"), intervals)).toBe(
      false
    );
  });

  it("returns true for a transaction inside the first interval", () => {
    expect(isWithinPauseWindow(msOf("2026-03-06T12:00:00Z"), intervals)).toBe(
      true
    );
  });

  it("returns true for a transaction at the exact start of an interval", () => {
    expect(isWithinPauseWindow(msOf("2026-03-05T10:00:00Z"), intervals)).toBe(
      true
    );
  });

  it("returns true for a transaction at the exact end of an interval", () => {
    expect(isWithinPauseWindow(msOf("2026-03-08T10:00:00Z"), intervals)).toBe(
      true
    );
  });

  it("returns false for a transaction between intervals", () => {
    expect(isWithinPauseWindow(msOf("2026-03-10T12:00:00Z"), intervals)).toBe(
      false
    );
  });

  it("returns true for a transaction inside the second interval", () => {
    expect(isWithinPauseWindow(msOf("2026-03-16T12:00:00Z"), intervals)).toBe(
      true
    );
  });

  it("returns false for a transaction after all intervals when not currently paused", () => {
    expect(isWithinPauseWindow(msOf("2026-03-20T12:00:00Z"), intervals)).toBe(
      false
    );
  });

  it("returns true for a transaction after pausedAt when currently paused", () => {
    const pausedAtMs = msOf("2026-03-20T08:00:00Z");
    expect(
      isWithinPauseWindow(msOf("2026-03-20T12:00:00Z"), intervals, pausedAtMs)
    ).toBe(true);
  });

  it("returns true for a transaction exactly at pausedAt", () => {
    const pausedAtMs = msOf("2026-03-20T08:00:00Z");
    expect(
      isWithinPauseWindow(msOf("2026-03-20T08:00:00Z"), intervals, pausedAtMs)
    ).toBe(true);
  });

  it("returns false for a transaction before pausedAt", () => {
    const pausedAtMs = msOf("2026-03-20T08:00:00Z");
    expect(
      isWithinPauseWindow(msOf("2026-03-19T12:00:00Z"), intervals, pausedAtMs)
    ).toBe(false);
  });

  it("handles empty intervals with no pausedAt", () => {
    expect(isWithinPauseWindow(msOf("2026-03-10T12:00:00Z"), [])).toBe(false);
  });
});

// =============================================================================
// filterExcludedTransactions
// =============================================================================

describe("filterExcludedTransactions", () => {
  const intervals: readonly PauseInterval[] = [
    { from: msOf("2026-03-05T00:00:00Z"), to: msOf("2026-03-08T00:00:00Z") },
  ];

  const transactions: readonly FakeTx[] = [
    fakeTx("2026-03-01T12:00:00Z", 50),
    fakeTx("2026-03-06T12:00:00Z", 100), // within pause window
    fakeTx("2026-03-10T12:00:00Z", 75),
    fakeTx("2026-03-12T12:00:00Z", 200),
  ];

  it("filters out transactions within pause intervals", () => {
    const result = filterExcludedTransactions(transactions, intervals);
    expect(result).toHaveLength(3);
    expect(result.map((tx) => tx.amount)).toEqual([50, 75, 200]);
  });

  it("returns all transactions when no intervals and not paused", () => {
    const result = filterExcludedTransactions(transactions, []);
    expect(result).toHaveLength(4);
  });

  it("excludes transactions after pausedAt when currently paused", () => {
    const pausedAtMs = msOf("2026-03-11T00:00:00Z");
    const result = filterExcludedTransactions(
      transactions,
      intervals,
      pausedAtMs
    );
    // Excluded: March 6 (interval) + March 12 (after pausedAt)
    expect(result).toHaveLength(2);
    expect(result.map((tx) => tx.amount)).toEqual([50, 75]);
  });

  it("handles empty transaction array", () => {
    const result = filterExcludedTransactions([], intervals);
    expect(result).toHaveLength(0);
  });

  it("returns a new array instance (does not mutate input)", () => {
    const result = filterExcludedTransactions(transactions, []);
    expect(result).not.toBe(transactions);
  });
});

// =============================================================================
// buildPauseInterval
// =============================================================================

describe("buildPauseInterval", () => {
  it("creates a valid pause interval", () => {
    const from = msOf("2026-03-05T10:00:00Z");
    const to = msOf("2026-03-08T10:00:00Z");
    const interval = buildPauseInterval(from, to);
    expect(interval).toEqual({ from, to });
  });

  it("throws if from >= to", () => {
    const ts = msOf("2026-03-05T10:00:00Z");
    expect(() => buildPauseInterval(ts, ts)).toThrow("Invalid pause interval");
  });

  it("throws if from is after to", () => {
    const from = msOf("2026-03-10T10:00:00Z");
    const to = msOf("2026-03-05T10:00:00Z");
    expect(() => buildPauseInterval(from, to)).toThrow(
      "Invalid pause interval"
    );
  });
});

// =============================================================================
// parsePauseIntervals
// =============================================================================

describe("parsePauseIntervals", () => {
  it("returns empty array for null", () => {
    expect(parsePauseIntervals(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(parsePauseIntervals(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parsePauseIntervals("")).toEqual([]);
  });

  it("returns empty array for '[]'", () => {
    expect(parsePauseIntervals("[]")).toEqual([]);
  });

  it("parses valid JSON intervals", () => {
    const json = JSON.stringify([
      { from: 1000, to: 2000 },
      { from: 3000, to: 4000 },
    ]);
    const result = parsePauseIntervals(json);
    expect(result).toEqual([
      { from: 1000, to: 2000 },
      { from: 3000, to: 4000 },
    ]);
  });

  it("filters out malformed entries", () => {
    const json = JSON.stringify([
      { from: 1000, to: 2000 },
      { from: "bad", to: 3000 },
      { foo: "bar" },
      null,
    ]);
    const result = parsePauseIntervals(json);
    expect(result).toEqual([{ from: 1000, to: 2000 }]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parsePauseIntervals("not-json")).toEqual([]);
  });

  it("returns empty array for non-array JSON (object)", () => {
    expect(parsePauseIntervals('{"from":1,"to":2}')).toEqual([]);
  });
});
