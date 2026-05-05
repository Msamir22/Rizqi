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
import { logger } from "@/utils/logger";
import type { Database } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { resetSyncState } from "./sync";

// =============================================================================
// Types
// =============================================================================

/** Result of the `performLogout` function. */
interface LogoutResult {
  /** Whether the logout completed successfully. */
  readonly success: boolean;
  /** If `success` is false, the reason for failure. */
  readonly error?: "unknown";
}

// =============================================================================
// Constants
// =============================================================================

/** Allows auth-driven route replacement to unmount WatermelonDB observers. */
const PRIVATE_SUBSCRIBER_TEARDOWN_DELAY_MS = 300;

// =============================================================================
// Core Logout Functions
// =============================================================================

/**
 * Perform the full logout sequence for a signed-in user.
 *
 * Steps:
 * 1. Set `logout_in_progress` flag (force-close recovery)
 * 2. Destroy Supabase session
 * 3. Schedule local private-data cleanup in the background
 *
 * @param database - The WatermelonDB database instance
 * @param forceSkipSync - Deprecated. Kept for existing force-logout callers.
 * @returns LogoutResult indicating success or the reason for failure
 */
export async function performLogout(
  database: Database,
  forceSkipSync = false
): Promise<LogoutResult> {
  void forceSkipSync;

  try {
    await AsyncStorage.setItem(LOGOUT_IN_PROGRESS_KEY, "true");
    await destroySession();
    scheduleLocalLogoutCleanup(database);

    return { success: true };
  } catch {
    try {
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
 * If present, runs the cleanup steps (reset DB, clear keys, remove flag).
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

    await executeLocalLogoutCleanup(database);
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
 * Execute the local cleanup steps after session termination.
 *
 * @param database - The WatermelonDB database instance
 */
async function executeLocalLogoutCleanup(database: Database): Promise<void> {
  await waitForPrivateSubscribersToUnmount();

  // Reset local WatermelonDB database
  await resetSyncState(database);

  // Clear user-specific AsyncStorage keys
  await clearUserPreferences();

  // Remove force-close recovery flag after cleanup completes
  await AsyncStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
}

function scheduleLocalLogoutCleanup(database: Database): void {
  executeLocalLogoutCleanup(database).catch((error: unknown) => {
    logger.warn(
      "logout.localCleanup.failed",
      error instanceof Error ? { message: error.message } : { error }
    );
  });
}

function waitForPrivateSubscribersToUnmount(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, PRIVATE_SUBSCRIBER_TEARDOWN_DELAY_MS);
  });
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
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
