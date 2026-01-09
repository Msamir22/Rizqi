/**
 * Sync Context and Provider
 * Provides sync status and functions to the app with smart sync intervals
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { database } from "@astik/db";
import { syncDatabase } from "../services/sync";
import { isAuthenticated } from "../services/supabase";

// Sync intervals in milliseconds
const SYNC_INTERVAL_ACTIVE = 15 * 60 * 1000; // 15 minutes when app is active
const SYNC_INTERVAL_BACKGROUND = 30 * 60 * 1000; // 30 minutes when backgrounded

interface SyncContextValue {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: Error | null;
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps): JSX.Element {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sync = useCallback(async () => {
    // Check if authenticated before syncing
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      console.log("Sync skipped: Not authenticated");
      return;
    }

    if (isSyncing) {
      console.log("Sync already in progress");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await syncDatabase(database);
      setLastSyncedAt(new Date());
      console.log("✅ Sync completed successfully");
    } catch (error) {
      console.error("Sync failed:", error);
      setSyncError(error instanceof Error ? error : new Error("Sync failed"));
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  /**
   * Check if local database is empty (data was cleared)
   * If empty and user is authenticated, trigger immediate sync
   */
  const checkDataClearedAndSync = useCallback(async (): Promise<void> => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) return;

      // Check if accounts collection is empty
      const accountsCollection = database.get("accounts");
      const count = await accountsCollection.query().fetchCount();

      if (count === 0) {
        console.log("📱 Local DB empty - triggering immediate sync");
        await sync();
      }
    } catch (error) {
      console.error("Error checking data cleared status:", error);
    }
  }, [sync]);

  /**
   * Set up the sync interval based on app state
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
      const intervalName = isActive
        ? "15 minutes (active)"
        : "30 minutes (background)";

      console.log(`⏰ Sync interval set to ${intervalName}`);

      syncIntervalRef.current = setInterval(async () => {
        const authenticated = await isAuthenticated();
        if (authenticated) {
          sync();
        }
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
        console.log("📱 App returned to foreground");
        // Sync immediately when returning to foreground
        sync();
        setupSyncInterval(true);
      }

      // App went to background
      if (appState === "active" && nextAppState.match(/inactive|background/)) {
        console.log("📱 App went to background");
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
      // First check if data was cleared
      await checkDataClearedAndSync();

      // Then do normal initial sync
      const authenticated = await isAuthenticated();
      if (authenticated) {
        await sync();
      }

      // Set up initial interval (app starts active)
      setupSyncInterval(true);
    };

    initialSync();

    // Cleanup interval on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: SyncContextValue = {
    isSyncing,
    lastSyncedAt,
    syncError,
    sync,
  };

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
