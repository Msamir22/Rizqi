/**
 * Unit tests for buildRoutingDecisionLog helper.
 *
 * Validates the exact payload shape emitted by the routing gate (FR-014):
 * - Contains outcome, inputs, and syncState
 * - No PII fields (no userId, email, preference values)
 * - All values are serializable (JSON-safe)
 */

import type {
  RoutingInputs,
  RoutingDecisionLog,
} from "@/utils/routing-decision";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(overrides: Partial<RoutingInputs> = {}): RoutingInputs {
  return {
    syncState: "success",
    onboardingCompleted: false,
    hasPreferredLanguage: false,
    slidesViewed: false,
    hasCashAccount: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Import guard
// ---------------------------------------------------------------------------

describe("buildRoutingDecisionLog", () => {
  let buildRoutingDecisionLog: (
    inputs: RoutingInputs,
    outcome: string
  ) => RoutingDecisionLog;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/utils/routing-decision") as {
      buildRoutingDecisionLog: (
        inputs: RoutingInputs,
        outcome: string
      ) => RoutingDecisionLog;
    };
    buildRoutingDecisionLog = mod.buildRoutingDecisionLog;
  });

  it("produces a serializable object", () => {
    const log = buildRoutingDecisionLog(makeInputs(), "language");
    expect(() => JSON.stringify(log)).not.toThrow();
  });

  it("includes the outcome field", () => {
    const log = buildRoutingDecisionLog(makeInputs(), "dashboard");
    expect(log.outcome).toBe("dashboard");
  });

  it("includes the syncState field", () => {
    const log = buildRoutingDecisionLog(
      makeInputs({ syncState: "failed" }),
      "retry"
    );
    expect(log.syncState).toBe("failed");
  });

  it("includes all four input booleans", () => {
    const log = buildRoutingDecisionLog(
      makeInputs({
        onboardingCompleted: true,
        hasPreferredLanguage: true,
        slidesViewed: true,
        hasCashAccount: true,
      }),
      "dashboard"
    );
    expect(log.inputs.onboardingCompleted).toBe(true);
    expect(log.inputs.hasPreferredLanguage).toBe(true);
    expect(log.inputs.slidesViewed).toBe(true);
    expect(log.inputs.hasCashAccount).toBe(true);
  });

  it("contains no PII fields (no userId, email, or preference values)", () => {
    const log = buildRoutingDecisionLog(makeInputs(), "language");
    const serialized = JSON.stringify(log);

    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("preferredCurrency");
    expect(serialized).not.toContain("preferredLanguage");
  });

  it("has exactly the expected top-level keys", () => {
    const log = buildRoutingDecisionLog(makeInputs(), "loading");
    const keys = Object.keys(log).sort();
    expect(keys).toEqual(["inputs", "outcome", "syncState"]);
  });

  it("has exactly the expected input keys", () => {
    const log = buildRoutingDecisionLog(makeInputs(), "loading");
    const inputKeys = Object.keys(log.inputs).sort();
    expect(inputKeys).toEqual([
      "hasCashAccount",
      "hasPreferredLanguage",
      "onboardingCompleted",
      "slidesViewed",
    ]);
  });
});
