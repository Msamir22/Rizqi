/**
 * @file logout-service.test.ts
 * @description Unit tests for the fast logout service contract.
 */

import type { Database } from "@nozbe/watermelondb";

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

jest.mock("@/services/sync", () => {
  const resetSyncState = jest.fn((): Promise<void> => Promise.resolve());
  const getActiveSyncPromise = jest.fn((): Promise<void> | null => null);
  return {
    getActiveSyncPromise,
    resetSyncState,
    __mocks: { getActiveSyncPromise, resetSyncState },
  };
});

interface SyncMocks {
  getActiveSyncPromise: jest.Mock;
  resetSyncState: jest.Mock;
}

function getSyncMocks(): SyncMocks {
  return jest.requireMock<{ __mocks: SyncMocks }>("@/services/sync").__mocks;
}

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

jest.mock("@/constants/storage-keys", () => ({
  LOGOUT_IN_PROGRESS_KEY: "@monyvi/logout-in-progress",
  CLEARABLE_USER_KEYS: ["@monyvi/first-use-date"],
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

interface LoggerMocks {
  logger: {
    warn: jest.Mock;
  };
}

function getLoggerMocks(): LoggerMocks {
  return jest.requireMock<LoggerMocks>("@/utils/logger");
}

import {
  completeInterruptedLogout,
  performLogout,
} from "@/services/logout-service";

function createMockDatabase(): Database {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database is a complex class; empty stub is sufficient for unit tests
  return {} as Database;
}

async function flushLogoutCleanup(): Promise<void> {
  await jest.advanceTimersByTimeAsync(300);
  await Promise.resolve();
}

describe("logout-service", () => {
  let db: Database;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    db = createMockDatabase();

    const asyncMocks = getAsyncStorageMocks();
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    asyncMocks.getItem.mockResolvedValue(null);
    asyncMocks.setItem.mockResolvedValue(undefined);
    asyncMocks.removeItem.mockResolvedValue(undefined);
    asyncMocks.multiRemove.mockResolvedValue(undefined);
    syncMocks.getActiveSyncPromise.mockReturnValue(null);
    syncMocks.resetSyncState.mockResolvedValue(undefined);
    supaMocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("returns after session termination and runs local cleanup in the background", async () => {
    const callOrder: string[] = [];
    const asyncMocks = getAsyncStorageMocks();
    const syncMocks = getSyncMocks();
    const supaMocks = getSupabaseMocks();

    asyncMocks.setItem.mockImplementation(() => {
      callOrder.push("setFlag");
      return Promise.resolve();
    });
    supaMocks.signOut.mockImplementation(() => {
      callOrder.push("signOut");
      return Promise.resolve({ error: null });
    });
    syncMocks.resetSyncState.mockImplementation(() => {
      callOrder.push("resetDB");
      return Promise.resolve();
    });
    asyncMocks.multiRemove.mockImplementation(() => {
      callOrder.push("clearKeys");
      return Promise.resolve();
    });
    asyncMocks.removeItem.mockImplementation(() => {
      callOrder.push("removeFlag");
      return Promise.resolve();
    });

    const result = await performLogout(db);

    expect(result).toEqual({ success: true });
    expect(callOrder).toEqual(["setFlag", "signOut"]);

    await flushLogoutCleanup();

    expect(callOrder).toEqual([
      "setFlag",
      "signOut",
      "resetDB",
      "clearKeys",
      "removeFlag",
    ]);
  });

  it("keeps the deprecated forceSkipSync argument as a fast logout path", async () => {
    const result = await performLogout(db, true);

    expect(result).toEqual({ success: true });
    expect(getSupabaseMocks().signOut).toHaveBeenCalledTimes(1);
    expect(getSyncMocks().resetSyncState).not.toHaveBeenCalled();

    await flushLogoutCleanup();

    expect(getSyncMocks().resetSyncState).toHaveBeenCalledTimes(1);
  });

  it("returns unknown and clears the recovery flag if session termination fails", async () => {
    const asyncMocks = getAsyncStorageMocks();
    const supaMocks = getSupabaseMocks();
    supaMocks.signOut.mockRejectedValue(new Error("sign out failed"));

    const result = await performLogout(db);

    expect(result).toEqual({ success: false, error: "unknown" });
    expect(asyncMocks.removeItem).toHaveBeenCalledWith(
      "@monyvi/logout-in-progress"
    );
    expect(getSyncMocks().resetSyncState).not.toHaveBeenCalled();
  });

  it("logs background cleanup failures after successful session termination", async () => {
    const syncMocks = getSyncMocks();
    const loggerMocks = getLoggerMocks();
    syncMocks.resetSyncState.mockRejectedValue(new Error("SQLite lock"));

    const result = await performLogout(db);
    await flushLogoutCleanup();

    expect(result).toEqual({ success: true });
    expect(loggerMocks.logger.warn).toHaveBeenCalledWith(
      "logout.localCleanup.failed",
      { message: "SQLite lock" }
    );
  });

  it("continues cleanup when user preference clearing fails", async () => {
    const asyncMocks = getAsyncStorageMocks();
    asyncMocks.multiRemove.mockRejectedValue(new Error("AsyncStorage failed"));

    const result = await performLogout(db);
    await flushLogoutCleanup();

    expect(result).toEqual({ success: true });
    expect(asyncMocks.removeItem).toHaveBeenCalledWith(
      "@monyvi/logout-in-progress"
    );
  });

  it("waits for an active sync before resetting the local database", async () => {
    const callOrder: string[] = [];
    const syncMocks = getSyncMocks();
    let resolveSync = (): void => {};
    const activeSyncPromise = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });

    syncMocks.getActiveSyncPromise.mockReturnValue(activeSyncPromise);
    syncMocks.resetSyncState.mockImplementation(() => {
      callOrder.push("resetDB");
      return Promise.resolve();
    });

    const result = await performLogout(db);
    expect(result).toEqual({ success: true });

    const cleanupPromise = flushLogoutCleanup();
    await Promise.resolve();
    expect(syncMocks.resetSyncState).not.toHaveBeenCalled();

    callOrder.push("syncSettled");
    resolveSync();
    await cleanupPromise;

    expect(callOrder).toEqual(["syncSettled", "resetDB"]);
  });

  describe("completeInterruptedLogout", () => {
    it("completes local cleanup when the logout recovery flag is present", async () => {
      const asyncMocks = getAsyncStorageMocks();
      asyncMocks.getItem.mockResolvedValue("true");

      const cleanupPromise = completeInterruptedLogout(db);
      await Promise.resolve();
      await flushLogoutCleanup();
      await cleanupPromise;

      expect(getSyncMocks().resetSyncState).toHaveBeenCalledTimes(1);
      expect(asyncMocks.multiRemove).toHaveBeenCalledTimes(1);
      expect(asyncMocks.removeItem).toHaveBeenCalledWith(
        "@monyvi/logout-in-progress"
      );
    });

    it("does nothing when the logout recovery flag is absent", async () => {
      await completeInterruptedLogout(db);

      expect(getSyncMocks().resetSyncState).not.toHaveBeenCalled();
      expect(getSupabaseMocks().signOut).not.toHaveBeenCalled();
    });
  });
});
