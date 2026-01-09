/**
 * Supabase Client for Astik Mobile
 * Initialized with environment variables
 */

import { SupabaseDatabase } from "@astik/db";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient<SupabaseDatabase>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
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
