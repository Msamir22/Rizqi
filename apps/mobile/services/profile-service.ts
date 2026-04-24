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
  Account,
  Profile,
  type CurrencyType,
  type OnboardingFlags,
  type PreferredLanguageCode,
  database,
} from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";
import { SUPPORTED_CURRENCIES } from "@rizqi/logic";
import {
  changeLanguage,
  getCurrentLanguage,
  type SupportedLanguage,
} from "@/i18n/changeLanguage";
import {
  createCashAccountWithinWriter,
  ensureCashAccount,
} from "@/services/account-service";
import { clearOnboardingStep } from "@/services/onboarding-cursor-service";
import { getCurrentUserId } from "@/services/supabase";
import { logger } from "@/utils/logger";
import { t } from "i18next";

/**
 * Runtime-visible set of supported currency codes. Used to guard the
 * entry to `confirmCurrencyAndOnboard` against an invalid value reaching
 * the atomic write — compile-time `CurrencyType` is insufficient for any
 * path that originates outside the app (deep-links, future API endpoints).
 */
const SUPPORTED_CURRENCY_CODES: ReadonlySet<CurrencyType> = new Set(
  SUPPORTED_CURRENCIES.map((c) => c.code)
);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns the authenticated user's profile row.
 *
 * Scoped by `user_id` to match the pattern used by other services (account,
 * budget, metal-holding, etc.) — even though the local DB typically contains
 * only one profile at a time (logout wipes it), querying by userId is the
 * correct long-term pattern and protects against future multi-account /
 * account-switching features from picking up the wrong row.
 *
 * Throws if either the auth session is missing or the profile row is absent
 * (both should not happen after a successful initial pull-sync).
 */
async function getProfile(): Promise<Profile> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error(
      "Cannot load profile: no authenticated user in the session."
    );
  }

  const collection = database.get<Profile>("profiles");
  const profiles = await collection
    .query(Q.where("user_id", userId), Q.where("deleted", Q.notEq(true)))
    .fetch();
  const profile = profiles[0];
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
 * @deprecated Use `confirmCurrencyAndOnboard` instead — it performs all
 *   mutations in a single atomic `database.write()`. This function runs two
 *   separate writes which can leave partial state. See feature 026 spec.
 *
 * One `database.write()` lives in this file (the profile update on line 115).
 * `ensureCashAccount` owns its own writer internally, so the two operations
 * run as two sequential (not nested) writes from WatermelonDB's perspective.
 * Wrapping both in a single outer `database.write` caused a nested-write
 * deadlock with a warning of the form "The writer you're trying to run ...
 * can't be performed yet, because there are N other readers/writers in the
 * queue." — observed at the currency step.
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
 * AsyncStorage cursor.
 *
 * @deprecated No longer called directly. `confirmCurrencyAndOnboard` now
 *   sets `onboardingCompleted = true` atomically alongside currency, language,
 *   and cash-account creation. This function is retained only until the
 *   remaining callers are migrated. See feature 026 spec.
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

/**
 * Flip the setup-guide-dismissed flag on the user's profile.
 *
 * Service-layer wrapper so hooks and components never `database.write()`
 * directly. The write is idempotent — calling this for an already-dismissed
 * profile is a no-op at the DB level (observer re-emit only).
 */
export async function setSetupGuideCompleted(
  completed: boolean
): Promise<void> {
  const profile = await getProfile();
  if (profile.setupGuideCompleted === completed) {
    return;
  }
  await database.write(async () => {
    await profile.update((p) => {
      p.setupGuideCompleted = completed;
    });
  });
}

/**
 * Set a single onboarding flag on the user's profile.
 *
 * Atomicity: reads `profile.onboardingFlags` INSIDE the writer. Reading
 * outside the writer (and relying on a captured snapshot) is a TOCTOU
 * hazard — two concurrent callers starting from the same snapshot would
 * both merge against stale JSON, and the second commit would silently
 * drop the first caller's key.
 *
 * WatermelonDB serializes `database.write()` calls, so the `onboardingFlags`
 * getter inside the writer is guaranteed to reflect any prior committed
 * mutation on this row.
 */
export async function setOnboardingFlag<K extends keyof OnboardingFlags>(
  flagKey: K,
  value: NonNullable<OnboardingFlags[K]>
): Promise<void> {
  const profile = await getProfile();
  await database.write(async () => {
    const current = profile.onboardingFlags;
    const next = { ...current, [flagKey]: value };
    await profile.update((p) => {
      p.onboardingFlagsRaw = JSON.stringify(next);
    });
  });
}

/**
 * Single atomic write that confirms the user's currency choice and completes
 * onboarding. All four mutations happen inside one `database.write()`:
 *
 * 1. Cash account created (or found) via `createCashAccountWithinWriter`
 * 2. `preferredCurrency` set on profile
 * 3. `preferredLanguage` overwritten with the current runtime language
 * 4. `onboardingCompleted` flipped to `true`
 *
 * After the transaction commits, `options.onTransactionCommitted?.()` fires
 * (e.g., to trigger first-run tooltip state). The onboarding cursor is cleared
 * defensively — failure is logged but not re-thrown.
 *
 * Does NOT clear `@rizqi/intro-locale-override` (FR-030).
 *
 * Resolves FR-009, FR-010, FR-011, FR-013, FR-031.
 */
export async function confirmCurrencyAndOnboard(
  currency: CurrencyType,
  options?: {
    readonly onTransactionCommitted?: () => void;
  }
): Promise<{ readonly accountId: string }> {
  // Runtime boundary guard — `CurrencyType` is compile-time only, and any
  // future caller (deep-link, API endpoint, plugin) could feed an
  // unsupported value. Rejecting before the write prevents a partial
  // local-DB state that Supabase's enum constraint would later reject.
  if (!SUPPORTED_CURRENCY_CODES.has(currency)) {
    throw new Error(
      `confirmCurrencyAndOnboard: unsupported currency code "${String(
        currency
      )}"`
    );
  }

  const profile = await getProfile();
  const userId = profile.userId;
  const language: SupportedLanguage = getCurrentLanguage();

  let accountId = "";

  await database.write(async () => {
    // 1. Cash account
    const accountsCollection = database.get<Account>("accounts");
    const result = await createCashAccountWithinWriter(
      userId,
      currency,
      accountsCollection
    );
    accountId = result.accountId;

    // 2–4. Profile mutations in one batch
    await profile.update((p) => {
      p.preferredCurrency = currency;
      p.preferredLanguage = language;
      p.onboardingCompleted = true;
    });
  });

  // Post-commit callback — the DB state is already durably committed by the
  // time we get here, so a throwing callback (e.g. an unrelated setState
  // blowing up downstream) MUST NOT surface as a `confirmCurrencyAndOnboard`
  // rejection. The caller would then see an error toast and believe the
  // write failed, tempting them to retry an already-successful operation.
  try {
    options?.onTransactionCommitted?.();
  } catch (error: unknown) {
    logger.warn(
      "onboarding.confirmCurrencyAndOnboard.onTransactionCommitted.failed",
      error instanceof Error ? { message: error.message } : { error }
    );
  }

  // Defensive cursor clear — non-critical
  try {
    await clearOnboardingStep(userId);
  } catch (error: unknown) {
    logger.warn(
      "onboarding.confirmCurrencyAndOnboard.clearCursor.failed",
      error instanceof Error ? { message: error.message } : { error }
    );
  }

  return { accountId };
}
