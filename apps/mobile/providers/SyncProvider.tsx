/**
 * Sync Context and Provider
 * Provides sync status and functions to the app with smart sync intervals
 */

import { database } from "@astik/db";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { ensureAuthenticated, isAuthenticated } from "../services/supabase";
import { syncDatabase } from "../services/sync";

// Sync intervals in milliseconds
const SYNC_INTERVAL_ACTIVE = 15 * 60 * 1000; // 15 minutes when app is active
const SYNC_INTERVAL_BACKGROUND = 30 * 60 * 1000; // 30 minutes when backgrounded

interface SyncContextValue {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: Error | null;
  sync: (forceFullSync?: boolean) => Promise<void>;
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

  const sync = useCallback(async (forceFullSync = false): Promise<void> => {
    // Check if authenticated before syncing
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      console.log("Sync skipped: Not authenticated");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Concurrency guard is handled inside syncDatabase (module-level lock in sync.ts)
      await syncDatabase(database, forceFullSync);
      setLastSyncedAt(new Date());
      console.log("✅ Sync completed successfully");
    } catch (error) {
      console.error("Sync failed:", error);
      setSyncError(error instanceof Error ? error : new Error("Sync failed"));
    } finally {
      setIsSyncing(false);
    }
  }, []);

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

      syncIntervalRef.current = setInterval(() => {
        isAuthenticated()
          .then((authenticated) => {
            if (authenticated) {
              sync().catch(console.error);
            }
          })
          .catch(console.error);
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
        sync().catch(console.error);
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
      // First ensure user is authenticated (creates anonymous user if needed)
      const isAuthed = await ensureAuthenticated();
      if (!isAuthed) {
        console.log("⚠️ Auth failed - sync will not run");
        setupSyncInterval(true); // Still set up interval for retry
        return;
      }

      // Check if data was cleared (empty local DB but authenticated)
      // checkDataClearedAndSync will call sync(true) if DB is empty,
      // so we only do a regular sync if the DB wasn't empty
      const accountsCollection = database.get("accounts");
      const count = await accountsCollection.query().fetchCount();

      if (count === 0) {
        console.log("📱 Local DB empty - triggering full sync from server");
        await sync(true);
      } else {
        await sync();
      }

      // Set up initial interval (app starts active)
      setupSyncInterval(true);
    };

    initialSync().catch(console.error);

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
