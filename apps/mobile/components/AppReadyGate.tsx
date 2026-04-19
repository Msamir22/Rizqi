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
import i18n from "@/i18n";
import { logger } from "@/utils/logger";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";

/**
 * Whether the app has enough state to render its first real screen without
 * a flash. Derived from the three provider hooks.
 */
function computeReady(
  authIsLoading: boolean,
  isAuthenticated: boolean,
  initialSyncState: "in-progress" | "success" | "failed" | "timeout",
  profileIsLoading: boolean
): boolean {
  if (authIsLoading) return false;
  // Unauthenticated path: AuthGuard will redirect to /auth; no sync/profile gate.
  if (!isAuthenticated) return true;
  // Authenticated path: wait for sync to settle + profile observation ready.
  if (initialSyncState === "in-progress") return false;
  if (profileIsLoading) return false;
  return true;
}

export function AppReadyGate(): null {
  const { isLoading: authIsLoading, isAuthenticated } = useAuth();
  const { initialSyncState } = useSync();
  const { profile, isLoading: profileIsLoading } = useProfile();
  const hiddenRef = useRef(false);

  const ready = computeReady(
    authIsLoading,
    isAuthenticated,
    initialSyncState,
    profileIsLoading
  );

  useEffect(() => {
    if (!ready || hiddenRef.current) return;
    hiddenRef.current = true;

    const storedLanguage = profile?.preferredLanguage as
      | SupportedLanguage
      | undefined;

    const finish = async (): Promise<void> => {
      // Sync the UI language with the user's stored preference BEFORE we
      // hide the splash, so the first painted frame is in the right
      // language and not the device-locale fallback from initI18n.
      if (
        storedLanguage &&
        (storedLanguage === "en" || storedLanguage === "ar") &&
        storedLanguage !== i18n.language
      ) {
        try {
          await changeLanguage(storedLanguage);
        } catch (error) {
          logger.warn(
            "appReadyGate.changeLanguage.failed",
            error instanceof Error ? { message: error.message } : { error }
          );
        }
      }

      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        logger.warn(
          "appReadyGate.splash.hideAsync.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
      }
    };

    void finish();
  }, [ready, profile?.preferredLanguage]);

  return null;
}
