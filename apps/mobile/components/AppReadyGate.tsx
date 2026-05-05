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
 * Side note: the authenticated branch must be rendered below SyncProvider and
 * DatabaseProvider so the hooks resolve correctly.
 *
 * @module AppReadyGate
 */

import { useAuth } from "@/context/AuthContext";
import { useLogout } from "@/context/LogoutContext";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/providers/SyncProvider";
import { changeLanguage, type SupportedLanguage } from "@/i18n/changeLanguage";
import i18n from "@/i18n";
import { logger } from "@/utils/logger";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, type JSX } from "react";

/**
 * Whether the app has enough state to render its first real screen without
 * a flash. Derived from the three provider hooks.
 */
function computeAuthenticatedReady(
  initialSyncState: "in-progress" | "success" | "failed" | "timeout",
  profileIsLoading: boolean
): boolean {
  return initialSyncState !== "in-progress" && !profileIsLoading;
}

interface SplashReadyGateProps {
  readonly preferredLanguage?: string;
  readonly ready: boolean;
}

export function AppReadyGate(): JSX.Element | null {
  const { isLoading: authIsLoading, isAuthenticated } = useAuth();
  const { isLoggingOut } = useLogout();

  if (isLoggingOut || !isAuthenticated) {
    return <SplashReadyGate ready={!authIsLoading} />;
  }

  return <AuthenticatedAppReadyGate />;
}

function AuthenticatedAppReadyGate(): JSX.Element | null {
  const { initialSyncState } = useSync();
  const { profile, isLoading: profileIsLoading } = useProfile();
  const ready = computeAuthenticatedReady(initialSyncState, profileIsLoading);

  return (
    <SplashReadyGate
      ready={ready}
      preferredLanguage={profile?.preferredLanguage}
    />
  );
}

function SplashReadyGate({
  preferredLanguage,
  ready,
}: SplashReadyGateProps): null {
  const hiddenRef = useRef(false);
  // Prevents concurrent hide attempts while an earlier one is in flight,
  // without permanently latching on a rejection (CR review on AppReadyGate.tsx:108).
  const hideInFlightRef = useRef(false);

  useEffect(() => {
    // `hiddenRef` is only set AFTER `SplashScreen.hideAsync()` succeeds, so
    // a rejected hide (rare but possible) doesn't permanently trap the user
    // behind the native splash. `hideInFlightRef` blocks concurrent attempts
    // while the async hide is pending.
    if (!ready || hiddenRef.current || hideInFlightRef.current) return;
    hideInFlightRef.current = true;

    const storedLanguage = preferredLanguage as SupportedLanguage | undefined;

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
  }, [ready, preferredLanguage]);

  return null;
}
