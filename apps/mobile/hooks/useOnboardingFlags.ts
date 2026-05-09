import { useEffect, useState } from "react";
import { Profile, database, type OnboardingFlags } from "@monyvi/db";
import { Q } from "@nozbe/watermelondb";
import { queryOwned } from "@/services/user-data-access";
import { useCurrentUserId } from "./useCurrentUserId";
import { logger } from "@/utils/logger";

export function useOnboardingFlags(): OnboardingFlags {
  const [flags, setFlags] = useState<OnboardingFlags>({});
  const { userId, isResolvingUser } = useCurrentUserId();

  useEffect(() => {
    if (isResolvingUser) {
      setFlags({});
      return;
    }

    if (!userId) {
      setFlags({});
      return;
    }

    const subscription = queryOwned(
      database.get<Profile>("profiles"),
      userId,
      Q.where("deleted", false),
      Q.take(1)
    )
      .observeWithColumns(["onboarding_flags"])
      .subscribe({
        next: (profiles) => {
          const profile = profiles[0];
          setFlags(profile?.onboardingFlags ?? {});
        },
        error: (err: unknown) => {
          logger.error("onboardingFlags.observe.failed", err);
          setFlags({});
        },
      });
    return () => subscription.unsubscribe();
  }, [userId, isResolvingUser]);

  return flags;
}
