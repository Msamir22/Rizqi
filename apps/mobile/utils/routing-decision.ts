/**
 * Pure routing-decision function for the post-sign-in onboarding gate.
 *
 * No I/O, no React, no side effects. Maps sync state + the single DB flag
 * to the next screen the user should see. Unit-testable in isolation.
 *
 * Binary gate per spec (simplified 2026-04-18): the router only decides
 * dashboard-vs-onboarding. Per-step resume within the onboarding flow is
 * resolved inside `onboarding.tsx` via the AsyncStorage cursor
 * (`onboarding:<userId>:step`) — not here.
 *
 * @module routing-decision
 */

// =============================================================================
// Types
// =============================================================================

/** The sync state owned by SyncProvider, read by the gate. */
export type InitialSyncState = "in-progress" | "success" | "failed" | "timeout";

/** Possible outcomes of the routing decision. */
export type RoutingOutcome = "loading" | "dashboard" | "onboarding" | "retry";

/** Inputs to the routing decision. */
export interface RoutingInputs {
  readonly syncState: InitialSyncState;
  readonly onboardingCompleted: boolean;
}

/** Log payload emitted per routing-gate evaluation (FR-014). No PII. */
export interface RoutingDecisionLog {
  readonly outcome: RoutingOutcome;
  readonly onboardingCompleted: boolean;
  readonly syncState: InitialSyncState;
}

// =============================================================================
// Pure routing function
// =============================================================================

/**
 * Maps sync state + `profile.onboarding_completed` to the next route.
 *
 * Priority order:
 * 1. Sync still in progress → loading (splash / neutral backdrop)
 * 2. Already-onboarded user (flag = true) → dashboard regardless of sync
 *    state. Per Constitution I, WatermelonDB is the authoritative local
 *    source; an onboarded user with valid local state doesn't need the
 *    network to use the app. Background retries recover sync.
 * 3. Sync succeeded AND flag = false → onboarding (the onboarding screen
 *    resolves the exact phase from its per-user AsyncStorage cursor).
 * 4. Sync failed/timeout AND flag = false → retry. A not-yet-onboarded
 *    user has no local state yet, and without a successful initial pull
 *    we can't route them safely into the onboarding flow.
 */
export function getRoutingDecision(inputs: RoutingInputs): RoutingOutcome {
  if (inputs.syncState === "in-progress") return "loading";
  if (inputs.onboardingCompleted) return "dashboard";
  if (inputs.syncState !== "success") return "retry";
  return "onboarding";
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
    onboardingCompleted: inputs.onboardingCompleted,
    syncState: inputs.syncState,
  };
}
