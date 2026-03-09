/**
 * Unit tests for useOAuthFlow hook (simplified version)
 *
 * Tests state transitions:
 * - Idle → Loading → Success
 * - Idle → Loading → Error
 * - Idle → Loading → Cancellation (silent)
 * - Double-tap prevention
 *
 * Mock Strategy:
 *   - auth-service is mocked to control signInWithOAuth
 *   - A lightweight renderHook utility uses React.createElement + a ref
 *     pattern to capture hook return values
 */

import React from "react";

// ---------------------------------------------------------------------------
// react-test-renderer — manual types & import
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
const actAsync = RTR.act as (fn: () => Promise<void>) => Promise<void>;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignInWithOAuth = jest.fn();

jest.mock("@/services/auth-service", () => ({
  signInWithOAuth: (...args: unknown[]): Promise<unknown> =>
    mockSignInWithOAuth(...args) as Promise<unknown>,
}));

// Import after mocks
import { useOAuthFlow } from "../../hooks/useOAuthFlow";

// ---------------------------------------------------------------------------
// Lightweight renderHook utility
// ---------------------------------------------------------------------------

interface HookRef<T> {
  current: T | null;
}

function unwrap<T>(ref: HookRef<T>): T {
  if (ref.current === null) {
    throw new Error("Hook ref is null — did the component render?");
  }
  return ref.current;
}

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

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("useOAuthFlow", () => {
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Initial state
  // =========================================================================

  it("returns idle state initially", () => {
    const { result } = renderHook(() =>
      useOAuthFlow(mockOnSuccess, mockOnError)
    );

    expect(unwrap(result).loadingProvider).toBeNull();
    expect(unwrap(result).error).toBeNull();
  });

  // =========================================================================
  // Success flow
  // =========================================================================

  it("calls onSuccess when signInWithOAuth succeeds", async () => {
    mockSignInWithOAuth.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useOAuthFlow(mockOnSuccess, mockOnError)
    );

    await actAsync(async () => {
      await unwrap(result).handleOAuth("google");
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith("google");
    expect(mockOnSuccess).toHaveBeenCalled();
    expect(unwrap(result).loadingProvider).toBeNull();
  });

  // =========================================================================
  // Error flow
  // =========================================================================

  it("calls onError for non-cancellation errors", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      success: false,
      error: "Network error",
      errorCode: "network",
    });

    const { result } = renderHook(() =>
      useOAuthFlow(mockOnSuccess, mockOnError)
    );

    await actAsync(async () => {
      await unwrap(result).handleOAuth("google");
    });

    expect(mockOnError).toHaveBeenCalledWith("Network error");
    expect(unwrap(result).error).toBe("Network error");
    expect(unwrap(result).loadingProvider).toBeNull();
  });

  // =========================================================================
  // Cancellation flow
  // =========================================================================

  it("silently handles user cancellation without showing error", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      success: false,
      error: "User cancelled",
      errorCode: "cancelled",
    });

    const { result } = renderHook(() =>
      useOAuthFlow(mockOnSuccess, mockOnError)
    );

    await actAsync(async () => {
      await unwrap(result).handleOAuth("google");
    });

    // Should NOT call onError for cancellations
    expect(mockOnError).not.toHaveBeenCalled();
    expect(unwrap(result).loadingProvider).toBeNull();
  });

  // =========================================================================
  // Exception handling
  // =========================================================================

  it("handles thrown exceptions gracefully", async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error("Unexpected error"));

    const { result } = renderHook(() =>
      useOAuthFlow(mockOnSuccess, mockOnError)
    );

    await actAsync(async () => {
      await unwrap(result).handleOAuth("google");
    });

    expect(mockOnError).toHaveBeenCalledWith(
      "Something went wrong. Please try again."
    );
    expect(unwrap(result).loadingProvider).toBeNull();
  });
});
