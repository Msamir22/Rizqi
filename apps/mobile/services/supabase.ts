/**
 * Supabase Client for Astik Mobile
 * Initialized with environment variables
 *
 * Uses SecureStore for session persistence:
 * - iOS: Keychain - survives data clear and app reinstalls
 * - Android: EncryptedSharedPreferences - survives app restarts but NOT manual data clear
 */

import { SupabaseDatabase } from "@astik/db";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  );
}

/**
 * Custom storage adapter using SecureStore
 * Provides encrypted storage for auth tokens
 *
 * Persistence behavior:
 * - iOS: Uses Keychain (survives data clear and reinstall)
 * - Android: Uses EncryptedSharedPreferences (cleared when user manually clears app data)
 */
const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("SecureStore getItem error:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

export const supabase = createClient<SupabaseDatabase>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Get current authenticated user ID
 * Returns null if not authenticated (guest mode still has an anonymous user)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Check if user is authenticated (including anonymous)
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("User ID", session?.user?.id);
  return session !== null;
}

/**
 * Sign in anonymously for guest mode
 */
export async function signInAnonymously(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("Anonymous sign-in failed:", error);
    return null;
  }
  return data.user?.id ?? null;
}

/**
 * Ensure user is authenticated (anonymous or real)
 * Retries with exponential backoff, then continues offline if all fail
 *
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns true if authenticated, false if failed (app continues offline)
 */
export async function ensureAuthenticated(maxRetries = 3): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check if already authenticated
    const hasSession = await isAuthenticated();
    if (hasSession) {
      return true;
    }

    // Attempt anonymous sign-in
    const userId = await signInAnonymously();
    if (userId) {
      return true;
    }

    // Wait before retry with exponential backoff (500ms, 1s, 2s)
    if (attempt < maxRetries - 1) {
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts failed - continue offline (WatermelonDB works locally)
  console.warn("Authentication failed after retries, continuing offline");
  return false;
}
