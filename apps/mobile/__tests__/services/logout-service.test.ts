/**
 * @file logout-service.test.ts
 * @description Unit tests for the logout service (Facade for sync → DB reset → session management).
 *
 * Mock strategy: inline factory pattern (mock infra defined inside jest.mock
 * factory) with __mocks re-export for typed access — same pattern as
 * sms-sync-service.test.ts.
 */

import type { Database } from "@nozbe/watermelondb";

// =============================================================================
// Mock: AsyncStorage
// =============================================================================

jest.mock("@react-native-async-storage/async-storage", () => {
  const getItem = jest.fn((): Promise<string | null> => Promise.resolve(null));
  const setItem = jest.fn((): Promise<void> => Promise.resolve());
  const removeItem = jest.fn((): Promise<void> => Promise.resolve());
  const multiRemove = jest.fn((): Promise<void> => Promise.resolve());
  return {
    __esModule: true,
    default: { getItem, setItem, removeItem, multiRemove },
    __mocks: { getItem, setItem, removeItem, multiRemove },
  };
});

interface AsyncStorageMocks {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  multiRemove: jest.Mock;
}

function getAsyncStorageMocks(): AsyncStorageMocks {
  return jest.requireMock<{ __mocks: AsyncStorageMocks }>(
    "@react-native-async-storage/async-storage"
  ).__mocks;
}

// =============================================================================
// Mock: NetInfo
// =============================================================================

jest.mock("@react-native-community/netinfo", () => {
  const fetchFn = jest.fn(() => Promise.resolve({ isConnected: true }));
  return {
    fetch: fetchFn,
    __mocks: { fetch: fetchFn },
  };
});

interface NetInfoMocks {
  fetch: jest.Mock;
}

function getNetInfoMocks(): NetInfoMocks {
  return jest.requireMock<{ __mocks: NetInfoMocks }>(
    "@react-native-community/netinfo"
  ).__mocks;
}

// =============================================================================
// Mock: sync.ts
// =============================================================================

jest.mock("@/services/sync", () => {
  const syncDatabase = jest.fn((): Promise<void> => Promise.resolve());
  const resetSyncState = jest.fn((): Promise<void> => Promise.resolve());
  const getActiveSyncPromise = jest.fn((): Promise<void> | null => null);
  return {
    syncDatabase,
    resetSyncState,
    getActiveSyncPromise,
    __mocks: { syncDatabase, resetSyncState, getActiveSyncPromise },
  };
});

interface SyncMocks {
  syncDatabase: jest.Mock;
  resetSyncState: jest.Mock;
  getActiveSyncPromise: jest.Mock;
}

function getSyncMocks(): SyncMocks {
  return jest.requireMock<{ __mocks: SyncMocks }>("@/services/sync").__mocks;
}

// =============================================================================
// Mock: supabase
// =============================================================================

jest.mock("@/services/supabase", () => {
  const signOut = jest.fn(() => Promise.resolve({ error: null }));
  return {
    supabase: { auth: { signOut } },
    __mocks: { signOut },
  };
});

interface SupabaseMocks {
  signOut: jest.Mock;
}

function getSupabaseMocks(): SupabaseMocks {
  return jest.requireMock<{ __mocks: SupabaseMocks }>("@/services/supabase")
    .__mocks;
}

// =============================================================================
// Mock: storage-keys
// =============================================================================

jest.mock("@/constants/storage-keys", () => ({
  LOGOUT_IN_PROGRESS_KEY: "@astik/logout-in-progress",
  CLEARABLE_USER_KEYS: ["@astik/first-use-date"],
}));

// =============================================================================
// Import module under test (after mocks)
// =============================================================================

import {
  performLogout,
  completeInterruptedLogout,
} from "@/services/logout-service";

// =============================================================================
// Helpers
// =============================================================================

function createMockDatabase(): Database {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database is a complex class; empty stub is sufficient for unit tests
  return {} as Database;
}

// =============================================================================
// Tests
// =============================================================================

describe("logout-service", () => {
  let db: Database;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDatabase();

    // Restore default mock implementations after clearAllMocks wipes factory defaults
    const asyncMocks = getAsyncStorageMocks();
    const netInfoMocks = getNetInfoMocks();
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    asyncMocks.getItem.mockResolvedValue(null);
    asyncMocks.setItem.mockResolvedValue(undefined);
    asyncMocks.removeItem.mockResolvedValue(undefined);
    asyncMocks.multiRemove.mockResolvedValue(undefined);
    netInfoMocks.fetch.mockResolvedValue({ isConnected: true });
    syncMocks.syncDatabase.mockResolvedValue(undefined);
    syncMocks.resetSyncState.mockResolvedValue(undefined);
    syncMocks.getActiveSyncPromise.mockReturnValue(null);
    supaMocks.signOut.mockResolvedValue({ error: null });
  });

  // =========================================================================
  // Test 1: Happy path — full logout sequence (correct order)
  // =========================================================================
  it("should complete full logout sequence in correct order", async () => {
    const callOrder: string[] = [];
    const asyncMocks = getAsyncStorageMocks();
    const netInfoMocks = getNetInfoMocks();
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    asyncMocks.setItem.mockImplementation(() => {
      callOrder.push("setFlag");
      return Promise.resolve();
    });
    netInfoMocks.fetch.mockImplementation(() => {
      callOrder.push("networkCheck");
      return Promise.resolve({ isConnected: true });
    });
    syncMocks.syncDatabase.mockImplementation(() => {
      callOrder.push("sync");
      return Promise.resolve();
    });
    syncMocks.resetSyncState.mockImplementation(() => {
      callOrder.push("resetDB");
      return Promise.resolve();
    });
    asyncMocks.multiRemove.mockImplementation(() => {
      callOrder.push("clearKeys");
      return Promise.resolve();
    });
    supaMocks.signOut.mockImplementation(() => {
      callOrder.push("signOut");
      return Promise.resolve({ error: null });
    });

    const result = await performLogout(db);

    expect(result).toEqual({ success: true });
    expect(callOrder).toEqual([
      "networkCheck",
      "sync",
      "setFlag",
      "resetDB",
      "clearKeys",
      "signOut",
    ]);
    expect(asyncMocks.removeItem).toHaveBeenCalledWith(
      "@astik/logout-in-progress"
    );
  });

  // =========================================================================
  // Test 2: Network check — offline error (FR-009)
  // =========================================================================
  it("should return no_network error when device is offline", async () => {
    const netInfoMocks = getNetInfoMocks();
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();
    netInfoMocks.fetch.mockResolvedValue({ isConnected: false });

    const result = await performLogout(db);

    expect(result).toEqual({ success: false, error: "no_network" });
    expect(syncMocks.syncDatabase).not.toHaveBeenCalled();
    expect(syncMocks.resetSyncState).not.toHaveBeenCalled();
    expect(supaMocks.signOut).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Test 3: Sync retry — first fails, retry succeeds (FR-013)
  // =========================================================================
  it("should retry sync once and succeed on second attempt", async () => {
    const syncMocks = getSyncMocks();
    let callCount = 0;
    syncMocks.syncDatabase.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Network timeout"));
      }
      return Promise.resolve();
    });

    const result = await performLogout(db);

    expect(result).toEqual({ success: true });
    expect(syncMocks.syncDatabase).toHaveBeenCalledTimes(2);
    expect(syncMocks.resetSyncState).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Test 4: Sync failure after retry — returns sync_failed (FR-013)
  // =========================================================================
  it("should return sync_failed when both sync attempts fail", async () => {
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    syncMocks.syncDatabase.mockRejectedValue(new Error("Server unreachable"));

    const result = await performLogout(db);

    expect(result).toEqual({ success: false, error: "sync_failed" });
    expect(syncMocks.syncDatabase).toHaveBeenCalledTimes(2);
    expect(syncMocks.resetSyncState).not.toHaveBeenCalled();
    expect(supaMocks.signOut).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Test 5: Force-proceed — skips sync (post-warning flow)
  // =========================================================================
  it("should skip sync and proceed with reset when forceSkipSync is true", async () => {
    const netInfoMocks = getNetInfoMocks();
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    const result = await performLogout(db, true);

    expect(result).toEqual({ success: true });
    expect(netInfoMocks.fetch).not.toHaveBeenCalled();
    expect(syncMocks.syncDatabase).not.toHaveBeenCalled();
    expect(syncMocks.resetSyncState).toHaveBeenCalledTimes(1);
    expect(supaMocks.signOut).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Test 6: AsyncStorage cleanup — user keys cleared, hasOnboarded preserved (FR-007)
  // =========================================================================
  it("should clear user-specific keys but not device-level keys", async () => {
    const asyncMocks = getAsyncStorageMocks();

    const result = await performLogout(db);

    expect(result).toEqual({ success: true });
    expect(asyncMocks.multiRemove).toHaveBeenCalledWith([
      "@astik/first-use-date",
    ]);
    const clearedKeys = (
      asyncMocks.multiRemove.mock.calls as string[][][]
    )[0][0];
    expect(clearedKeys).not.toContain("hasOnboarded");
  });

  // =========================================================================
  // Test 7: Force-close recovery (FR-012)
  // =========================================================================
  describe("completeInterruptedLogout", () => {
    it("should complete reset when logout_in_progress flag is present", async () => {
      const asyncMocks = getAsyncStorageMocks();
      const syncMocks = getSyncMocks();
      const supaMocks = getSupabaseMocks();

      asyncMocks.getItem.mockResolvedValue("true");

      await completeInterruptedLogout(db);

      expect(syncMocks.resetSyncState).toHaveBeenCalledTimes(1);
      expect(asyncMocks.multiRemove).toHaveBeenCalledTimes(1);
      expect(supaMocks.signOut).toHaveBeenCalledTimes(1);
      expect(asyncMocks.removeItem).toHaveBeenCalledWith(
        "@astik/logout-in-progress"
      );
    });

    it("should do nothing when logout_in_progress flag is absent", async () => {
      const syncMocks = getSyncMocks();
      const supaMocks = getSupabaseMocks();

      await completeInterruptedLogout(db);

      expect(syncMocks.resetSyncState).not.toHaveBeenCalled();
      expect(supaMocks.signOut).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Test 8: DB reset failure — still clears session (FR-008)
  // =========================================================================
  it("should still clear session even when DB reset fails", async () => {
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    syncMocks.resetSyncState.mockRejectedValue(new Error("SQLite lock error"));

    const result = await performLogout(db);

    expect(result).toEqual({ success: false, error: "unknown" });
    expect(supaMocks.signOut).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Test 9: Awaits active sync before triggering new one
  // =========================================================================
  it("should await active sync promise before triggering a new sync", async () => {
    const syncMocks = getSyncMocks();
    const callOrder: string[] = [];

    const activeSyncPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        callOrder.push("activeSyncDone");
        resolve();
      }, 10);
    });
    syncMocks.getActiveSyncPromise.mockReturnValue(activeSyncPromise);
    syncMocks.syncDatabase.mockImplementation(() => {
      callOrder.push("newSync");
      return Promise.resolve();
    });

    const result = await performLogout(db);

    expect(result).toEqual({ success: true });
    expect(callOrder).toEqual(["activeSyncDone", "newSync"]);
  });

  // =========================================================================
  // Test 10: Times out when active sync never resolves
  // =========================================================================
  it("should time out if active sync promise never resolves and proceed to fresh sync", async () => {
    jest.useFakeTimers();
    const syncMocks = getSyncMocks();
    const netInfoMocks = getNetInfoMocks();

    netInfoMocks.fetch.mockResolvedValue({ isConnected: true });

    // A promise that never resolves (simulates a hung sync)
    const neverResolvingPromise = new Promise<void>(() => {});
    syncMocks.getActiveSyncPromise.mockReturnValue(neverResolvingPromise);
    syncMocks.syncDatabase.mockResolvedValue(undefined);

    const logoutPromise = performLogout(db);

    // Advance past the 10s active sync timeout and flush microtasks
    await jest.advanceTimersByTimeAsync(10_000);

    const result = await logoutPromise;

    expect(result).toEqual({ success: true });
    expect(syncMocks.syncDatabase).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
