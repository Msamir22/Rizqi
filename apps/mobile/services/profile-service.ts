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

import { Profile, type CurrencyType, database } from "@rizqi/db";
import { ensureCashAccount } from "@/services/account-service";
import { t } from "i18next";

// =============================================================================
// Types
// =============================================================================

/** Languages supported by the app today. */
export type SupportedLanguage = "en" | "ar";

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
 * Persist the user's chosen language to the profile row.
 * Resolves FR-007.
 */
export async function setPreferredLanguage(
  language: SupportedLanguage
): Promise<void> {
  const profile = await getProfile();
  await database.write(async () => {
    await profile.update((p) => {
      p.preferredLanguage = language;
    });
  });
}

/**
 * Mark the onboarding slides as viewed/skipped.
 * Resolves FR-008.
 */
export async function markSlidesViewed(): Promise<void> {
  const profile = await getProfile();
  await database.write(async () => {
    await profile.update((p) => {
      p.slidesViewed = true;
    });
  });
}

/**
 * Atomic operation: set the user's preferred currency AND create the cash
 * account in that currency. Resolves FR-009 + FR-010.
 *
 * Both writes are wrapped in a single `database.write()` to prevent partial
 * state. The cash-account creation is delegated to `ensureCashAccount` which
 * is idempotent.
 */
export async function setPreferredCurrencyAndCreateCashAccount(
  currency: CurrencyType
): Promise<{ readonly accountId: string }> {
  const profile = await getProfile();
  const userId = profile.userId;

  let accountId: string | null = null;

  await database.write(async () => {
    await profile.update((p) => {
      p.preferredCurrency = currency;
    });

    const result = await ensureCashAccount(userId, currency);
    accountId = result.accountId;
  });

  if (!accountId) {
    throw new Error(t("cash_account_creation_failed"));
  }

  return { accountId };
}

/**
 * Flip the `onboarding_completed` flag to true. Called exactly once per user,
 * from the WalletCreationStep's onComplete callback.
 * Resolves FR-011.
 *
 * Idempotent — safe to call if already true.
 */
export async function completeOnboarding(): Promise<void> {
  const profile = await getProfile();
  if (profile.onboardingCompleted) return;

  await database.write(async () => {
    await profile.update((p) => {
      p.onboardingCompleted = true;
    });
  });
}
