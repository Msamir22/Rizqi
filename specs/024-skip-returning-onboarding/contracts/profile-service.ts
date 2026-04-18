/**
 * Contract: profile-service
 *
 * This file is a planning-phase contract, NOT production code. It defines the
 * TypeScript signatures that `apps/mobile/services/profile-service.ts` must
 * implement in Phase 2 (/speckit.tasks → /speckit.implement). Once the real
 * file exists, this contract remains as reference documentation.
 *
 * All functions are plain async functions (NOT hooks) per Constitution IV.
 * Each one performs its write through `database.write()` (WatermelonDB); push
 * sync to Supabase is non-blocking and happens on the existing cadence.
 *
 * Branch: 024-skip-returning-onboarding
 * Date:   2026-04-18
 */

// --- Supporting types -------------------------------------------------------

/** Languages supported by the app today. Keep in sync with `apps/mobile/i18n`. */
export type SupportedLanguage = "en" | "ar";

/** Re-exported for convenience; the real type lives in `@rizqi/db`. */
export type CurrencyType = string; // placeholder; use `CurrencyType` from @rizqi/db

/** The sync state owned by `SyncProvider`, read by the gate. */
export type InitialSyncState = "in-progress" | "success" | "failed" | "timeout";

/** Outcomes returned by the pure routing function. */
export type RoutingOutcome =
  | "loading"
  | "dashboard"
  | "language"
  | "slides"
  | "currency"
  | "cash-account-confirmation"
  | "retry";

/** Inputs to the pure routing function. */
export interface RoutingInputs {
  readonly syncState: InitialSyncState;
  readonly onboardingCompleted: boolean;
  readonly hasPreferredLanguage: boolean;
  readonly slidesViewed: boolean;
  /** True when a cash account exists (equivalent to "user confirmed currency"). */
  readonly hasCashAccount: boolean;
}

// --- Pure routing decision (implemented in utils/routing-decision.ts) -------

/**
 * Pure function mapping profile state + sync state to the next route.
 * No I/O, no React, no side effects — easy to unit test.
 */
export declare function getRoutingDecision(
  inputs: RoutingInputs
): RoutingOutcome;

// --- Mutations (implemented in services/profile-service.ts) -----------------

/**
 * Persist the language the user picked at the Language step.
 * Resolves FR-007.
 *
 * Throws if no profile row exists for the current user (should not happen
 * post-sync; caller logs and falls back to `retry`).
 */
export declare function setPreferredLanguage(
  language: SupportedLanguage
): Promise<void>;

/**
 * Mark the onboarding slides as viewed/skipped.
 * Resolves FR-008.
 */
export declare function markSlidesViewed(): Promise<void>;

/**
 * Atomic operation: set the user's preferred currency AND create the cash
 * account in that currency. Resolves FR-009 + FR-010.
 *
 * - Wraps both writes in a single `database.write()` to avoid partial state.
 * - Idempotent: calling twice with the same currency is a no-op on the
 *   cash-account creation (`ensureCashAccount` is idempotent by design).
 *
 * Returns the accountId of the cash account (existing or newly created).
 */
export declare function setPreferredCurrencyAndCreateCashAccount(
  currency: CurrencyType
): Promise<{ readonly accountId: string }>;

/**
 * Flip the `onboarding_completed` flag to true. Called exactly once per user,
 * from the `WalletCreationStep`'s `onComplete` callback.
 * Resolves FR-011.
 *
 * Idempotent — safe to call if already true (no-op).
 */
export declare function completeOnboarding(): Promise<void>;

// --- Sync-provider extension (implemented in providers/SyncProvider.tsx) ----

/**
 * Minimal addition to `SyncContextValue` that the router consumes.
 * Existing fields (`isSyncing`, `isInitialSync`, etc.) remain.
 */
export interface SyncContextRoutingExtension {
  /**
   * Resolved after the initial pull-sync completes or times out. Starts as
   * "in-progress" for new sessions, then transitions once.
   *
   * Timeout = 20 seconds (Clarification Q2, FR-006).
   */
  readonly initialSyncState: InitialSyncState;

  /**
   * Re-trigger the initial sync. Called by the retry screen's Retry button.
   * Returns the new state when resolved.
   */
  readonly retryInitialSync: () => Promise<InitialSyncState>;
}

// --- Observability (implemented inline in the gate) -------------------------

/**
 * The shape of the log emitted on every routing-gate evaluation (FR-014).
 * Use `logger.info("onboarding.routing.decision", payload)`. No PII fields.
 */
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
