/**
 * @file SyncProvider.test.tsx
 * @description Unit tests for SyncProvider's new initialSyncState and retryInitialSync.
 *
 * Tests the state machine: in-progress → success | failed | timeout,
 * the 20-second timeout race, and retryInitialSync().
 */

import React from "react";

// ---------------------------------------------------------------------------
// Test renderer utilities
// ---------------------------------------------------------------------------

interface ReactTestRendererInstance {
  unmount: () => void;
}

interface ReactTestRendererModule {
  act: (...args: unknown[]) => unknown;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

const actSync = RTR.act as (fn: () => void) => void;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSyncDatabase = jest.fn();
const mockCheckIsAuthenticated = jest.fn();
const mockCompleteInterruptedLogout = jest.fn();

jest.mock("@/services/sync", () => ({
  syncDatabase: (...args: unknown[]): Promise<unknown> =>
    mockSyncDatabase(...args) as Promise<unknown>,
}));

jest.mock("@/services/supabase", () => ({
  isAuthenticated: (): Promise<boolean> =>
    mockCheckIsAuthenticated() as Promise<boolean>,
}));

jest.mock("@/services/logout-service", () => ({
  completeInterruptedLogout: (...args: unknown[]): Promise<void> =>
    mockCompleteInterruptedLogout(...args) as Promise<void>,
}));

jest.mock("@rizqi/db", () => ({
  database: {
    get: jest.fn(() => ({
      query: () => ({ fetchCount: jest.fn().mockResolvedValue(0) }),
    })),
  },
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

// Import after mocks
import { SyncProvider, useSync } from "../../providers/SyncProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SyncContextSnapshot {
  initialSyncState: string;
  retryInitialSync: () => Promise<string>;
}

function renderAndCapture(): {
  result: React.MutableRefObject<SyncContextSnapshot>;
  unmount: () => void;
} {
  const resultRef =
    React.createRef() as React.MutableRefObject<SyncContextSnapshot>;

  const CaptureComponent = (): React.JSX.Element | null => {
    const { initialSyncState, retryInitialSync } = useSync();
    resultRef.current = { initialSyncState, retryInitialSync };
    return null;
  };

  const renderer = RTR.create(
    React.createElement(
      SyncProvider,
      null,
      React.createElement(CaptureComponent)
    )
  );

  return { result: resultRef, unmount: () => renderer.unmount() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncProvider initialSyncState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCheckIsAuthenticated.mockResolvedValue(true);
    mockCompleteInterruptedLogout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with initialSyncState "in-progress"', () => {
    mockSyncDatabase.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderAndCapture();
    expect(result.current.initialSyncState).toBe("in-progress");
  });

  it('transitions to "success" when sync completes within timeout', async () => {
    mockSyncDatabase.mockResolvedValue(undefined);
    const { result } = renderAndCapture();

    // Flush all pending promises
    await jest.runAllTimersAsync();
    actSync(() => {
      // No-op - just trigger a React update
    });

    expect(result.current.initialSyncState).toBe("success");
  });

  it('transitions to "failed" when sync throws before timeout', async () => {
    mockSyncDatabase.mockRejectedValue(new Error("Network error"));
    const { result } = renderAndCapture();

    await jest.runAllTimersAsync();
    actSync(() => {
      // No-op - just trigger a React update
    });

    expect(result.current.initialSyncState).toBe("failed");
  });

  it('transitions to "timeout" when sync takes longer than 20 seconds', () => {
    // Sync never resolves
    mockSyncDatabase.mockReturnValue(new Promise(() => {}));
    const { result } = renderAndCapture();

    // Advance past 20-second timeout
    actSync(() => {
      jest.advanceTimersByTime(20000);
    });

    expect(result.current.initialSyncState).toBe("timeout");
  });

  it("provides retryInitialSync as a callable function", () => {
    mockSyncDatabase.mockReturnValue(new Promise(() => {}));
    const { result } = renderAndCapture();
    expect(typeof result.current.retryInitialSync).toBe("function");
  });
});
