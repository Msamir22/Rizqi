/**
 * useSmsPermission Hook
 *
 * Manages READ_SMS permission state for Android.
 * Returns `denied` + `isAndroid: false` on iOS.
 *
 * Architecture & Design Rationale:
 * - Pattern: Adapter Pattern (wraps platform-specific PermissionsAndroid)
 * - SOLID: Single Responsibility — only manages permission state
 *
 * @module useSmsPermission
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AppStateStatus,
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
} from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SmsPermissionStatus = "undetermined" | "granted" | "denied" | "blocked";

interface UseSmsPermissionResult {
  /** Current permission status */
  readonly status: SmsPermissionStatus;
  /** Whether the device is Android (SMS reading only available on Android) */
  readonly isAndroid: boolean;
  /** Whether permission check is still loading */
  readonly isLoading: boolean;
  /** Request READ_SMS permission from user */
  readonly requestPermission: () => Promise<SmsPermissionStatus>;
  /** Open app settings (for when permission is blocked) */
  readonly openSettings: () => Promise<void>;
  /** Re-check the current permission state */
  readonly recheckPermission: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to manage READ_SMS permission lifecycle.
 *
 * - On mount, checks current permission status
 * - Provides `requestPermission()` to trigger native dialog
 * - Provides `openSettings()` for blocked state
 * - Returns `denied` on iOS with `isAndroid: false`
 */
export function useSmsPermission(): UseSmsPermissionResult {
  const [status, setStatus] = useState<SmsPermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(true);
  const isAndroid = Platform.OS === "android";

  /**
   * Check the current permission state without requesting.
   */
  const checkPermission = useCallback(async (): Promise<void> => {
    if (!isAndroid) {
      setStatus("denied");
      setIsLoading(false);
      return;
    }

    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      setStatus(result ? "granted" : "undetermined");
    } catch {
      setStatus("undetermined");
    } finally {
      setIsLoading(false);
    }
  }, [isAndroid]);

  /**
   * Request READ_SMS permission. Returns the new status.
   */
  const requestPermission =
    useCallback(async (): Promise<SmsPermissionStatus> => {
      if (!isAndroid) {
        return "denied";
      }

      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: "SMS Access",
            message:
              "Astik would like to read your financial SMS messages to automatically track your transactions.",
            buttonPositive: "Allow",
            buttonNegative: "Not Now",
          }
        );

        let newStatus: SmsPermissionStatus;
        switch (result) {
          case PermissionsAndroid.RESULTS.GRANTED:
            newStatus = "granted";
            break;
          case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
            newStatus = "blocked";
            break;
          default:
            newStatus = "denied";
            break;
        }

        setStatus(newStatus);
        return newStatus;
      } catch {
        setStatus("denied");
        return "denied";
      }
    }, [isAndroid]);

  /**
   * Open device app settings (for when permission is permanently blocked).
   */
  const openSettings = useCallback(async (): Promise<void> => {
    await Linking.openSettings();
  }, []);

  /**
   * Re-check permission state (e.g., after returning from settings).
   */
  const recheckPermission = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await checkPermission();
  }, [checkPermission]);

  // Check permission on mount
  useEffect(() => {
    checkPermission().catch((err: unknown) => {
      console.error(
        "[useSmsPermission] Permission check failed:",
        err instanceof Error ? err.message : String(err)
      );
    });
  }, [checkPermission]);

  // T045: Recheck permission when app returns to foreground
  // Detects permission revocation via Android Settings
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          previousAppState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          recheckPermission().catch(() => {});
        }
        previousAppState.current = nextState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isAndroid, recheckPermission]);

  return {
    status,
    isAndroid,
    isLoading,
    requestPermission,
    openSettings,
    recheckPermission,
  };
}
