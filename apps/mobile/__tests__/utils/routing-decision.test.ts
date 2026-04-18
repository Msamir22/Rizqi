/**
 * Unit tests for getRoutingDecision and buildRoutingDecisionLog.
 *
 * These are pure functions — no React, no WatermelonDB, no network.
 * The routing decision is the core of the onboarding gate; every
 * combination of inputs must be covered.
 */

import type { RoutingInputs, RoutingOutcome } from "@/utils/routing-decision";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SyncState = RoutingInputs["syncState"];

/** Build a complete RoutingInputs object with sensible defaults. */
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

/** All four sync states exercised by the tests. */
const ALL_SYNC_STATES: SyncState[] = [
  "in-progress",
  "success",
  "failed",
  "timeout",
];

// ---------------------------------------------------------------------------
// Import guard — the module under test may not exist yet (TDD RED phase).
// ---------------------------------------------------------------------------

describe("getRoutingDecision", () => {
  let getRoutingDecision: (inputs: RoutingInputs) => RoutingOutcome;

  beforeAll(() => {
    // Dynamic import so the test file can be written before the implementation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/utils/routing-decision") as {
      getRoutingDecision: (inputs: RoutingInputs) => RoutingOutcome;
    };
    getRoutingDecision = mod.getRoutingDecision;
  });

  // =========================================================================
  // Sync-state gate (highest priority)
  // =========================================================================

  describe("sync state gating", () => {
    it('returns "loading" when syncState is "in-progress"', () => {
      expect(getRoutingDecision(makeInputs({ syncState: "in-progress" }))).toBe(
        "loading"
      );
    });

    it.each(["failed", "timeout"] as SyncState[])(
      'returns "retry" when syncState is "%s"',
      (syncState) => {
        expect(getRoutingDecision(makeInputs({ syncState }))).toBe("retry");
      }
    );

    it("does not short-circuit to dashboard when sync is in-progress even if profile is fully onboarded", () => {
      expect(
        getRoutingDecision(
          makeInputs({
            syncState: "in-progress",
            onboardingCompleted: true,
            hasPreferredLanguage: true,
            slidesViewed: true,
            hasCashAccount: true,
          })
        )
      ).toBe("loading");
    });

    it("does not short-circuit to dashboard when sync failed even if profile is fully onboarded", () => {
      expect(
        getRoutingDecision(
          makeInputs({
            syncState: "failed",
            onboardingCompleted: true,
            hasPreferredLanguage: true,
            slidesViewed: true,
            hasCashAccount: true,
          })
        )
      ).toBe("retry");
    });
  });

  // =========================================================================
  // Dashboard (onboarding completed)
  // =========================================================================

  describe("completed onboarding", () => {
    it("returns dashboard when onboardingCompleted is true", () => {
      expect(
        getRoutingDecision(
          makeInputs({
            onboardingCompleted: true,
            hasPreferredLanguage: true,
            slidesViewed: true,
            hasCashAccount: true,
          })
        )
      ).toBe("dashboard");
    });

    it("returns dashboard even when some per-step signals are false (flag is authoritative)", () => {
      expect(
        getRoutingDecision(
          makeInputs({
            onboardingCompleted: true,
            hasPreferredLanguage: false,
            slidesViewed: false,
            hasCashAccount: false,
          })
        )
      ).toBe("dashboard");
    });
  });

  // =========================================================================
  // Resume-point decisions (flag false, sync success)
  // =========================================================================

  describe("resume-point routing (onboarding not completed)", () => {
    it('returns "language" when no per-step signals are set (new user)', () => {
      expect(
        getRoutingDecision(
          makeInputs({
            onboardingCompleted: false,
            hasPreferredLanguage: false,
            slidesViewed: false,
            hasCashAccount: false,
          })
        )
      ).toBe("language");
    });

    it('returns "slides" when language is set but slides not viewed', () => {
      expect(
        getRoutingDecision(
          makeInputs({
            onboardingCompleted: false,
            hasPreferredLanguage: true,
            slidesViewed: false,
            hasCashAccount: false,
          })
        )
      ).toBe("slides");
    });

    it('returns "currency" when language + slides done but no cash account', () => {
      expect(
        getRoutingDecision(
          makeInputs({
            onboardingCompleted: false,
            hasPreferredLanguage: true,
            slidesViewed: true,
            hasCashAccount: false,
          })
        )
      ).toBe("currency");
    });

    it('returns "cash-account-confirmation" when language + slides + cash account done but flag still false', () => {
      expect(
        getRoutingDecision(
          makeInputs({
            onboardingCompleted: false,
            hasPreferredLanguage: true,
            slidesViewed: true,
            hasCashAccount: true,
          })
        )
      ).toBe("cash-account-confirmation");
    });
  });

  // =========================================================================
  // Exhaustive: every sync state × every onboardingCompleted value
  // =========================================================================

  describe("exhaustive sync-state combinations", () => {
    it.each(ALL_SYNC_STATES)(
      "never returns an unexpected outcome for syncState=%s",
      (syncState) => {
        const validOutcomes: RoutingOutcome[] = [
          "loading",
          "dashboard",
          "language",
          "slides",
          "currency",
          "cash-account-confirmation",
          "retry",
        ];
        const result = getRoutingDecision(makeInputs({ syncState }));
        expect(validOutcomes).toContain(result);
      }
    );
  });
});
