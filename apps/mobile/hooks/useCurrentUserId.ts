/**
 * useCurrentUserId Hook
 *
 * Thin wrapper over `useAuth()` that exposes just the current user's
 * id and the resolution state. Used as a defense-in-depth boundary for
 * any reactive query that must scope rows to the signed-in user
 * (e.g., account queries in useAccounts.ts).
 *
 * @module useCurrentUserId
 */

import { useAuth } from "@/context/AuthContext";

interface UseCurrentUserIdResult {
  /** The current authenticated user's id, or null when signed out. */
  readonly userId: string | null;
  /** Whether the initial auth resolution is still pending. */
  readonly isResolvingUser: boolean;
}

type UserScopedEffectCleanup = void | (() => void);

interface RunUserScopedEffectInput {
  readonly userId: string | null;
  readonly isResolvingUser: boolean;
  readonly onResolving: () => void;
  readonly onSignedOut: () => void;
  readonly onAuthenticated: (userId: string) => UserScopedEffectCleanup;
}

/**
 * Returns the current Supabase user id from `AuthContext` along with the
 * resolution state. Callers should treat `userId == null` after
 * `isResolvingUser` flips false as "signed out" and avoid querying.
 */
export function useCurrentUserId(): UseCurrentUserIdResult {
  const { user, isLoading } = useAuth();
  return {
    userId: user?.id ?? null,
    isResolvingUser: isLoading,
  };
}

/**
 * Runs a user-scoped effect only after auth has resolved to a concrete user.
 * Keeps stale local data cleared while auth is resolving or signed out.
 */
export function runUserScopedEffect({
  userId,
  isResolvingUser,
  onResolving,
  onSignedOut,
  onAuthenticated,
}: RunUserScopedEffectInput): UserScopedEffectCleanup {
  if (isResolvingUser) {
    onResolving();
    return;
  }

  if (!userId) {
    onSignedOut();
    return;
  }

  return onAuthenticated(userId);
}
