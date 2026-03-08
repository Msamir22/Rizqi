/**
 * Auth Context
 * Provides authentication state and functions throughout the app.
 *
 * Architecture & Design Rationale:
 * - Pattern: React Context + shared user-resolution function
 * - Why: DRY — both bootstrap and onAuthStateChange need the same
 *   logic to resolve the true user (refetching from server when the
 *   session says is_anonymous due to stale JWT after linkIdentity).
 * - SOLID: SRP — resolveUser handles one concern (user resolution).
 *
 * Race Guard: applyResolvedSession() + listenerFiredRef ensures that
 * a stale bootstrap result cannot overwrite a fresher session from
 * onAuthStateChange.
 */

import { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/services/supabase";

// =============================================================================
// Types
// =============================================================================

interface AuthContextValue {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly isAnonymous: boolean;
  readonly signOut: () => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// =============================================================================
// User Resolution
// =============================================================================

/**
 * Resolve the ground-truth user from the server when the session JWT
 * still carries is_anonymous=true (e.g. after linkIdentity()).
 *
 * Falls back to the session user when the server cannot be reached
 * or returns an error.
 *
 * @param sessionUser - The user from the current session/JWT
 * @returns The resolved user (may differ from sessionUser)
 */
async function resolveUser(sessionUser: User | null): Promise<User | null> {
  if (!sessionUser?.is_anonymous) {
    return sessionUser;
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // TODO: Replace with structured logging (e.g., Sentry)
      // Network/auth errors — fall back to session user
      return sessionUser;
    }
    if (data.user && !data.user.is_anonymous) {
      return data.user;
    }
  } catch {
    // Defensive: getUser() threw unexpectedly — use session user
  }

  return sessionUser;
}

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Guard: tracks whether onAuthStateChange has fired at least once.
  // If it has, the bootstrap result is stale and should be discarded.
  const listenerFiredRef = useRef(false);

  /**
   * Centralized session application. Both bootstrap and the auth
   * listener route through here. The `fromListener` flag indicates
   * the source: listener updates always win; bootstrap updates are
   * skipped if the listener has already fired.
   *
   * Architecture & Design Rationale:
   * - Pattern: Single Entry Point for State Mutation
   * - Why: Prevents the race where bootstrap's slower resolveUser()
   *   overwrites a fresher session already published by the listener.
   */
  const applyResolvedSession = useCallback(
    (
      resolvedSession: Session | null,
      resolvedUser: User | null,
      fromListener: boolean
    ): void => {
      if (!fromListener && listenerFiredRef.current) {
        // Bootstrap resolved AFTER the listener already fired — skip.
        return;
      }

      if (fromListener) {
        listenerFiredRef.current = true;
      }

      setSession(resolvedSession);
      setUser(resolvedUser);
    },
    []
  );

  useEffect(() => {
    // Bootstrap: get initial session and resolve user
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        const resolved = await resolveUser(initialSession?.user ?? null);
        applyResolvedSession(initialSession, resolved, false);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      const resolved = await resolveUser(newSession?.user ?? null);
      applyResolvedSession(newSession, resolved, true);
    });

    return () => subscription.unsubscribe();
  }, [applyResolvedSession]);

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  const isAnonymous = user?.is_anonymous ?? false;

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    isAnonymous,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
