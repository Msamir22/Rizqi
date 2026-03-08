/**
 * Supabase Client for Astik Mobile
 * Initialized with environment variables
 *
 * Uses SecureStore for session persistence:
 * - iOS: Keychain - survives data clear and app reinstalls
 * - Android: EncryptedSharedPreferences - survives app restarts but NOT manual data clear
 */

import { SupabaseDatabase } from "@astik/db";
import { createClient, AuthError } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AUTH_REDIRECT_URL } from "@/constants/auth-constants";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  );
}

/**
 * Chunked SecureStore adapter for Supabase Auth.
 *
 * SecureStore has a 2048-byte limit per key. After OAuth identity linking,
 * the Supabase JWT can exceed this limit. This adapter transparently splits
 * large values into numbered chunks and reassembles them on read.
 *
 * Storage layout:
 * - Small values (≤ CHUNK_SIZE): stored directly at `key`
 * - Large values: split into `key__chunk_0`, `key__chunk_1`, etc.
 *   with `key` storing the chunk count as `__chunked__:N`
 *
 * Persistence behavior:
 * - iOS: Uses Keychain (survives data clear and reinstall)
 * - Android: Uses EncryptedSharedPreferences (cleared when user clears app data)
 *
 * TODO: Use generation-based chunk prefixes to prevent concurrent read/write
 * corruption during chunked writes. Currently, a concurrent getItem() could
 * assemble mixed old/new chunks if setItem() is in progress.
 */

const CHUNK_SIZE = 2048;
const CHUNK_MARKER = "__chunked__:";

function chunkKey(key: string, index: number): string {
  return `${key}__chunk_${index}`;
}

const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const raw = await SecureStore.getItemAsync(key);
      if (raw === null) return null;

      // Check if the value is chunked
      if (raw.startsWith(CHUNK_MARKER)) {
        const count = parseInt(raw.replace(CHUNK_MARKER, ""), 10);
        const chunks: string[] = [];

        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
          if (chunk === null) {
            // TODO: Replace with structured logging (e.g., Sentry)
            return null;
          }
          chunks.push(chunk);
        }

        return chunks.join("");
      }

      // Small value — return as-is
      return raw;
    } catch {
      // TODO: Replace with structured logging (e.g., Sentry)
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Read old chunk count before overwriting, so we can clean up stale chunks
      let oldChunkCount = 0;
      const oldRaw = await SecureStore.getItemAsync(key);
      if (oldRaw !== null && oldRaw.startsWith(CHUNK_MARKER)) {
        oldChunkCount = parseInt(oldRaw.replace(CHUNK_MARKER, ""), 10);
      }

      if (value.length <= CHUNK_SIZE) {
        // Small value — store directly (overwrites any existing marker/value)
        await SecureStore.setItemAsync(key, value);

        // Clean up all old chunks since we no longer need them
        for (let i = 0; i < oldChunkCount; i++) {
          await SecureStore.deleteItemAsync(chunkKey(key, i));
        }
        return;
      }

      // Large value — split into chunks
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      // Write chunks first, then update the marker (so reads always succeed)
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
      }

      // Update marker with new chunk count
      await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${chunks.length}`);

      // Clean up any extra stale chunks from the old value
      for (let i = chunks.length; i < oldChunkCount; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    } catch {
      // TODO: Replace with structured logging (e.g., Sentry)
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const raw = await SecureStore.getItemAsync(key);

      // Clean up chunks if they exist
      if (raw !== null && raw.startsWith(CHUNK_MARKER)) {
        const count = parseInt(raw.replace(CHUNK_MARKER, ""), 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(chunkKey(key, i));
        }
      }

      // Remove the main key
      await SecureStore.deleteItemAsync(key);
    } catch {
      // TODO: Replace with structured logging (e.g., Sentry)
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

  return session !== null;
}

/**
 * Sign in anonymously for guest mode
 */
export async function signInAnonymously(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    // TODO: Replace with structured logging (e.g., Sentry)
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
  // TODO: Replace with structured logging (e.g., Sentry)
  return false;
}

// =============================================================================
// Identity Linking (Anonymous → OAuth)
// =============================================================================

/** Supported OAuth providers for account conversion. */
type OAuthProvider = "google" | "facebook" | "apple";

/**
 * Convert an anonymous user to a provider-linked account.
 *
 * Uses Supabase's `linkIdentity()` which preserves the existing `user_id`,
 * meaning all data in WatermelonDB and Supabase remains intact.
 *
 * @param provider - The OAuth provider to link (google, facebook, or apple)
 * @returns The OAuth URL to open in a browser, or an error
 *
 * TODO: Add zod runtime validation for the linkIdentity response shape
 * to fail fast on malformed API responses.
 */
export async function linkIdentityWithProvider(
  provider: OAuthProvider
): Promise<{ url: string } | { error: AuthError }> {
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: AUTH_REDIRECT_URL,
    },
  });

  if (error) {
    return { error };
  }

  return { url: data.url };
}

export type { OAuthProvider };
