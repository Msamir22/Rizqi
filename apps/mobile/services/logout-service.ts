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
    // Step 1: Set force-close recovery flag
    await AsyncStorage.setItem(LOGOUT_IN_PROGRESS_KEY, "true");

    if (!forceSkipSync) {
      // Step 2: Check network connectivity
      const networkState = await fetch();
      if (!networkState.isConnected) {
        await AsyncStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
        return { success: false, error: "no_network" };
      }

      // Step 3: Await any in-flight sync, then run a fresh sync
      const syncSucceeded = await attemptSync(database);
      if (!syncSucceeded) {
        // Don't proceed — caller should show warning modal
        // Keep the logout_in_progress flag so if user decides to proceed,
        // we can skip right to cleanup
        return { success: false, error: "sync_failed" };
      }
    }

    // Steps 4–7: Perform the actual cleanup
    await executeLogoutCleanup(database);

    return { success: true };
  } catch (error) {
    // FR-008: If DB reset fails, still try to clear the session
    try {
      await destroySession();
      await AsyncStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
    } catch {
      // Best-effort cleanup — nothing more we can do
    }
    // TODO: Replace with structured logging (e.g., Sentry)
    console.error("Logout failed:", error);
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
    console.log("Completing interrupted logout from previous session...");
    await executeLogoutCleanup(database);
    // TODO: Replace with structured logging (e.g., Sentry)
    console.log("Interrupted logout cleanup completed.");
  } catch (error) {
    // TODO: Replace with structured logging (e.g., Sentry)
    console.error("Failed to complete interrupted logout:", error);
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
  // Wait for any active sync to complete first
  const activeSync = getActiveSyncPromise();
  if (activeSync) {
    try {
      await activeSync;
    } catch {
      // Active sync failed — we'll try a fresh one below
    }
  }

  for (let attempt = 0; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      await syncDatabase(database);
      return true;
    } catch (error) {
      const isLastAttempt = attempt === MAX_SYNC_RETRIES;
      if (isLastAttempt) {
        // TODO: Replace with structured logging (e.g., Sentry)
        console.error(
          `Sync failed after ${MAX_SYNC_RETRIES + 1} attempts:`,
          error
        );
        return false;
      }
      // TODO: Replace with structured logging (e.g., Sentry)
      console.warn(`Sync attempt ${attempt + 1} failed, retrying...`, error);
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
  } catch (error) {
    // TODO: Replace with structured logging (e.g., Sentry)
    console.error("Failed to clear user preferences:", error);
    // Non-fatal — continue with logout
  }
}

/**
 * Destroy the current Supabase session. Session becomes null.
 */
async function destroySession(): Promise<void> {
  await supabase.auth.signOut();
}
