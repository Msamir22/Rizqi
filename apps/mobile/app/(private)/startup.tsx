/**
 * Authenticated startup routing gate.
 *
 * This screen decides whether the signed-in user should enter onboarding,
 * recover account loading, or continue to the dashboard. It never routes a
 * missing current-user profile to onboarding.
 */

import { database } from "@monyvi/db";
import { RetrySyncScreen } from "@/components/ui/RetrySyncScreen";
import { StartupLoadingView } from "@/components/ui/StartupLoadingView";
import { useProfile } from "@/hooks/useProfile";
import { useSync, type InitialSyncState } from "@/providers/SyncProvider";
import { performLogout } from "@/services/logout-service";
import {
  buildRoutingDecisionLog,
  getRoutingDecision,
} from "@/utils/routing-decision";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";

const PROFILE_OBSERVATION_GRACE_MS = 4_000;

export default function Index(): React.ReactNode {
  const { initialSyncState, retryInitialSync } = useSync();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const onboardingCompleted = profile?.onboardingCompleted ?? false;
  const hasProfileGraceElapsed = useProfileGrace({
    initialSyncState,
    isProfileLoading,
    profile,
  });
  const routingInputs = {
    syncState: initialSyncState,
    onboardingCompleted,
  };
  const outcome = getRoutingDecision(routingInputs);

  useStartupRoutingTelemetry({
    initialSyncState,
    isProfileLoading,
    onboardingCompleted,
  });

  const handleSignOut = useCallback((): void => {
    void performLogout(database)
      .then((result) => {
        if (!result.success) {
          logger.warn("onboarding.retryScreen.signOut.failed", {
            reason: result.error ?? "unknown",
          });
        }
      })
      .catch((error: unknown) => {
        logger.warn(
          "onboarding.retryScreen.signOut.failed",
          getSafeErrorLog(error)
        );
      });
  }, []);

  const handleRetry = useCallback((): void => {
    retryInitialSync().catch((error: unknown) => {
      logger.warn(
        "onboarding.retryScreen.retryInitialSync.failed",
        getSafeErrorLog(error)
      );
    });
  }, [retryInitialSync]);

  if (initialSyncState === "in-progress" || isProfileLoading) {
    return <StartupLoadingView />;
  }

  if (profile === null) {
    if (
      initialSyncState === "failed" ||
      initialSyncState === "timeout" ||
      hasProfileGraceElapsed
    ) {
      return (
        <RetrySyncScreen onRetry={handleRetry} onSignOut={handleSignOut} />
      );
    }

    return <StartupLoadingView />;
  }

  switch (outcome) {
    case "dashboard":
      return <RedirectWithTransitionFallback href="/(tabs)" />;
    case "retry":
      return (
        <RetrySyncScreen onRetry={handleRetry} onSignOut={handleSignOut} />
      );
    case "loading":
      return <StartupLoadingView />;
    default:
      return <RedirectWithTransitionFallback href="/onboarding" />;
  }
}

interface ProfileGraceInput {
  readonly initialSyncState: InitialSyncState;
  readonly isProfileLoading: boolean;
  readonly profile: object | null;
}

function useProfileGrace({
  initialSyncState,
  isProfileLoading,
  profile,
}: ProfileGraceInput): boolean {
  const [hasProfileGraceElapsed, setHasProfileGraceElapsed] = useState(false);

  useEffect(() => {
    const syncSettled = initialSyncState !== "in-progress";
    const isProfileMissing = !isProfileLoading && profile === null;

    if (!syncSettled || !isProfileMissing) {
      setHasProfileGraceElapsed(false);
      return;
    }

    if (hasProfileGraceElapsed) return;

    const timer = setTimeout(() => {
      setHasProfileGraceElapsed(true);
    }, PROFILE_OBSERVATION_GRACE_MS);

    return () => clearTimeout(timer);
  }, [initialSyncState, isProfileLoading, profile, hasProfileGraceElapsed]);

  return hasProfileGraceElapsed;
}

interface StartupRoutingTelemetryInput {
  readonly initialSyncState: InitialSyncState;
  readonly isProfileLoading: boolean;
  readonly onboardingCompleted: boolean;
}

function useStartupRoutingTelemetry({
  initialSyncState,
  isProfileLoading,
  onboardingCompleted,
}: StartupRoutingTelemetryInput): void {
  const hasLoggedRef = useRef(false);

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
}

interface RedirectWithTransitionFallbackProps {
  readonly href: "/(tabs)" | "/onboarding";
}

function RedirectWithTransitionFallback({
  href,
}: RedirectWithTransitionFallbackProps): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <StartupLoadingView />;
}

function getSafeErrorLog(error: unknown): { readonly message: string } {
  return {
    message: error instanceof Error ? error.message : "Unknown error",
  };
}
