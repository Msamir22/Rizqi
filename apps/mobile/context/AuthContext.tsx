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
 */

import { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

  useEffect(() => {
    // Bootstrap: get initial session and resolve user
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        setSession(initialSession);
        const resolved = await resolveUser(initialSession?.user ?? null);
        setUser(resolved);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const resolved = await resolveUser(newSession?.user ?? null);
      setUser(resolved);
    });

    return () => subscription.unsubscribe();
  }, []);

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
