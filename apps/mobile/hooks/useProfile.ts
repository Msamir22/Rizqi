/**
 * useProfile Hook
 *
 * Observes the first Profile record from WatermelonDB and exposes
 * derived display properties (name, avatar, initials) for UI components.
 *
 * Follows the same observer pattern as usePreferredCurrency.
 *
 * @module useProfile
 */

import { database, Profile } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface UseProfileResult {
  /** The raw WatermelonDB Profile record (null while loading or if absent) */
  readonly profile: Profile | null;
  /** Resolved display name: fullName → displayName → email fallback → "" */
  readonly displayName: string;
  /** Profile avatar URL, or null if not set */
  readonly avatarUrl: string | null;
  /** 1-2 character initials derived from name or email */
  readonly initials: string;
  /** True while the initial Profile observation is pending */
  readonly isLoading: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Derives 1-2 uppercase initials from a name string.
 * - "Mohamed Samir" → "MS"
 * - "Mohamed" → "MO"
 * - "" → ""
 */
function deriveInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0]?.toUpperCase() ?? "";
}

/**
 * Derives 1-2 uppercase initials from an email address.
 * - "mo@gmail.com" → "MO"
 * - "a@b.com" → "A"
 */
function deriveInitialsFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return localPart.slice(0, 2).toUpperCase();
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Observes the user's Profile record and exposes derived display properties.
 *
 * @param email - The authenticated user's email (from useAuth().user.email).
 *   Used as fallback for displayName and initials when profile has no name data.
 *
 * @returns An object with profile, displayName, avatarUrl, initials, and isLoading.
 */
export function useProfile(email?: string | null): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Observe the first profile record
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

  const displayName = useMemo<string>(() => {
    if (!profile) return email ?? "";

    const fullName = profile.fullName;
    if (fullName) return fullName;

    return email ?? "";
  }, [profile, email]);

  const avatarUrl = useMemo<string | null>(() => {
    return profile?.avatarUrl ?? null;
  }, [profile?.avatarUrl]);

  const initials = useMemo<string>(() => {
    if (profile) {
      const fullName = profile.fullName;
      if (fullName) return deriveInitialsFromName(fullName);
    }

    if (email) return deriveInitialsFromEmail(email);

    return "";
  }, [profile, email]);

  return {
    profile,
    displayName,
    avatarUrl,
    initials,
    isLoading,
  };
}
