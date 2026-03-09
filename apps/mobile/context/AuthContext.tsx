/**
 * Auth Context
 * Provides authentication state and functions throughout the app.
 *
 * Architecture & Design Rationale:
 * - Pattern: React Context with session-based state
 * - Why: Simple session check — if session exists, the user is
 *   authenticated. No server re-verification needed.
 * - SOLID: SRP — context only manages auth state propagation.
 *
 * Race Guard: applySession() + listenerFiredRef ensures that
 * a stale bootstrap result cannot overwrite a fresher session from
 * onAuthStateChange.
 */

import type { Session, User } from "@supabase/supabase-js";
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
   * - Why: Prevents the race where bootstrap's slower getSession()
   *   overwrites a fresher session already published by the listener.
   */
  const applySession = useCallback(
    (newSession: Session | null, fromListener: boolean): void => {
      if (!fromListener && listenerFiredRef.current) {
        // Bootstrap resolved AFTER the listener already fired — skip.
        return;
      }

      if (fromListener) {
        listenerFiredRef.current = true;
      }

      const sessionUser = newSession?.user ?? null;

      setSession(sessionUser ? newSession : null);
      setUser(sessionUser);
    },
    []
  );

  useEffect(() => {
    // Bootstrap: get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        applySession(initialSession, false);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession, true);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: user !== null,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
