/**
 * useProfile Hook
 *
 * Observes the first Profile record from WatermelonDB.
 * Only handles data subscription — all presentation logic (initials,
 * display name, avatar URL) lives in `@/utils/profile-helpers`.
 *
 * Follows the same observer pattern as usePreferredCurrency.
 *
 * @module useProfile
 */

import { database, Profile } from "@monyvi/db";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface UseProfileResult {
  /** The raw WatermelonDB Profile record (null while loading or if absent) */
  readonly profile: Profile | null;
  /** True while the initial Profile observation is pending */
  readonly isLoading: boolean;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Observes the user's Profile record from WatermelonDB.
 *
 * This hook is intentionally thin — it only subscribes to the profile
 * collection and exposes the raw record + loading state. All presentation
 * logic (display name, initials, avatar URL) should be derived at the
 * call-site using helpers from `@/utils/profile-helpers`.
 *
 * @returns An object with profile and isLoading.
 */
export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Observe the first profile record
  // TODO: Scope this query by user_id when multi-account support is added.
  // Currently safe because Monyvi is single-user and login wipes local data.
  useEffect(() => {
    const collection = database.get<Profile>("profiles");
    const subscription = collection
      .query(Q.where("deleted", false), Q.take(1))
      .observe()
      .subscribe({
        next: (profiles) => {
          setProfile(profiles[0] ?? null);
          setIsLoading(false);
        },
        error: (err: unknown) => {
          console.error("Error observing profile:", err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  return {
    profile,
    isLoading,
  };
}
