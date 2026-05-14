/**
 * useSmsPermission Hook
 *
 * Manages SMS read and live detection permission state for Android.
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
  type Permission,
  AppState,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SmsPermissionStatus = "undetermined" | "granted" | "denied" | "blocked";
type NativeSmsPermissionStatus = "granted" | "requestable" | "blocked";

const READ_SMS_PERMISSION = PermissionsAndroid.PERMISSIONS.READ_SMS;

const LIVE_SMS_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.READ_SMS,
  PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
] as const;

interface NativeSmsModules {
  readonly SmsEventModule?: {
    readonly getPermissionStatus?: (
      permission: Permission
    ) => Promise<NativeSmsPermissionStatus>;
    readonly markPermissionRequested?: (
      permission: Permission
    ) => Promise<void>;
  };
}

interface UseSmsPermissionResult {
  /** Current permission status */
  readonly status: SmsPermissionStatus;
  /** Whether live SMS detection has the SMS permissions it needs */
  readonly liveDetectionStatus: SmsPermissionStatus;
  /** Whether the device is Android (SMS reading only available on Android) */
  readonly isAndroid: boolean;
  /** Whether permission check is still loading */
  readonly isLoading: boolean;
  /** Request READ_SMS permission from user */
  readonly requestPermission: () => Promise<SmsPermissionStatus>;
  /** Request READ_SMS + RECEIVE_SMS permissions for live SMS detection */
  readonly requestLiveDetectionPermission: () => Promise<SmsPermissionStatus>;
  /** Open app settings (for when permission is blocked) */
  readonly openSettings: () => Promise<void>;
  /** Re-check the current permission state */
  readonly recheckPermission: () => Promise<void>;
}

function statusFromRequestResult(result: string): SmsPermissionStatus {
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return "granted";
  }

  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return "blocked";
  }

  return "denied";
}

function statusFromNativePermissionStatus(
  status: NativeSmsPermissionStatus
): SmsPermissionStatus {
  if (status === "granted") return "granted";
  if (status === "blocked") return "blocked";
  return "undetermined";
}

function statusFromCombinedRequestResults(
  results: readonly string[]
): SmsPermissionStatus {
  if (
    results.every((result) => result === PermissionsAndroid.RESULTS.GRANTED)
  ) {
    return "granted";
  }

  if (
    results.some(
      (result) => result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    )
  ) {
    return "blocked";
  }

  return "denied";
}

async function getNativeSmsPermissionStatus(
  permission: Permission
): Promise<SmsPermissionStatus> {
  const { SmsEventModule } = NativeModules as NativeSmsModules;

  if (SmsEventModule?.getPermissionStatus) {
    const status = await SmsEventModule.getPermissionStatus(permission);
    return statusFromNativePermissionStatus(status);
  }

  const isGranted = await PermissionsAndroid.check(permission);
  return isGranted ? "granted" : "undetermined";
}

async function markNativeSmsPermissionRequested(
  permission: Permission
): Promise<void> {
  const { SmsEventModule } = NativeModules as NativeSmsModules;

  try {
    await SmsEventModule?.markPermissionRequested?.(permission);
  } catch (error: unknown) {
    logger.warn("SmsEventModule.markPermissionRequested threw", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function combinePermissionStatuses(
  statuses: readonly SmsPermissionStatus[]
): SmsPermissionStatus {
  if (statuses.every((status) => status === "granted")) {
    return "granted";
  }

  if (statuses.some((status) => status === "blocked")) {
    return "blocked";
  }

  return "undetermined";
}

async function getLiveSmsPermissionStatuses(): Promise<
  readonly [SmsPermissionStatus, SmsPermissionStatus]
> {
  const [readStatus, receiveStatus] = await Promise.all(
    LIVE_SMS_PERMISSIONS.map((permission) =>
      getNativeSmsPermissionStatus(permission)
    )
  );

  return [readStatus, receiveStatus];
}

function getMissingLiveSmsPermissions(
  statuses: readonly [SmsPermissionStatus, SmsPermissionStatus]
): Permission[] {
  return LIVE_SMS_PERMISSIONS.filter(
    (_, index) => statuses[index] !== "granted"
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to manage SMS permission lifecycle.
 *
 * - On mount, checks current permission status
 * - Provides `requestPermission()` to trigger native dialog
 * - Provides `openSettings()` for blocked state
 * - Returns `denied` on iOS with `isAndroid: false`
 */
export function useSmsPermission(): UseSmsPermissionResult {
  const [status, setStatus] = useState<SmsPermissionStatus>("undetermined");
  const [liveDetectionStatus, setLiveDetectionStatus] =
    useState<SmsPermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(true);
  const isAndroid = Platform.OS === "android";

  /**
   * Check the current permission state without requesting.
   *
   * NOTE: Android's `PermissionsAndroid.check()` only returns a boolean — it
   * cannot distinguish between "undetermined", "denied", and "blocked".
   * Only `request()` returns that detail. Therefore, when `check()` reports
   * non-granted, we must PRESERVE the current status instead of resetting it
   * to "undetermined", otherwise a recheck (e.g. on AppState change after
   * the native dialog closes) would clobber the "denied"/"blocked" result
   * from a prior request and make the Allow button appear to do nothing.
   */
  const checkPermission = useCallback(async (): Promise<void> => {
    if (!isAndroid) {
      setStatus("denied");
      setLiveDetectionStatus("denied");
      setIsLoading(false);
      return;
    }

    try {
      const [readStatus, receiveStatus] = await getLiveSmsPermissionStatuses();
      setStatus(readStatus);
      setLiveDetectionStatus(
        combinePermissionStatuses([readStatus, receiveStatus])
      );
    } catch (error: unknown) {
      // Preserve the current status (don't clobber denied/blocked) but make
      // the failure observable — otherwise permission regressions on
      // Android updates would be silent and hard to diagnose.
      logger.warn("PermissionsAndroid.check(SMS permissions) threw", {
        error: error instanceof Error ? error.message : String(error),
      });
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
        await markNativeSmsPermissionRequested(READ_SMS_PERMISSION);
        const result = await PermissionsAndroid.request(READ_SMS_PERMISSION);
        const newStatus = statusFromRequestResult(result);

        setStatus(newStatus);
        if (newStatus !== "granted") {
          setLiveDetectionStatus(newStatus);
        }
        return newStatus;
      } catch (error: unknown) {
        logger.warn("PermissionsAndroid.request(READ_SMS) threw", {
          error: error instanceof Error ? error.message : String(error),
        });
        setStatus("denied");
        setLiveDetectionStatus("denied");
        return "denied";
      }
    }, [isAndroid]);

  /**
   * Request the permissions needed for live SMS detection.
   */
  const requestLiveDetectionPermission =
    useCallback(async (): Promise<SmsPermissionStatus> => {
      if (!isAndroid) {
        return "denied";
      }

      try {
        const currentStatuses = await getLiveSmsPermissionStatuses();
        const missingPermissions =
          getMissingLiveSmsPermissions(currentStatuses);

        if (missingPermissions.length === 0) {
          setStatus("granted");
          setLiveDetectionStatus("granted");
          return "granted";
        }

        await Promise.all(
          missingPermissions.map((permission) =>
            markNativeSmsPermissionRequested(permission)
          )
        );
        const results =
          await PermissionsAndroid.requestMultiple(missingPermissions);
        const requestStatus = statusFromCombinedRequestResults(
          missingPermissions.map(
            (permission) =>
              results[permission] ?? PermissionsAndroid.RESULTS.DENIED
          )
        );
        const [readStatus, receiveStatus] =
          await getLiveSmsPermissionStatuses();
        const checkedLiveStatus = combinePermissionStatuses([
          readStatus,
          receiveStatus,
        ]);
        const liveStatus =
          checkedLiveStatus === "granted" ? "granted" : requestStatus;

        setStatus(readStatus);
        setLiveDetectionStatus(liveStatus);
        return liveStatus;
      } catch (error: unknown) {
        logger.warn(
          "PermissionsAndroid.request(SMS live detection permissions) threw",
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
        setStatus("denied");
        setLiveDetectionStatus("denied");
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
    liveDetectionStatus,
    isAndroid,
    isLoading,
    requestPermission,
    requestLiveDetectionPermission,
    openSettings,
    recheckPermission,
  };
}
