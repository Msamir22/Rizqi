/**
 * App Entry Point — Routing Gate
 *
 * Binary gate driven by profiles.onboarding_completed (from WatermelonDB,
 * post initial pull-sync). Per-step resume lives in onboarding.tsx via
 * AsyncStorage cursor; this gate only decides dashboard-vs-onboarding.
 *
 * Priority (see utils/routing-decision.ts for the authoritative rule):
 * 1. Auth or intro-seen still loading → splash (return null).
 * 2. Unauthenticated → pitch (if !intro-seen) or auth.
 * 3. Sync in-progress OR profile-observation hasn't emitted yet →
 *    BootLoadingView (sits beneath the InitialSyncOverlay's fade-in so
 *    the screen is never blank during the mid-session auth → /index
 *    transition triggered by router.replace("/")).
 * 4. Authenticated but `profile === null` — an authenticated user MUST
 *    have a profile row, so this is either an observation race or a
 *    data inconsistency:
 *    a. Inside the grace window AND sync is settling → BootLoadingView.
 *    b. Sync FAILED / TIMED OUT → RetrySyncScreen.
 *    c. Sync SUCCEEDED but grace elapsed with profile still null →
 *       RetrySyncScreen (data inconsistency, e.g. stale auth.users
 *       whose profile row was wiped — user-report 2026-04-27).
 *    Never falls through to /onboarding — that would skip an already-
 *    onboarded returning user past their data (user-report 2026-04-24).
 * 5. onboarding_completed = true → dashboard (regardless of sync state —
 *    offline-first for returning users).
 * 6. Sync succeeded AND flag = false → onboarding (Currency step).
 * 7. Sync failed/timeout AND flag = false → retry screen.
 *
 * @module Index
 */

import { database } from "@monyvi/db";
import { RetrySyncScreen } from "@/components/ui/RetrySyncScreen";
import { useProfile } from "@/hooks/useProfile";
import { useIntroSeen } from "@/hooks/useIntroSeen";
import { useSync } from "@/providers/SyncProvider";
import { useAuth } from "@/context/AuthContext";
import { performLogout } from "@/services/logout-service";
import {
  buildRoutingDecisionLog,
  getRoutingDecision,
} from "@/utils/routing-decision";
import { logger } from "@/utils/logger";
import { palette } from "@/constants/colors";
import { Redirect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * How long to wait, after the initial sync has settled, for the WatermelonDB
 * profile observation to emit a non-null value. The observation race
 * documented in commit 56b2e73 resolves within 1-2 React ticks; this grace
 * is deliberately generous to absorb slow Android cold-start GC pauses.
 *
 * If profile is still `null` after this elapses with sync settled, we
 * surface RetrySyncScreen so the user has an escape hatch (sign out)
 * instead of being trapped on a blank screen — covers the "auth user
 * exists but no profile row" failure mode (user-report 2026-04-27,
 * caused by a stale auth.users row whose profile was wiped).
 */
const PROFILE_OBSERVATION_GRACE_MS = 4_000;

export default function Index(): React.ReactNode {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isSeen: introSeen, isLoading: isIntroLoading } = useIntroSeen();

  if (isAuthLoading || isIntroLoading) {
    return null;
  }

  if (!isAuthenticated) {
    if (!introSeen) return <Redirect href="/pitch" />;
    return <Redirect href="/auth" />;
  }

  return <AuthenticatedIndex />;
}

function AuthenticatedIndex(): React.ReactNode {
  const { initialSyncState, retryInitialSync } = useSync();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const hasLoggedRef = useRef(false);
  const [hasProfileGraceElapsed, setHasProfileGraceElapsed] = useState(false);

  const onboardingCompleted = profile?.onboardingCompleted ?? false;

  // Bounded escape hatch for the `profile === null` post-sync race-guard.
  // Once sync has settled (success / failed / timeout) AND the profile
  // observation is still emitting null, start a timer. If the timer
  // elapses before a profile arrives, flip `hasProfileGraceElapsed` so
  // the gate can route to RetrySyncScreen rather than render null forever
  // (see PROFILE_OBSERVATION_GRACE_MS comment for why this is needed).
  // Resets to false the moment a profile arrives or sync re-enters
  // in-progress, so a subsequent successful sync starts with a fresh
  // grace window.
  useEffect(() => {
    const syncSettled = initialSyncState !== "in-progress";
    const isProfileMissing = !isProfileLoading && profile === null;

    if (!syncSettled || !isProfileMissing) {
      if (hasProfileGraceElapsed) setHasProfileGraceElapsed(false);
      return;
    }

    if (hasProfileGraceElapsed) return;

    const timer = setTimeout(() => {
      setHasProfileGraceElapsed(true);
    }, PROFILE_OBSERVATION_GRACE_MS);

    return () => clearTimeout(timer);
  }, [initialSyncState, isProfileLoading, profile, hasProfileGraceElapsed]);

  const routingInputs = {
    syncState: initialSyncState,
    onboardingCompleted,
  };
  const outcome = getRoutingDecision(routingInputs);

  // FR-014: one structured log per gate evaluation (no PII).
  //
  // Fires once the sync AND profile observation have both settled — logging
  // before `isProfileLoading` resolves would emit `onboardingCompleted:false`
  // for an already-onboarded returning user and poison the telemetry
  // (review Finding #5). The payload is rebuilt inside the effect from the
  // same primitive inputs that appear in the dep array, so there is no
  // need to suppress exhaustive-deps; `hasLoggedRef` guarantees the log
  // fires at most once per session.
  useEffect(() => {
    const syncSettled = initialSyncState !== "in-progress";
    const profileSettled = !isProfileLoading;
    if (hasLoggedRef.current || !syncSettled || !profileSettled) return;

    hasLoggedRef.current = true;
    const inputs = { syncState: initialSyncState, onboardingCompleted };
    logger.info("onboarding.routing.decision", {
      ...buildRoutingDecisionLog(inputs, getRoutingDecision(inputs)),
    });
  }, [initialSyncState, isProfileLoading, onboardingCompleted]);

  /** Sign-out handler for RetrySyncScreen — uses existing logout service. */
  const handleSignOut = useCallback((): void => {
    performLogout(database).catch((error: unknown) => {
      logger.warn(
        "onboarding.retryScreen.signOut.failed",
        error instanceof Error ? { message: error.message } : { error }
      );
    });
  }, []);

  /** Retry handler for RetrySyncScreen — re-enters the initial sync. */
  const handleRetry = useCallback((): void => {
    retryInitialSync().catch((error: unknown) => {
      logger.warn(
        "onboarding.retryScreen.retryInitialSync.failed",
        error instanceof Error ? { message: error.message } : { error }
      );
    });
  }, [retryInitialSync]);

  // Loading states render nothing — the native Expo splash screen is held
  // by <AppReadyGate /> (see _layout.tsx) until sync + profile resolve, so
  // users never see a blank/starry backdrop between splash and the real
  // screen.
  // Mid-session auth → /index transition: when /auth calls router.replace("/")
  // after sign-up, the InitialSyncOverlay's 300ms fade-in is animating over
  // whatever this gate renders. Returning `null` here exposes a blank screen
  // for the duration of the fade. Render BootLoadingView so the overlay
  // fades in on top of an identical-looking loader (no visual flash).
  // On cold launch this is harmless — AppReadyGate keeps the native splash
  // covering the screen until sync + profile both settle.
  if (initialSyncState === "in-progress" || isProfileLoading) {
    return <BootLoadingView />;
  }

  // Authenticated user but `useProfile` returned `null`. This is a
  // race condition — `useProfile.isLoading` flips false on the FIRST
  // observation emission, even when that emission is an empty array
  // (no profile rows present locally yet). It can happen when the
  // SyncProvider has marked `initialSyncState = "success"` BEFORE
  // WatermelonDB's observation pipeline has emitted the freshly-pulled
  // row (user-report 2026-04-24: already-onboarded users were getting
  // routed to the Currency step on cold launch despite
  // `onboarding_completed = true` in the DB).
  //
  // Behavior:
  //   - Sync FAILED / TIMED OUT → RetrySyncScreen (network / server
  //     issue, user might have cloud data we couldn't pull).
  //   - Inside the grace window with sync settling → BootLoadingView
  //     (loading indicator, never blank). AppReadyGate has already
  //     released the native splash so a `null` here would surface a
  //     blank screen.
  //   - Grace elapsed with sync=success but profile still null →
  //     RetrySyncScreen. An authenticated user MUST have a profile
  //     row (the DB trigger creates one on every real INSERT into
  //     auth.users); arriving here means data inconsistency, not a
  //     brand-new user. NEVER fall through to /onboarding — that
  //     would skip an already-onboarded returning user past their
  //     data on the next successful sync (user-report 2026-04-24).
  if (profile === null) {
    if (
      initialSyncState === "failed" ||
      initialSyncState === "timeout" ||
      // TODO: This branch (sync=success but profile still null after the
      // grace window) is a data-inconsistency state — sync technically
      // succeeded, so "Couldn't load your account" + Retry isn't quite
      // right. Replace with a dedicated ContactSupportScreen when one
      // exists. RetrySyncScreen is a temporary stand-in: it gives the
      // user a sign-out path and isn't actively misleading.
      hasProfileGraceElapsed
    ) {
      return (
        <RetrySyncScreen onRetry={handleRetry} onSignOut={handleSignOut} />
      );
    }
    return <BootLoadingView />;
  }

  switch (outcome) {
    case "dashboard":
      return <Redirect href="/(tabs)" />;
    case "retry":
      return (
        <RetrySyncScreen onRetry={handleRetry} onSignOut={handleSignOut} />
      );
    case "loading":
      return null;
    default:
      // "onboarding" — resume handled by onboarding.tsx via AsyncStorage cursor
      return <Redirect href="/onboarding" />;
  }
}

/**
 * Themed loading view shown during the post-sync profile-observation grace
 * window. Reuses the same copy as the InitialSyncOverlay (`syncing_your_data`)
 * so the user perceives a continuous "still syncing" state rather than a new
 * loading screen popping up after the overlay disappears.
 */
function BootLoadingView(): React.ReactElement {
  const { t } = useTranslation("common");
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background dark:bg-background-dark px-6">
      <ActivityIndicator size="large" color={palette.nileGreen[500]} />
      <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark text-center">
        {t("syncing_your_data")}
      </Text>
      <Text className="text-sm text-text-secondary dark:text-text-secondary-dark text-center">
        {t("syncing_subtitle")}
      </Text>
    </View>
  );
}
