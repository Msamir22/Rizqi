/**
 * useSmsPermission.test.ts — T014
 *
 * Tests the `useSmsPermission` hook from
 * apps/mobile/hooks/useSmsPermission.ts.
 *
 * Mock Strategy:
 *   - `react-native` is mocked to control Platform.OS, PermissionsAndroid,
 *     AppState, and Linking
 *   - A lightweight renderHook utility uses React.createElement + a ref
 *     pattern to capture hook return values
 *
 * Coverage:
 *   - Initial state: undetermined + loading
 *   - iOS fallback: denied + isAndroid=false
 *   - Android permission check: granted / undetermined
 *   - requestPermission: granted / denied / blocked / error
 *   - openSettings: delegates to Linking
 *   - recheckPermission: resets loading + re-checks
 *   - AppState foreground recheck (T045)
 */

import React from "react";

// ---------------------------------------------------------------------------
// react-test-renderer — manual types & import
// ---------------------------------------------------------------------------

/** Minimal shape of the renderer instance returned by RTR.create(). */
interface ReactTestRendererInstance {
  unmount: () => void;
}

/**
 * Minimal shape of the react-test-renderer module.
 * No @types/react-test-renderer is installed, so we declare the subset we need.
 * `act` is typed loosely here to avoid overload-resolution headaches;
 * the properly-typed `actSync` / `actAsync` wrappers below cast it once.
 */
interface ReactTestRendererModule {
  act: (...args: unknown[]) => unknown;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

/**
 * Synchronous `act()` wrapper.
 * At runtime `act(syncFn)` returns `void`.
 */
const actSync = RTR.act as (fn: () => void) => void;

/**
 * Asynchronous `act()` wrapper.
 * At runtime `act(asyncFn)` returns `Promise<void>`.
 */
const actAsync = RTR.act as (fn: () => Promise<void>) => Promise<void>;

// ---------------------------------------------------------------------------
// react-native mock helpers (defined before jest.mock)
// ---------------------------------------------------------------------------

type AppStateListener = (state: string) => void;

let mockPlatformOS = "android";

const mockCheck = jest.fn<Promise<boolean>, [string]>(() =>
  Promise.resolve(false)
);

const mockRequest = jest.fn<Promise<string>, [string, Record<string, string>]>(
  () => Promise.resolve("granted")
);

const mockOpenSettings = jest.fn(() => Promise.resolve());

let appStateListeners: AppStateListener[] = [];

const mockAppStateRemove = jest.fn();

const mockAppStateAddEventListener = jest.fn(
  (_event: string, listener: AppStateListener) => {
    appStateListeners.push(listener);
    return { remove: mockAppStateRemove };
  }
);

// ---------------------------------------------------------------------------
// jest.mock for react-native
// ---------------------------------------------------------------------------

jest.mock("react-native", () => ({
  Platform: {
    get OS(): string {
      return mockPlatformOS;
    },
  },
  PermissionsAndroid: {
    PERMISSIONS: { READ_SMS: "android.permission.READ_SMS" },
    RESULTS: {
      GRANTED: "granted",
      DENIED: "denied",
      NEVER_ASK_AGAIN: "never_ask_again",
    },
    check: (...args: unknown[]) => mockCheck(...(args as [string])),
    request: (...args: unknown[]) =>
      mockRequest(...(args as [string, Record<string, string>])),
  },
  Linking: {
    openSettings: () => mockOpenSettings(),
  },
  AppState: {
    currentState: "active",
    addEventListener: (...args: unknown[]) =>
      mockAppStateAddEventListener(...(args as [string, AppStateListener])),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import { useSmsPermission } from "@/hooks/useSmsPermission";

// ---------------------------------------------------------------------------
// Lightweight renderHook utility
// ---------------------------------------------------------------------------

interface HookRef<T> {
  current: T | null;
}

/**
 * Safely unwrap the hook ref value, throwing if null.
 * Prevents non-null assertion lint violations across tests.
 */
function unwrap<T>(ref: HookRef<T>): T {
  if (ref.current === null) {
    throw new Error("Hook ref is null — did the component render?");
  }
  return ref.current;
}

/**
 * Minimal renderHook implementation using React.createElement.
 * Captures the hook return value via a ref updated on every render.
 *
 * Returns: { result, rerender, unmount }
 */
function renderHook<T>(hookFn: () => T): {
  result: HookRef<T>;
  rerender: () => void;
  unmount: () => void;
} {
  const result: HookRef<T> = { current: null };
  let forceUpdate: (() => void) | null = null;

  function TestComponent(): null {
    result.current = hookFn();
    const [, setState] = React.useState(0);
    forceUpdate = () => setState((n) => n + 1);
    return null;
  }

  let renderer: ReactTestRendererInstance;

  actSync(() => {
    renderer = RTR.create(React.createElement(TestComponent));
  });

  return {
    result,
    rerender: () => {
      actSync(() => {
        forceUpdate?.();
      });
    },
    unmount: () => {
      actSync(() => {
        renderer.unmount();
      });
    },
  };
}

/**
 * Flush all pending promises (microtask queue).
 */
async function flushPromises(): Promise<void> {
  await actAsync(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSmsPermission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOS = "android";
    appStateListeners = [];
    mockCheck.mockResolvedValue(false);
    mockRequest.mockResolvedValue("granted");
  });

  // =========================================================================
  // Initial State
  // =========================================================================
  describe("initial state", () => {
    it("should start with undetermined status and isLoading=true", () => {
      const { result } = renderHook(() => useSmsPermission());

      expect(result.current).not.toBeNull();
      expect(unwrap(result).status).toBe("undetermined");
      expect(unwrap(result).isLoading).toBe(true);
    });

    it("should resolve to granted on mount when permission is already granted", async () => {
      mockCheck.mockResolvedValue(true);

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).status).toBe("granted");
      expect(unwrap(result).isLoading).toBe(false);
    });

    it("should resolve to undetermined on mount when permission is not yet granted", async () => {
      mockCheck.mockResolvedValue(false);

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).status).toBe("undetermined");
      expect(unwrap(result).isLoading).toBe(false);
    });

    it("should handle check errors gracefully (fallback to undetermined)", async () => {
      mockCheck.mockRejectedValue(new Error("Native module error"));

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).status).toBe("undetermined");
      expect(unwrap(result).isLoading).toBe(false);
    });
  });

  // =========================================================================
  // iOS Fallback
  // =========================================================================
  describe("iOS fallback", () => {
    beforeEach(() => {
      mockPlatformOS = "ios";
    });

    it("should return denied status on iOS", async () => {
      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).status).toBe("denied");
      expect(unwrap(result).isAndroid).toBe(false);
      expect(unwrap(result).isLoading).toBe(false);
    });

    it("should not call PermissionsAndroid.check on iOS", async () => {
      renderHook(() => useSmsPermission());
      await flushPromises();

      expect(mockCheck).not.toHaveBeenCalled();
    });

    it("requestPermission should return denied on iOS", async () => {
      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      let permResult: string | undefined;
      await actAsync(async () => {
        permResult = await unwrap(result).requestPermission();
      });

      expect(permResult).toBe("denied");
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // requestPermission — Android
  // =========================================================================
  describe("requestPermission", () => {
    it("should return granted when user allows", async () => {
      mockRequest.mockResolvedValue("granted");

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      let permResult: string | undefined;
      await actAsync(async () => {
        permResult = await unwrap(result).requestPermission();
      });

      expect(permResult).toBe("granted");
      expect(unwrap(result).status).toBe("granted");
    });

    it("should return denied when user declines", async () => {
      mockRequest.mockResolvedValue("denied");

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      let permResult: string | undefined;
      await actAsync(async () => {
        permResult = await unwrap(result).requestPermission();
      });

      expect(permResult).toBe("denied");
      expect(unwrap(result).status).toBe("denied");
    });

    it("should return blocked when user selects never_ask_again", async () => {
      mockRequest.mockResolvedValue("never_ask_again");

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      let permResult: string | undefined;
      await actAsync(async () => {
        permResult = await unwrap(result).requestPermission();
      });

      expect(permResult).toBe("blocked");
      expect(unwrap(result).status).toBe("blocked");
    });

    it("should return denied when request throws an error", async () => {
      mockRequest.mockRejectedValue(new Error("Native error"));

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      let permResult: string | undefined;
      await actAsync(async () => {
        permResult = await unwrap(result).requestPermission();
      });

      expect(permResult).toBe("denied");
      expect(unwrap(result).status).toBe("denied");
    });
  });

  // =========================================================================
  // openSettings
  // =========================================================================
  describe("openSettings", () => {
    it("should delegate to Linking.openSettings", async () => {
      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      await actAsync(async () => {
        await unwrap(result).openSettings();
      });

      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // recheckPermission
  // =========================================================================
  describe("recheckPermission", () => {
    it("should set isLoading=true then re-check", async () => {
      mockCheck.mockResolvedValue(false);

      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).isLoading).toBe(false);
      expect(unwrap(result).status).toBe("undetermined");

      // User goes to settings, grants permission
      mockCheck.mockResolvedValue(true);

      await actAsync(async () => {
        await unwrap(result).recheckPermission();
      });

      expect(unwrap(result).status).toBe("granted");
      expect(unwrap(result).isLoading).toBe(false);
    });
  });

  // =========================================================================
  // isAndroid flag
  // =========================================================================
  describe("isAndroid", () => {
    it("should return true on Android", async () => {
      mockPlatformOS = "android";
      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).isAndroid).toBe(true);
    });

    it("should return false on iOS", async () => {
      mockPlatformOS = "ios";
      const { result } = renderHook(() => useSmsPermission());
      await flushPromises();

      expect(unwrap(result).isAndroid).toBe(false);
    });
  });

  // =========================================================================
  // AppState foreground recheck (T045)
  // =========================================================================
  describe("AppState foreground recheck", () => {
    it("should subscribe to AppState changes on Android", async () => {
      renderHook(() => useSmsPermission());
      await flushPromises();

      expect(mockAppStateAddEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });

    it("should not subscribe to AppState changes on iOS", async () => {
      mockPlatformOS = "ios";
      renderHook(() => useSmsPermission());
      await flushPromises();

      expect(mockAppStateAddEventListener).not.toHaveBeenCalled();
    });

    it("should remove AppState listener on unmount", async () => {
      const { unmount } = renderHook(() => useSmsPermission());
      await flushPromises();

      unmount();

      expect(mockAppStateRemove).toHaveBeenCalledTimes(1);
    });
  });
});
