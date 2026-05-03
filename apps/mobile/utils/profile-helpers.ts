/**
 * Profile Display Helpers
 *
 * Pure utility functions for deriving display properties (initials, display name)
 * from profile data. Extracted from the useProfile hook to follow the
 * separation-of-concerns principle: the hook only observes/subscribes, while
 * these helpers handle presentation logic.
 *
 * @module profile-helpers
 */

import type { Profile } from "@monyvi/db";

// =============================================================================
// Initials
// =============================================================================

/**
 * Derives 1-2 uppercase initials from a name string.
 *
 * @example
 * deriveInitialsFromName("Mohamed Samir") // → "MS"
 * deriveInitialsFromName("Mohamed")       // → "MO"
 * deriveInitialsFromName("")              // → ""
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
 *
 * @example
 * deriveInitialsFromEmail("mo@gmail.com") // → "MO"
 * deriveInitialsFromEmail("a@b.com")      // → "A"
 */
function deriveInitialsFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return localPart.slice(0, 2).toUpperCase();
}

// =============================================================================
// Composite helpers
// =============================================================================

/**
 * Resolves the best available initials from a Profile record and/or email.
 * Priority: profile fullName → email local part → empty string.
 */
function getProfileInitials(
  profile: Profile | null,
  email?: string | null
): string {
  if (profile) {
    const fullName = profile.fullName;
    if (fullName) return deriveInitialsFromName(fullName);
  }

  if (email) return deriveInitialsFromEmail(email);

  return "";
}

/**
 * Resolves the best available display name from a Profile record and/or email.
 * Priority: profile fullName → email → empty string.
 */
function getProfileDisplayName(
  profile: Profile | null,
  email?: string | null
): string {
  if (!profile) return email ?? "";

  const fullName = profile.fullName;
  if (fullName) return fullName;

  return email ?? "";
}

/**
 * Extracts the avatar URL from a Profile record, or null if not set.
 */
function getProfileAvatarUrl(profile: Profile | null): string | null {
  return profile?.avatarUrl ?? null;
}

export {
  deriveInitialsFromName,
  deriveInitialsFromEmail,
  getProfileInitials,
  getProfileDisplayName,
  getProfileAvatarUrl,
};
