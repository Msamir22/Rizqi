import { useEffect, useState } from "react";
import { Profile, database, type OnboardingFlags } from "@rizqi/db";
import { Q } from "@nozbe/watermelondb";

export function useOnboardingFlags(): OnboardingFlags {
  const [flags, setFlags] = useState<OnboardingFlags>({});

  useEffect(() => {
    const subscription = database
      .get<Profile>("profiles")
      .query(Q.where("deleted", false), Q.take(1))
      .observeWithColumns(["onboarding_flags"])
      .subscribe({
        next: (profiles) => {
          const profile = profiles[0];
          setFlags(profile?.onboardingFlags ?? {});
        },
        error: () => setFlags({}),
      });
    return () => subscription.unsubscribe();
  }, []);

  return flags;
}
