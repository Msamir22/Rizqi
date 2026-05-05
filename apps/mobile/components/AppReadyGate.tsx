/**
 * AppReadyGate — composite splash-screen coordinator.
 *
 * Problem: the native Expo splash used to hide as soon as fonts + i18n were
 * ready. But our post-sign-in routing gate needs to wait for:
 *   - auth state resolved (isLoading === false), AND
 *   - initial pull-sync settled (success / failed / timeout — not in-progress), AND
 *   - the profile observation in WatermelonDB loaded (isLoading === false)
 * before it can decide whether to show the dashboard, the onboarding flow,
 * or the retry screen. Previously there was a visible "blank backdrop" flash
 * between splash hide and the first real screen render.
 *
 * This component holds the splash UNTIL all of those conditions are met,
 * so the transition is splash → real screen with no flicker.
 *
 * Behavior:
 *   - Renders nothing (no UI).
 *   - Called exactly once per app launch (guarded by a ref).
 *   - When the profile is available and has a `preferredLanguage` that
 *     differs from the in-memory i18n language, the language is applied
 *     BEFORE the splash hides so the first visible render is in the
 *     correct language.
 *
 * Side note: must be rendered BELOW AuthProvider, SyncProvider, and
 * DatabaseProvider so the hooks resolve correctly.
 *
 * @module AppReadyGate
 */

import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/providers/SyncProvider";
import { changeLanguage, type SupportedLanguage } from "@/i18n/changeLanguage";
import { setPreferredLanguage } from "@/services/profile-service";
import {
  clearPendingSignupLocale,
  readPendingSignupLocale,
  type PendingSignupLocale,
} from "@/services/intro-flag-service";
import i18n from "@/i18n";
import { logger } from "@/utils/logger";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";

const SIGNUP_PROFILE_CREATED_AT_TOLERANCE_MS = 60 * 1000;
const OAUTH_SIGNUP_MATCH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Whether the app has enough state to render its first real screen without
 * a flash. Derived from the three provider hooks.
 */
function computeReady(
  authIsLoading: boolean,
  isAuthenticated: boolean,
  initialSyncState: "in-progress" | "success" | "failed" | "timeout",
  profileIsLoading: boolean,
  pendingSignupLocaleIsLoading: boolean,
  profileOnboardingCompleted: boolean | undefined
): boolean {
  if (authIsLoading) return false;
  // Unauthenticated path: AuthGuard will redirect to /auth; no sync/profile gate.
  if (!isAuthenticated) return true;
  // Authenticated path: wait for sync to settle + profile observation ready.
  if (initialSyncState === "in-progress") return false;
  if (profileIsLoading) return false;
  if (profileOnboardingCompleted === false && pendingSignupLocaleIsLoading) {
    return false;
  }
  return true;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "en" || value === "ar";
}

function normalizeEmail(email: string | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function isMatchingNewSignupProfile(
  pendingSignupLocale: PendingSignupLocale | null,
  userId: string | undefined,
  userEmail: string | undefined,
  userCreatedAt: string | undefined,
  profileUserId: string | undefined,
  profileCreatedAt: Date | undefined,
  onboardingCompleted: boolean | undefined
): boolean {
  const normalizedUserEmail = normalizeEmail(userEmail);
  const normalizedUserId = userId?.trim();
  if (
    pendingSignupLocale === null ||
    !normalizedUserId ||
    onboardingCompleted !== false ||
    profileUserId !== normalizedUserId ||
    !(profileCreatedAt instanceof Date)
  ) {
    return false;
  }

  if (pendingSignupLocale.kind === "oauth") {
    return isCreatedDuringOAuthSignup(
      pendingSignupLocale.authStartedAt,
      userCreatedAt,
      profileCreatedAt
    );
  }

  if (
    normalizedUserEmail === null ||
    normalizedUserId !== pendingSignupLocale.userId ||
    normalizedUserEmail !== pendingSignupLocale.email
  ) {
    return false;
  }

  const profileTime = profileCreatedAt.getTime();
  const signupTime = Date.parse(pendingSignupLocale.userCreatedAt);
  return (
    !Number.isNaN(profileTime) &&
    !Number.isNaN(signupTime) &&
    Math.abs(profileTime - signupTime) <= SIGNUP_PROFILE_CREATED_AT_TOLERANCE_MS
  );
}

function isCreatedDuringOAuthSignup(
  authStartedAt: string,
  userCreatedAt: string | undefined,
  profileCreatedAt: Date
): boolean {
  const authStartedTime = Date.parse(authStartedAt);
  const userCreatedTime = Date.parse(userCreatedAt ?? "");
  const profileCreatedTime = profileCreatedAt.getTime();

  if (
    Number.isNaN(authStartedTime) ||
    Number.isNaN(userCreatedTime) ||
    Number.isNaN(profileCreatedTime)
  ) {
    return false;
  }

  const windowStart = authStartedTime - SIGNUP_PROFILE_CREATED_AT_TOLERANCE_MS;
  const windowEnd = authStartedTime + OAUTH_SIGNUP_MATCH_WINDOW_MS;

  return (
    userCreatedTime >= windowStart &&
    userCreatedTime <= windowEnd &&
    Math.abs(profileCreatedTime - userCreatedTime) <=
      SIGNUP_PROFILE_CREATED_AT_TOLERANCE_MS
  );
}

export function AppReadyGate(): null {
  const { user, isLoading: authIsLoading, isAuthenticated } = useAuth();
  const { initialSyncState } = useSync();
  const { profile, isLoading: profileIsLoading } = useProfile();
  const [pendingSignupLocale, setPendingSignupLocale] =
    useState<PendingSignupLocale | null>(null);
  const [pendingSignupLocaleIsLoading, setPendingSignupLocaleIsLoading] =
    useState(true);
  const hiddenRef = useRef(false);
  // Prevents concurrent hide attempts while an earlier one is in flight,
  // without permanently latching on a rejection (CR review on AppReadyGate.tsx:108).
  const hideInFlightRef = useRef(false);

  const ready = computeReady(
    authIsLoading,
    isAuthenticated,
    initialSyncState,
    profileIsLoading,
    pendingSignupLocaleIsLoading,
    profile?.onboardingCompleted
  );

  useEffect(() => {
    let cancelled = false;

    const loadPendingSignupLocale = async (): Promise<void> => {
      const marker = await readPendingSignupLocale();
      if (!cancelled) {
        setPendingSignupLocale(marker);
        setPendingSignupLocaleIsLoading(false);
      }
    };

    void loadPendingSignupLocale();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // `hiddenRef` is only set AFTER `SplashScreen.hideAsync()` succeeds, so
    // a rejected hide (rare but possible) doesn't permanently trap the user
    // behind the native splash. `hideInFlightRef` blocks concurrent attempts
    // while the async hide is pending.
    if (!ready || hiddenRef.current || hideInFlightRef.current) return;
    hideInFlightRef.current = true;

    const storedLanguage = isSupportedLanguage(profile?.preferredLanguage)
      ? profile.preferredLanguage
      : undefined;
    const shouldPromoteSignupLanguage = isMatchingNewSignupProfile(
      pendingSignupLocale,
      user?.id,
      user?.email,
      user?.created_at,
      profile?.userId,
      profile?.createdAt,
      profile?.onboardingCompleted
    );
    const signupLanguage = shouldPromoteSignupLanguage
      ? pendingSignupLocale?.language
      : undefined;
    const shouldClearSignupMarker =
      pendingSignupLocale !== null &&
      (pendingSignupLocale.kind === "oauth" ||
        user?.id === pendingSignupLocale.userId ||
        normalizeEmail(user?.email) === pendingSignupLocale.email);
    const targetLanguage = signupLanguage ?? storedLanguage;

    const finish = async (): Promise<void> => {
      if (signupLanguage && profile?.preferredLanguage !== signupLanguage) {
        try {
          await setPreferredLanguage(signupLanguage);
        } catch (error) {
          logger.warn(
            "appReadyGate.signupLanguagePersist.failed",
            error instanceof Error ? { message: error.message } : { error }
          );
        }
      }

      if (shouldClearSignupMarker) {
        await clearPendingSignupLocale();
        setPendingSignupLocale(null);
      }

      // Sync the UI language with the user's stored preference BEFORE we
      // hide the splash, so the first painted frame is in the right
      // language and not the device-locale fallback from initI18n.
      if (targetLanguage && targetLanguage !== i18n.language) {
        try {
          await changeLanguage(targetLanguage);
        } catch (error) {
          logger.warn(
            "appReadyGate.changeLanguage.failed",
            error instanceof Error ? { message: error.message } : { error }
          );
        }
      }

      try {
        await SplashScreen.hideAsync();
        hiddenRef.current = true;
      } catch (error) {
        logger.warn(
          "appReadyGate.splash.hideAsync.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
        // Leave hiddenRef=false so a subsequent render can retry the hide.
      } finally {
        hideInFlightRef.current = false;
      }
    };

    void finish();
  }, [
    ready,
    profile,
    user?.id,
    user?.email,
    user?.created_at,
    profile?.userId,
    profile?.preferredLanguage,
    profile?.createdAt,
    profile?.onboardingCompleted,
    pendingSignupLocale,
  ]);

  return null;
}
