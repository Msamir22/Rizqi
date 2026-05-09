/**
 * @file SyncProvider.test.tsx
 * @description Unit tests for SyncProvider's initialSyncState and retryInitialSync.
 */

import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";

const mockSyncDatabase = jest.fn();
const mockCheckIsAuthenticated = jest.fn();
const mockFetchProfileCount = jest.fn();
const mockDbGet = jest.fn();

interface MockAuthState {
  readonly isAuthenticated: boolean;
  readonly user?: { readonly id?: string };
}

const mockUseAuth = jest.fn<MockAuthState, []>(() => ({
  isAuthenticated: true,
  user: { id: "current-user" },
}));
const mockWhere = jest.fn((column: string, value: unknown) => ({
  column,
  value,
}));

jest.mock("@/services/sync", () => ({
  syncDatabase: (...args: unknown[]): Promise<unknown> =>
    mockSyncDatabase(...args) as Promise<unknown>,
}));

jest.mock("@/services/supabase", () => ({
  isAuthenticated: (): Promise<boolean> =>
    mockCheckIsAuthenticated() as Promise<boolean>,
}));

jest.mock("@monyvi/db", () => ({
  database: {
    get: (table: string): unknown => mockDbGet(table),
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    where: (column: string, value: unknown): unknown =>
      mockWhere(column, value),
  },
}));

import { SyncProvider, useSync } from "../../providers/SyncProvider";

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

  function CaptureComponent(): null {
    const { initialSyncState, retryInitialSync } = useSync();
    resultRef.current = { initialSyncState, retryInitialSync };
    return null;
  }

  const renderer = render(
    React.createElement(
      SyncProvider,
      null,
      React.createElement(CaptureComponent)
    )
  );

  return { result: resultRef, unmount: renderer.unmount };
}

describe("SyncProvider initialSyncState", () => {
  let lastUnmount: (() => void) | null = null;

  beforeEach((): void => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCheckIsAuthenticated.mockResolvedValue(true);
    mockFetchProfileCount.mockResolvedValue(0);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "current-user" },
    });
    mockDbGet.mockReturnValue({
      query: jest.fn(() => ({ fetchCount: mockFetchProfileCount })),
    });
  });

  afterEach((): void => {
    lastUnmount?.();
    lastUnmount = null;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function advancePastInitialSyncTimeout(): Promise<void> {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_500);
    });
  }

  async function waitForInitialSyncState(
    result: React.MutableRefObject<SyncContextSnapshot>,
    expectedState: string
  ): Promise<void> {
    await waitFor(() =>
      expect(result.current?.initialSyncState).toBe(expectedState)
    );
  }

  it('starts with initialSyncState "in-progress"', (): void => {
    mockFetchProfileCount.mockReturnValue(new Promise(() => {}));
    mockSyncDatabase.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderAndCapture();
    lastUnmount = unmount;
    expect(result.current.initialSyncState).toBe("in-progress");
  });

  it('transitions to "success" when sync completes within timeout', async (): Promise<void> => {
    mockSyncDatabase.mockResolvedValue(undefined);
    const { result } = renderAndCapture();

    await waitForInitialSyncState(result, "success");

    expect(result.current.initialSyncState).toBe("success");
  });

  it("checks the current user's profile instead of accounts before trusting local startup data", async (): Promise<void> => {
    mockFetchProfileCount.mockResolvedValue(1);
    mockSyncDatabase.mockResolvedValue(undefined);
    const { result } = renderAndCapture();

    await waitForInitialSyncState(result, "success");

    expect(mockDbGet).toHaveBeenCalledWith("profiles");
    expect(mockWhere).toHaveBeenCalledWith("user_id", "current-user");
    expect(mockWhere).toHaveBeenCalledWith("deleted", false);
    expect(mockSyncDatabase).toHaveBeenCalledWith(expect.anything(), false);
    expect(result.current.initialSyncState).toBe("success");
  });

  it('transitions to "failed" when auth is true but the user id is missing', async (): Promise<void> => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {},
    });
    mockSyncDatabase.mockResolvedValue(undefined);
    const { result } = renderAndCapture();

    await waitForInitialSyncState(result, "failed");

    expect(mockDbGet).not.toHaveBeenCalledWith("profiles");
    expect(mockSyncDatabase).not.toHaveBeenCalled();
    expect(result.current.initialSyncState).toBe("failed");
  });

  it('transitions to "failed" when sync throws before timeout', async (): Promise<void> => {
    mockSyncDatabase.mockRejectedValue(new Error("Network error"));
    const { result } = renderAndCapture();

    await waitForInitialSyncState(result, "failed");

    expect(result.current.initialSyncState).toBe("failed");
  });

  it('transitions to "timeout" when sync takes longer than 20 seconds', async (): Promise<void> => {
    mockSyncDatabase.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderAndCapture();
    lastUnmount = unmount;

    await advancePastInitialSyncTimeout();
    await waitForInitialSyncState(result, "timeout");

    expect(result.current.initialSyncState).toBe("timeout");
  });

  it("provides retryInitialSync as a callable function", (): void => {
    mockFetchProfileCount.mockReturnValue(new Promise(() => {}));
    mockSyncDatabase.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderAndCapture();
    lastUnmount = unmount;
    expect(typeof result.current.retryInitialSync).toBe("function");
  });
});
