/**
 * App Entry Point — Routing Gate
 *
 * Binary gate driven by profiles.onboarding_completed (from WatermelonDB,
 * post initial pull-sync). Per-step resume lives in onboarding.tsx via
 * AsyncStorage cursor; this gate only decides dashboard-vs-onboarding.
 *
 * Priority:
 * 1. Sync in-progress / profile loading → neutral backdrop (StarryBackground)
 * 2. Sync failed/timeout → RetrySyncScreen
 * 3. profile.onboarding_completed === true → dashboard
 * 4. else → onboarding (resume handled by onboarding.tsx)
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

  const routingInputs = {
    syncState: initialSyncState,
    onboardingCompleted: profile?.onboardingCompleted ?? false,
  };
  const outcome = getRoutingDecision(routingInputs);

  // FR-014: one structured log per gate evaluation (no PII).
  useEffect(() => {
    if (!hasLoggedRef.current && initialSyncState !== "in-progress") {
      hasLoggedRef.current = true;
      logger.info("onboarding.routing.decision", {
        ...buildRoutingDecisionLog(routingInputs, outcome),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- log once per resolved sync state
  }, [initialSyncState]);

  /** Sign-out handler for RetrySyncScreen — uses existing logout service. */
  const handleSignOut = useCallback((): void => {
    performLogout(database).catch(() => {
      // Logout errors are surfaced through the logout service's own toast path.
    });
  }, []);

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
        <RetrySyncScreen
          onRetry={(): void => {
            retryInitialSync().catch(() => {});
          }}
          onSignOut={handleSignOut}
        />
      );
    case "loading":
      return null;
    default:
      // "onboarding" — resume handled by onboarding.tsx via AsyncStorage cursor
      return <Redirect href="/onboarding" />;
  }
}
