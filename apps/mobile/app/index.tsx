/**
 * App Entry Point — Routing Gate
 *
 * Determines the user's first screen after authentication by reading the
 * profile state from WatermelonDB (post initial pull-sync). Replaces the
 * legacy AsyncStorage HAS_ONBOARDED_KEY gate.
 *
 * Priority:
 * 1. Sync in-progress → show loading skeleton
 * 2. Sync failed/timeout → RetrySyncScreen
 * 3. Profile.onboardingCompleted = true → dashboard
 * 4. Resume at first incomplete step → onboarding
 *
 * @module Index
 */

import { Account, database } from "@rizqi/db";
import { DashboardSkeleton } from "@/components/dashboard/skeletons/DashboardSkeleton";
import { RetrySyncScreen } from "@/components/ui/RetrySyncScreen";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/providers/SyncProvider";
import { performLogout } from "@/services/logout-service";
import {
  buildRoutingDecisionLog,
  getRoutingDecision,
} from "@/utils/routing-decision";
import { Redirect } from "expo-router";
import { Q } from "@nozbe/watermelondb";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/utils/logger";

export default function Index(): React.ReactNode {
  const { initialSyncState, retryInitialSync } = useSync();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [hasCashAccount, setHasCashAccount] = useState(false);
  const hasLoggedRef = useRef(false);

  // Observe cash-account presence for the routing gate (Option B per data-model.md § 3)
  useEffect(() => {
    const subscription = database
      .get<Account>("accounts")
      .query(Q.where("type", "CASH"), Q.where("deleted", false), Q.take(1))
      .observe()
      .subscribe({
        next: (accounts) => setHasCashAccount(accounts.length > 0),
        error: () => setHasCashAccount(false),
      });

    return () => subscription.unsubscribe();
  }, []);

  const routingInputs = {
    syncState: initialSyncState,
    onboardingCompleted: profile?.onboardingCompleted ?? false,
    hasPreferredLanguage: !!profile?.preferredLanguage,
    slidesViewed: profile?.slidesViewed ?? false,
    hasCashAccount,
  };

  const outcome = getRoutingDecision(routingInputs);

  // FR-014: Emit one structured log per routing-gate evaluation
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
  const handleSignOut = useCallback(() => {
    performLogout(database).catch(() => {});
    // Explicitly return void to satisfy ESLint
    return;
  }, []);

  // Show loading skeleton while profile is being observed or sync is running
  if (initialSyncState === "in-progress" || isProfileLoading) {
    return (
      <StarryBackground>
        <DashboardSkeleton />
      </StarryBackground>
    );
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
      return (
        <StarryBackground>
          <DashboardSkeleton />
        </StarryBackground>
      );
    default:
      // language | slides | currency | cash-account-confirmation → onboarding
      return <Redirect href="/onboarding" />;
  }
}
