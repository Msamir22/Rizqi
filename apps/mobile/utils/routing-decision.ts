/**
 * Pure routing-decision function for the post-sign-in onboarding gate.
 *
 * No I/O, no React, no side effects. Maps profile state + sync state
 * to the next screen the user should see. Unit-testable in isolation.
 *
 * @module routing-decision
 */

// =============================================================================
// Types
// =============================================================================

/** The sync state owned by SyncProvider, read by the gate. */
export type InitialSyncState = "in-progress" | "success" | "failed" | "timeout";

/** Possible outcomes of the routing decision. */
export type RoutingOutcome =
  | "loading"
  | "dashboard"
  | "language"
  | "slides"
  | "currency"
  | "cash-account-confirmation"
  | "retry";

/** Inputs to the routing decision. */
export interface RoutingInputs {
  readonly syncState: InitialSyncState;
  readonly onboardingCompleted: boolean;
  readonly hasPreferredLanguage: boolean;
  readonly slidesViewed: boolean;
  /** True when a cash account exists (equivalent to "user confirmed currency"). */
  readonly hasCashAccount: boolean;
}

/** Log payload emitted per routing-gate evaluation (FR-014). No PII. */
export interface RoutingDecisionLog {
  readonly outcome: RoutingOutcome;
  readonly inputs: {
    readonly onboardingCompleted: boolean;
    readonly hasPreferredLanguage: boolean;
    readonly slidesViewed: boolean;
    readonly hasCashAccount: boolean;
  };
  readonly syncState: InitialSyncState;
}

// =============================================================================
// Pure routing function
// =============================================================================

/**
 * Maps profile state + sync state to the next route.
 *
 * Priority order:
 * 1. Sync still in progress → loading
 * 2. Sync failed/timeout → retry
 * 3. Onboarding completed → dashboard
 * 4. Resume-point: first incomplete step (language → slides → currency → cash-account)
 */
export function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome {
  if (inputs.syncState === "in-progress") return "loading";
  if (inputs.syncState !== "success") return "retry";
  if (inputs.onboardingCompleted) return "dashboard";
  if (!inputs.hasPreferredLanguage) return "language";
  if (!inputs.slidesViewed) return "slides";
  if (!inputs.hasCashAccount) return "currency";
  return "cash-account-confirmation";
}

// =============================================================================
// Log helper
// =============================================================================

/**
 * Builds a structured, serializable log payload for the routing decision.
 * Contains no PII — no user ID, email, preference values, or IP.
 */
export function buildRoutingDecisionLog(
  inputs: RoutingInputs,
  outcome: RoutingOutcome
): RoutingDecisionLog {
  return {
    outcome,
    inputs: {
      onboardingCompleted: inputs.onboardingCompleted,
      hasPreferredLanguage: inputs.hasPreferredLanguage,
      slidesViewed: inputs.slidesViewed,
      hasCashAccount: inputs.hasCashAccount,
    },
    syncState: inputs.syncState,
  };
}
