/**
 * useSmsSync Hook
 *
 * Manages first-launch SMS sync prompt visibility.
 * Checks onboarding completion + AsyncStorage flag to decide
 * whether to show the permission prompt on the dashboard.
 *
 * @module useSmsSync
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SMS_PROMPT_SHOWN_KEY = "@astik/sms-prompt-shown";
const SMS_LAST_SYNC_KEY = "@astik/sms-last-sync";
const SMS_HAS_SYNCED_KEY = "@astik/sms-has-synced";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseSmsSyncResult {
  /** Whether the SMS permission prompt should be shown */
  readonly shouldShowPrompt: boolean;
  /** Whether the user has completed at least one sync */
  readonly hasSynced: boolean;
  /** Timestamp of last successful sync (ms) or null */
  readonly lastSyncTimestamp: number | null;
  /** Mark the prompt as shown (dismiss it) */
  readonly dismissPrompt: () => Promise<void>;
  /** Update sync state after successful scan */
  readonly markSyncComplete: () => Promise<void>;
  /** Whether state is still loading from AsyncStorage */
  readonly isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmsSync(): UseSmsSyncResult {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load state from AsyncStorage on mount
  useEffect(() => {
    async function loadState(): Promise<void> {
      try {
        // Only show on Android
        if (Platform.OS !== "android") {
          setShouldShowPrompt(false);
          setIsLoading(false);
          return;
        }

        const [promptShown, hasSyncedValue, lastSync] =
          await AsyncStorage.multiGet([
            SMS_PROMPT_SHOWN_KEY,
            SMS_HAS_SYNCED_KEY,
            SMS_LAST_SYNC_KEY,
          ]);

        const wasPromptShown = promptShown[1] === "true";
        const syncedBefore = hasSyncedValue[1] === "true";
        const syncTimestamp = lastSync[1] ? parseInt(lastSync[1], 10) : null;

        setHasSynced(syncedBefore);
        setLastSyncTimestamp(syncTimestamp);

        // Show prompt only if never shown before and never synced
        setShouldShowPrompt(!wasPromptShown && !syncedBefore);
      } catch {
        // Fail silently — don't show prompt on error
        setShouldShowPrompt(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadState().catch(() => {
      // Silently handle — state defaults are safe
    });
  }, []);

  /**
   * Dismiss the prompt and mark it as shown.
   */
  const dismissPrompt = useCallback(async (): Promise<void> => {
    setShouldShowPrompt(false);
    try {
      await AsyncStorage.setItem(SMS_PROMPT_SHOWN_KEY, "true");
    } catch {
      // Silently fail — prompt will just show again next time
    }
  }, []);

  /**
   * Mark sync as complete and store the timestamp.
   */
  const markSyncComplete = useCallback(async (): Promise<void> => {
    const now = Date.now();
    setHasSynced(true);
    setLastSyncTimestamp(now);
    setShouldShowPrompt(false);

    try {
      await AsyncStorage.multiSet([
        [SMS_PROMPT_SHOWN_KEY, "true"],
        [SMS_HAS_SYNCED_KEY, "true"],
        [SMS_LAST_SYNC_KEY, String(now)],
      ]);
    } catch {
      // Silently fail
    }
  }, []);

  return {
    shouldShowPrompt,
    hasSynced,
    lastSyncTimestamp,
    dismissPrompt,
    markSyncComplete,
    isLoading,
  };
}
