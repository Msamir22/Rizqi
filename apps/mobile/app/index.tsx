/**
 * App Entry Point — Routing Gate
 *
 * Binary gate driven by profiles.onboarding_completed (from WatermelonDB,
 * post initial pull-sync). Per-step resume lives in onboarding.tsx via
 * AsyncStorage cursor; this gate only decides dashboard-vs-onboarding.
 *
 * Priority (see utils/routing-decision.ts for the authoritative rule):
 * 1. Sync in-progress / profile loading → neutral backdrop (splash)
 * 2. onboarding_completed = true → dashboard (regardless of sync state —
 *    offline-first for returning users)
 * 3. Sync succeeded AND flag = false → onboarding (resume via cursor)
 * 4. Sync failed/timeout AND flag = false → retry screen
 *
 * @module Index
 */

import { database } from "@rizqi/db";
import { RetrySyncScreen } from "@/components/ui/RetrySyncScreen";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/providers/SyncProvider";
import { performLogout } from "@/services/logout-service";
import {
  buildRoutingDecisionLog,
  getRoutingDecision,
} from "@/utils/routing-decision";
import { logger } from "@/utils/logger";
import { Redirect } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";

export default function Index(): React.ReactNode {
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
  if (initialSyncState === "in-progress" || isProfileLoading) {
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
