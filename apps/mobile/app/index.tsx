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
 * 3. Sync in-progress OR profile-observation hasn't emitted yet → splash.
 * 4. Authenticated but `profile === null` (race between sync "success" and
 *    the observation actually emitting the pulled row) → splash, OR retry
 *    screen if sync genuinely failed / timed out. NEVER falls through to
 *    onboarding — that would skip an already-onboarded returning user
 *    past their data (user-report 2026-04-24).
 * 5. onboarding_completed = true → dashboard (regardless of sync state —
 *    offline-first for returning users).
 * 6. Sync succeeded AND flag = false → onboarding (Currency step).
 * 7. Sync failed/timeout AND flag = false → retry screen.
 *
 * @module Index
 */

import { database } from "@rizqi/db";
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
import { Redirect } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";

export default function Index(): React.ReactNode {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isSeen: introSeen, isLoading: isIntroLoading } = useIntroSeen();
  const { initialSyncState, retryInitialSync } = useSync();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const hasLoggedRef = useRef(false);

  const onboardingCompleted = profile?.onboardingCompleted ?? false;

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
  if (isAuthLoading || isIntroLoading) {
    return null;
  }

  // Pre-auth routing: first-time visitors see pitch, returning visitors go
  // straight to auth. introSeen is device-scoped (FR-029/FR-030).
  if (!isAuthenticated) {
    if (!introSeen) return <Redirect href="/pitch" />;
    return <Redirect href="/auth" />;
  }

  if (initialSyncState === "in-progress" || isProfileLoading) {
    return null;
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
  // Trust that an authenticated user MUST have a profile and wait it
  // out, EXCEPT when sync genuinely failed / timed out — in which case
  // we surface the retry screen so the user isn't stuck on a blank
  // screen. Sign-out also clears auth and unblocks the gate naturally.
  if (isAuthenticated && profile === null) {
    if (initialSyncState === "failed" || initialSyncState === "timeout") {
      return (
        <RetrySyncScreen onRetry={handleRetry} onSignOut={handleSignOut} />
      );
    }
    return null;
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
