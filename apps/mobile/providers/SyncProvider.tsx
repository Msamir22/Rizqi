/**
 * Sync Context and Provider
 * Provides sync status and functions to the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { database } from "@astik/db";
import { syncDatabase } from "../services/sync";
import { isAuthenticated } from "../services/supabase";

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
    } catch (error) {
      console.error("Sync failed:", error);
      setSyncError(error instanceof Error ? error : new Error("Sync failed"));
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Auto-sync on mount (if authenticated)
  useEffect(() => {
    const initialSync = async (): Promise<void> => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        await sync();
      }
    };
    initialSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up periodic sync (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(
      async () => {
        const authenticated = await isAuthenticated();
        if (authenticated) {
          sync();
        }
      },
      5 * 60 * 1000
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [sync]);

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
