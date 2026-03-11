/**
 * Logout Service
 *
 * Orchestrates the full logout sequence: sync → reset DB → clear preferences → destroy session.
 * Implements the Facade pattern — components call a single function, not five subsystems.
 *
 * @module logout-service
 */

import {
  CLEARABLE_USER_KEYS,
  LOGOUT_IN_PROGRESS_KEY,
} from "@/constants/storage-keys";
import type { Database } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "@react-native-community/netinfo";
import { supabase } from "./supabase";
import { getActiveSyncPromise, resetSyncState, syncDatabase } from "./sync";

// =============================================================================
// Types
// =============================================================================

/** Result of the `performLogout` function. */
interface LogoutResult {
  /** Whether the logout completed successfully. */
  readonly success: boolean;
  /** If `success` is false, the reason for failure. */
  readonly error?: "no_network" | "sync_failed" | "unknown";
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of sync retry attempts before giving up. */
const MAX_SYNC_RETRIES = 1;

/** Maximum time (ms) to wait for an in-flight sync before abandoning it. */
const ACTIVE_SYNC_TIMEOUT_MS = 10_000;

// =============================================================================
// Core Logout Functions
// =============================================================================

/**
 * Perform the full logout sequence for a signed-in user.
 *
 * Steps:
 * 1. Set `logout_in_progress` flag (force-close recovery)
 * 2. Verify network connectivity
 * 3. Await any in-flight sync, then run a fresh sync (retry once on failure)
 * 4. Reset local WatermelonDB database
 * 5. Clear user-specific AsyncStorage keys (preserve device-level keys)
 * 6. Destroy Supabase session
 * 7. Remove `logout_in_progress` flag
 *
 * @param database - The WatermelonDB database instance
 * @param forceSkipSync - If true, skip sync entirely (used after user acknowledges data loss risk)
 * @returns LogoutResult indicating success or the reason for failure
 */
export async function performLogout(
  database: Database,
  forceSkipSync = false
): Promise<LogoutResult> {
  try {
    if (!forceSkipSync) {
      // Step 2: Check network connectivity
      const networkState = await fetch();
      if (!networkState.isConnected) {
        return { success: false, error: "no_network" };
      }

      // Step 3: Await any in-flight sync, then run a fresh sync
      const syncSucceeded = await attemptSync(database);
      if (!syncSucceeded) {
        return { success: false, error: "sync_failed" };
      }
    }

    // Mark logout as interrupted only once cleanup becomes irreversible
    await AsyncStorage.setItem(LOGOUT_IN_PROGRESS_KEY, "true");

    // Steps 4–7: Perform the actual cleanup
    await executeLogoutCleanup(database);

    return { success: true };
  } catch {
    // FR-008: If DB reset fails, still try to clear the session
    try {
      await destroySession();
      await AsyncStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
    } catch {
      // Best-effort cleanup — nothing more we can do
    }
    // TODO: Replace with structured logging (e.g., Sentry)
    return { success: false, error: "unknown" };
  }
}

/**
 * Complete an interrupted logout that was interrupted by a force-close.
 *
 * Checks for the `logout_in_progress` flag in AsyncStorage.
 * If present, runs the cleanup steps (reset DB, clear keys, new session).
 * Sync is skipped since we can't guarantee the app state after a force-close.
 *
 * @param database - The WatermelonDB database instance
 */
export async function completeInterruptedLogout(
  database: Database
): Promise<void> {
  try {
    const flag = await AsyncStorage.getItem(LOGOUT_IN_PROGRESS_KEY);
    if (flag !== "true") {
      return; // No interrupted logout to complete
    }

    // TODO: Replace with structured logging (e.g., Sentry)
    await executeLogoutCleanup(database);
    // TODO: Replace with structured logging (e.g., Sentry)
  } catch {
    // TODO: Replace with structured logging (e.g., Sentry)
    // Remove the flag to prevent infinite loops
    try {
      await AsyncStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
    } catch {
      // Best-effort
    }
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Attempt to sync local data to the server, with one retry on failure.
 *
 * @param database - The WatermelonDB database instance
 * @returns true if sync succeeded, false if it failed after retries
 */
async function attemptSync(database: Database): Promise<boolean> {
  // Wait for any active sync to complete first, but bound the wait
  const activeSync = getActiveSyncPromise();
  if (activeSync) {
    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Active sync timed out"));
        }, ACTIVE_SYNC_TIMEOUT_MS);
      });
      await Promise.race([activeSync, timeout]);
    } catch {
      // Active sync failed or timed out — we'll try a fresh one below
    }
  }

  for (let attempt = 0; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      await syncDatabase(database);
      return true;
    } catch {
      const isLastAttempt = attempt === MAX_SYNC_RETRIES;
      if (isLastAttempt) {
        // TODO: Replace with structured logging (e.g., Sentry)
        return false;
      }
      // TODO: Replace with structured logging (e.g., Sentry)
    }
  }

  // This is unreachable because the for-loop always exits via
  // return true (sync success) or return false (last attempt failed).
  // Kept for TypeScript exhaustiveness.
  return false;
}

/**
 * Execute the logout cleanup steps: reset DB → clear keys → destroy session → remove flag.
 *
 * @param database - The WatermelonDB database instance
 */
async function executeLogoutCleanup(database: Database): Promise<void> {
  // Step 4: Reset local WatermelonDB database
  await resetSyncState(database);

  // Step 5: Clear user-specific AsyncStorage keys
  await clearUserPreferences();

  // Step 6: Destroy session
  await destroySession();

  // Step 7: Remove force-close recovery flag
  await AsyncStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
}

/**
 * Clear all user-specific AsyncStorage keys while preserving device-level keys.
 */
async function clearUserPreferences(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...CLEARABLE_USER_KEYS]);
  } catch {
    // TODO: Replace with structured logging (e.g., Sentry)
    // Non-fatal — continue with logout
  }
}

/**
 * Destroy the current Supabase session. Session becomes null.
 */
async function destroySession(): Promise<void> {
  await supabase.auth.signOut();
}
