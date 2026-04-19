/**
 * Contract: profile-service + onboarding-cursor-service
 *
 * This file is a planning-phase contract, NOT production code. It defines the
 * TypeScript signatures that `apps/mobile/services/profile-service.ts` and
 * `apps/mobile/services/onboarding-cursor-service.ts` must implement in Phase 2
 * (/speckit.implement). Once the real files exist, this contract remains as
 * reference documentation.
 *
 * All profile functions are plain async functions (NOT hooks) per Constitution IV.
 * Each one performs its write through `database.write()` (WatermelonDB); push
 * sync to Supabase is non-blocking and happens on the existing cadence.
 *
 * Per-step onboarding progress is a purely LOCAL concern (per FR-008) and
 * lives in AsyncStorage, keyed by userId. It never syncs.
 *
 * Branch: 024-skip-returning-onboarding
 * Last rewritten: 2026-04-18
 */

// --- Supporting types -------------------------------------------------------

/**
 * Postgres-enum-backed types come from `@rizqi/db` (generated into
 * `packages/db/src/types.ts` by `npm run db:migrate`). The real
 * implementation imports them directly; this contract references them by
 * name only.
 *
 * Expected type after migration 040 lands:
 *   import type { PreferredLanguageCode, CurrencyType } from "@rizqi/db";
 *
 * - `PreferredLanguageCode` — generated from the new Postgres enum
 *   `preferred_language_code` (`'en' | 'ar'`). Lowercase to match existing i18n.
 * - `CurrencyType` — already exists in `types.ts` as a 36-value string union
 *   (`"EGP" | "SAR" | ... | "BTC"`).
 *
 * Do NOT redefine these types in `profile-service.ts`; always import from
 * `@rizqi/db`. If a future caller needs a narrower shape, derive it with
 * `Extract<PreferredLanguageCode, "en">` rather than rebuilding the union.
 */
import type { PreferredLanguageCode, CurrencyType } from "@rizqi/db";
export type { PreferredLanguageCode, CurrencyType };

/** The sync state owned by `SyncProvider`, read by the gate. */
export type InitialSyncState = "in-progress" | "success" | "failed" | "timeout";

/** Outcomes returned by the pure routing function. Now binary for the router. */
export type RoutingOutcome = "loading" | "dashboard" | "onboarding" | "retry";

/**
 * The per-step onboarding progress cursor stored in AsyncStorage per user.
 * Persists the user's position in the flow between app launches.
 */
export type OnboardingStep =
  | "language"
  | "slides"
  | "currency"
  | "cash-account";

/** Inputs to the pure routing function. */
export interface RoutingInputs {
  readonly syncState: InitialSyncState;
  readonly onboardingCompleted: boolean;
}

// --- Pure routing decision (implemented in utils/routing-decision.ts) -------

/**
 * Pure function mapping sync state + the single DB flag to the next route.
 * No I/O, no React, no side effects — easy to unit test.
 *
 * The onboarding screen itself resolves which step to render by reading the
 * per-user AsyncStorage cursor (see `onboarding-cursor-service`).
 */
export declare function getRoutingDecision(
  inputs: RoutingInputs
): RoutingOutcome;

// --- Profile mutations (implemented in services/profile-service.ts) ---------

/**
 * Persist the language the user picked at the Language step AND apply it to
 * the in-memory i18n + RTL state. Resolves FR-007.
 *
 * Implementation:
 * 1. `database.write()` sets `profiles.preferred_language`.
 * 2. Awaits `changeLanguage(language)` so the UI updates immediately AND the
 *    RTL flag is reapplied (reload triggered by expo-updates on language flip).
 *
 * This is the SINGLE entry point for language changes (Principle IV — no
 * business logic in screens). Callers MUST NOT invoke `changeLanguage`
 * themselves; it is owned by the service.
 *
 * Throws if no profile row exists for the current user (should not happen
 * post-sync; caller logs and falls back to `retry`).
 */
export declare function setPreferredLanguage(
  language: PreferredLanguageCode
): Promise<void>;

/**
 * Set the user's preferred currency AND create the cash account in that
 * currency. Resolves FR-009 + FR-010.
 *
 * Implementation note: two SEQUENTIAL `database.write()` calls, NOT nested.
 * `ensureCashAccount` owns its own writer; wrapping it inside an outer
 * `database.write` triggers WatermelonDB's nested-write deadlock (visible
 * as "The writer you're trying to run ... can't be performed yet" warnings).
 *
 * Atomicity caveat: if step 1 succeeds and step 2 fails, the profile has a
 * new `preferred_currency` but no cash account. Acceptable because
 * (a) `ensureCashAccount` is idempotent, and (b) the AsyncStorage cursor
 * only advances to "cash-account" AFTER this call returns successfully, so
 * the next launch replays the currency step and retries creation.
 *
 * Returns the accountId of the cash account (existing or newly created).
 */
export declare function setPreferredCurrencyAndCreateCashAccount(
  currency: CurrencyType
): Promise<{ readonly accountId: string }>;

/**
 * Flip the `onboarding_completed` flag to true AND clear the per-user
 * AsyncStorage cursor. Called exactly once per user when the cash-account
 * confirmation is dismissed. Resolves FR-011.
 *
 * Takes no parameters — the userId is derived internally from the
 * authenticated session (via `getProfile()`), consistent with the
 * other mutation functions in this module.
 *
 * Sequence:
 * 1. `database.write()` sets `onboarding_completed = true`.
 * 2. Best-effort `clearOnboardingStep(userId)` (removes
 *    `onboarding:<userId>:step` from AsyncStorage). This is NOT atomic
 *    with step 1 — AsyncStorage and WatermelonDB are independent stores.
 *    A stale cursor is harmless because the router reads the DB flag,
 *    so step 2 errors are logged but not re-thrown.
 *
 * **Callers MUST `await` this call before navigating.** A rejected promise
 * means step 1 failed; continuing to the dashboard would leave the user
 * with `onboarding_completed = false` and they would re-enter the
 * onboarding flow on the next launch. `WalletCreationStep` intentionally
 * does NOT call this itself — it forwards the completion signal upward to
 * `app/onboarding.tsx`, which owns the await-then-navigate sequence.
 *
 * Idempotent — safe to call if already completed (no-op on the DB write;
 * the cursor clear still runs defensively).
 */
export declare function completeOnboarding(): Promise<void>;

// --- Per-user onboarding cursor (implemented in services/onboarding-cursor-service.ts)

/**
 * Return the user's current onboarding step cursor, or `null` if absent.
 * Absent means the user has not started onboarding yet — caller should start
 * at `"language"` (FR-004).
 */
export declare function readOnboardingStep(
  userId: string
): Promise<OnboardingStep | null>;

/**
 * Persist the user's next-unfinished step. Called on every forward transition
 * between onboarding phases (FR-008).
 */
export declare function writeOnboardingStep(
  userId: string,
  step: OnboardingStep
): Promise<void>;

/**
 * Remove the user's cursor. Called from `completeOnboarding` as part of the
 * end-of-flow clear (FR-011). Idempotent.
 */
export declare function clearOnboardingStep(userId: string): Promise<void>;

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
  readonly onboardingCompleted: boolean;
  readonly syncState: InitialSyncState;
}
