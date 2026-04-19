/**
 * Profile Service
 *
 * Plain async functions for onboarding-related profile mutations.
 * Each write goes through WatermelonDB's `database.write()`; push-sync
 * to Supabase is non-blocking and happens on the existing cadence.
 *
 * Architecture: Service Layer (Constitution IV) — no React, no hooks.
 *
 * @module profile-service
 */

import {
  Profile,
  type CurrencyType,
  type PreferredLanguageCode,
  database,
} from "@rizqi/db";
import { changeLanguage } from "@/i18n/changeLanguage";
import { ensureCashAccount } from "@/services/account-service";
import { clearOnboardingStep } from "@/services/onboarding-cursor-service";
import { logger } from "@/utils/logger";
import { t } from "i18next";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns the first non-deleted profile row. Throws if none exists —
 * a profile should always be present after the initial pull-sync.
 */
async function getProfile(): Promise<Profile> {
  const collection = database.get<Profile>("profiles");
  const profiles = await collection.query().fetch();
  const profile = profiles.find((p) => !p.deleted);
  if (!profile) {
    throw new Error(
      "No profile row found. Profile should exist after initial sync."
    );
  }
  return profile;
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Persist the user's chosen language to the profile row AND apply it to the
 * in-memory i18n + RTL state so the UI updates immediately.
 *
 * Service owns both sides of the write per Constitution IV (no business
 * logic in screens). Callers (onboarding, Settings) should NOT call
 * `changeLanguage` themselves — this function is the single entry point.
 *
 * Resolves FR-007.
 */
export async function setPreferredLanguage(
  language: PreferredLanguageCode
): Promise<void> {
  const profile = await getProfile();
  await database.write(async () => {
    await profile.update((p) => {
      p.preferredLanguage = language;
    });
  });
  await changeLanguage(language);
}

/**
 * Set the user's preferred currency AND create the cash account in that
 * currency. Resolves FR-009 + FR-010.
 *
 * Two sequential `database.write()` calls (NOT nested). WatermelonDB
 * serializes writers via a global queue; wrapping `ensureCashAccount` inside
 * an outer `database.write` caused a nested-write deadlock with a warning of
 * the form "The writer you're trying to run ... can't be performed yet,
 * because there are N other readers/writers in the queue." — observed at the
 * currency step.
 *
 * Atomicity caveat: if step 1 succeeds and step 2 fails, the profile has a
 * new `preferred_currency` but no cash account. This is acceptable because
 * (a) `ensureCashAccount` is idempotent, and (b) the AsyncStorage cursor is
 * still at "currency" until the caller writes "cash-account" — so on the next
 * launch `onboarding.tsx` will replay the currency step and `ensureCashAccount`
 * will succeed on the second attempt.
 */
export async function setPreferredCurrencyAndCreateCashAccount(
  currency: CurrencyType
): Promise<{ readonly accountId: string }> {
  const profile = await getProfile();
  const userId = profile.userId;

  // Step 1 — write the preferred currency to the profile.
  await database.write(async () => {
    await profile.update((p) => {
      p.preferredCurrency = currency;
    });
  });

  // Step 2 — create (or look up) the cash account. ensureCashAccount owns
  // its own database.write internally.
  const result = await ensureCashAccount(userId, currency);
  if (!result.accountId) {
    throw new Error(t("cash_account_creation_failed"));
  }

  return { accountId: result.accountId };
}

/**
 * Flip the `onboarding_completed` flag to true AND clear the per-user
 * AsyncStorage cursor. Called exactly once per user when the cash-account
 * confirmation step is dismissed. Resolves FR-011.
 *
 * Lifecycle per contract:
 * 1. `database.write()` sets `onboarding_completed = true`.
 * 2. `clearOnboardingStep(userId)` removes `onboarding:<userId>:step`.
 *
 * If step 2 fails, the error is logged but NOT re-thrown. Step 1 is the
 * contract-critical write; the router reads the DB flag, so a stale cursor
 * is harmless.
 *
 * CALLERS MUST await this call before navigating. A rejected promise means
 * the DB write failed; continuing to the dashboard would leave the user
 * with `onboarding_completed = false` and they would re-enter the flow
 * on next launch. See the contract file in `specs/.../contracts/`.
 *
 * Idempotent — safe to call if already completed (no DB write; cursor
 * clear still runs defensively).
 */
export async function completeOnboarding(): Promise<void> {
  const profile = await getProfile();
  const userId = profile.userId;

  if (!profile.onboardingCompleted) {
    await database.write(async () => {
      await profile.update((p) => {
        p.onboardingCompleted = true;
      });
    });
  }

  try {
    await clearOnboardingStep(userId);
  } catch (error) {
    logger.warn(
      "onboarding.completeOnboarding.clearCursor.failed",
      error instanceof Error ? { message: error.message } : { error }
    );
  }
}
