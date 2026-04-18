/**
 * Sync Context and Provider
 * Provides sync status and functions to the app with smart sync intervals
 */

import { database } from "@rizqi/db";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "../context/AuthContext";
import { isAuthenticated as checkIsAuthenticated } from "../services/supabase";
import { completeInterruptedLogout } from "../services/logout-service";
import { syncDatabase } from "../services/sync";

// Sync intervals in milliseconds
const SYNC_INTERVAL_ACTIVE = 15 * 60 * 1000; // 15 minutes when app is active
const SYNC_INTERVAL_BACKGROUND = 30 * 60 * 1000; // 30 minutes when backgrounded

/** Timeout for the initial pull-sync before declaring failure (FR-006). */
const INITIAL_SYNC_TIMEOUT_MS = 20_000;

/** State machine for the initial pull-sync that gates post-sign-in routing. */
export type InitialSyncState = "in-progress" | "success" | "failed" | "timeout";

interface SyncContextValue {
  isSyncing: boolean;
  isInitialSync: boolean;
  lastSyncedAt: Date | null;
  syncError: Error | null;
  sync: (forceFullSync?: boolean) => Promise<void>;
  /** Resolved after the initial pull-sync completes or times out. */
  readonly initialSyncState: InitialSyncState;
  /** Re-trigger the initial sync. Returns the new state when resolved. */
  readonly retryInitialSync: () => Promise<InitialSyncState>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps): JSX.Element {
  const { isAuthenticated } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialSync, setIsInitialSync] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );
  const [initialSyncState, setInitialSyncState] =
    useState<InitialSyncState>("in-progress");

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sync = useCallback(async (forceFullSync = false): Promise<void> => {
    // Check if authenticated before syncing
    const authenticated = await checkIsAuthenticated();
    if (!authenticated) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Concurrency guard is handled inside syncDatabase (module-level lock in sync.ts)
      await syncDatabase(database, forceFullSync);
      setLastSyncedAt(new Date());
    } catch (error) {
      const syncErr = error instanceof Error ? error : new Error("Sync failed");
      setSyncError(syncErr);
      throw syncErr;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Runs the initial sync with a 20-second timeout race.
   * Returns the final InitialSyncState.
   */
  const runInitialSync = useCallback(async (): Promise<InitialSyncState> => {
    setInitialSyncState("in-progress");

    let syncResult: InitialSyncState = "success";

    try {
      await Promise.race([
        sync(true),
        new Promise<never>((_resolve, reject) => {
          setTimeout(
            () => reject(new Error("initial-sync-timeout")),
            INITIAL_SYNC_TIMEOUT_MS
          );
        }),
      ]);
    } catch (error) {
      syncResult =
        error instanceof Error && error.message === "initial-sync-timeout"
          ? "timeout"
          : "failed";
    }

    setInitialSyncState(syncResult);
    return syncResult;
  }, [sync]);

  /** Re-trigger the initial sync from the retry screen. */
  const retryInitialSync = useCallback(async (): Promise<InitialSyncState> => {
    return runInitialSync();
  }, [runInitialSync]);

  /**
   * Set up the sync interval based on app state.
   *
   * The interval callback checks authentication via an async call
   * to avoid closing over the potentially stale `isAuthenticated` prop.
   */
  const setupSyncInterval = useCallback(
    (isActive: boolean) => {
      // Clear existing interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      const interval = isActive
        ? SYNC_INTERVAL_ACTIVE
        : SYNC_INTERVAL_BACKGROUND;

      // TODO: Replace with structured logging (e.g., Sentry)

      syncIntervalRef.current = setInterval(() => {
        // Use async auth check instead of closed-over isAuthenticated
        // to avoid stale closure issues
        const runSync = async (): Promise<void> => {
          try {
            const authenticated = await checkIsAuthenticated();
            if (authenticated) {
              await sync();
            }
          } catch {
            // TODO: Replace with structured logging (e.g., Sentry)
          }
        };
        runSync().catch(() => {
          // TODO: Replace with structured logging (e.g., Sentry)
        });
      }, interval);
    },
    [sync]
  );

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      const wasBackground = appState.match(/inactive|background/);
      const isNowActive = nextAppState === "active";

      // App came to foreground from background
      if (wasBackground && isNowActive) {
        // TODO: Replace with structured logging (e.g., Sentry)
        // Sync immediately when returning to foreground
        sync().catch(() => {
          // TODO: Replace with structured logging (e.g., Sentry)
        });
        setupSyncInterval(true);
      }

      // App went to background
      if (appState === "active" && nextAppState.match(/inactive|background/)) {
        // TODO: Replace with structured logging (e.g., Sentry)
        setupSyncInterval(false);
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => subscription.remove();
  }, [appState, sync, setupSyncInterval]);

  // Initial sync on mount + data cleared detection
  useEffect(() => {
    const initialSync = async (): Promise<void> => {
      // FR-012: Complete any interrupted logout from a force-close
      await completeInterruptedLogout(database);

      // Check user is authenticated before syncing
      if (!isAuthenticated) {
        setupSyncInterval(true);
        setInitialSyncState("success");
        return;
      }

      // Check if data was cleared (empty local DB but authenticated)
      const accountsCollection = database.get("accounts");
      const count = await accountsCollection.query().fetchCount();

      if (count === 0) {
        setIsInitialSync(true);
        await runInitialSync();
        setIsInitialSync(false);
      } else {
        // Non-empty DB — data already exists, sync is non-blocking
        await sync();
        setInitialSyncState("success");
      }

      // Set up initial interval (app starts active)
      setupSyncInterval(true);
    };

    initialSync().catch(() => {
      setInitialSyncState("failed");
    });

    // Cleanup interval on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo<SyncContextValue>(
    () => ({
      isSyncing,
      isInitialSync,
      lastSyncedAt,
      syncError,
      sync,
      initialSyncState,
      retryInitialSync,
    }),
    [
      isSyncing,
      isInitialSync,
      lastSyncedAt,
      syncError,
      sync,
      initialSyncState,
      retryInitialSync,
    ]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/**
 * Hook to access sync context
 */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
