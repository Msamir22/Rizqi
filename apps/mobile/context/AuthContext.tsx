/**
 * Auth Context
 * Provides authentication state and functions throughout the app
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
    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const sessionUser = newSession?.user ?? null;

      // After linkIdentity(), the session JWT may still carry is_anonymous=true
      // until the token is fully refreshed. Explicitly refetch from the server
      // to get the ground-truth value whenever the session says anonymous.
      if (sessionUser?.is_anonymous) {
        try {
          const { data, error } = await supabase.auth.getUser();
          if (error) {
            // TODO: Replace with structured logging (e.g., Sentry)
            // Network/auth errors during listener — fall back to session user
            setUser(sessionUser);
            return;
          }
          if (data.user && !data.user.is_anonymous) {
            setUser(data.user);
            return;
          }
        } catch {
          // Defensive: getUser() threw unexpectedly — use session user
          setUser(sessionUser);
          return;
        }
      }

      setUser(sessionUser);
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
