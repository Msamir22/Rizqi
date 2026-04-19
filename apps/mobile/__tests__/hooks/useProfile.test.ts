/**
 * Unit tests for useProfile hook.
 *
 * Validates that the hook:
 * - Calls the WatermelonDB observe pipeline correctly
 * - Returns the expected interface shape
 * - Returns an object with profile and isLoading
 *
 * Note: Full subscription lifecycle testing is handled through
 * integration tests in the routing gate. These tests verify
 * the mock wiring and initial return shape.
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

// ---------------------------------------------------------------------------
// Mock: WatermelonDB observable
// ---------------------------------------------------------------------------

let activeSubscriber: {
  next: (value: unknown[]) => void;
  error: (err: unknown) => void;
} | null = null;

const mockSubscribe = jest.fn(
  (subscriber: {
    next: (value: unknown[]) => void;
    error: (err: unknown) => void;
  }) => {
    activeSubscriber = subscriber;
    return {
      unsubscribe: jest.fn(() => {
        activeSubscriber = null;
      }),
    };
  }
);

const mockObserve = jest.fn(() => ({ subscribe: mockSubscribe }));

const mockQuery = jest.fn(() => ({ observe: mockObserve }));

jest.mock("@rizqi/db", () => ({
  database: {
    get: jest.fn(() => ({
      query: mockQuery,
    })),
  },
  Profile: {},
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: { where: jest.fn(() => "mock-where"), take: jest.fn(() => "mock-take") },
}));

// Import after mocks
import { useProfile } from "../../hooks/useProfile";

// ---------------------------------------------------------------------------
// Lightweight renderHook
// ---------------------------------------------------------------------------

interface HookResult {
  profile: unknown;
  isLoading: boolean;
}

function renderHook(): {
  result: React.MutableRefObject<HookResult>;
  unmount: () => void;
} {
  const resultRef: React.MutableRefObject<HookResult> =
    React.createRef() as React.MutableRefObject<HookResult>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!resultRef.current) {
    resultRef.current = { profile: null, isLoading: true };
  }

  const HookWrapper = (): React.JSX.Element | null => {
    const hookVal = useProfile();
    resultRef.current = hookVal;
    return null;
  };

  const renderer = RTR.create(React.createElement(HookWrapper));
  return { result: resultRef, unmount: () => renderer.unmount() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  activeSubscriber = null;
});

describe("useProfile", () => {
  it("starts with isLoading=true and profile=null", () => {
    const { result } = renderHook();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("sets up a WatermelonDB observation on mount", () => {
    renderHook();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(activeSubscriber).not.toBeNull();
  });

  it("returns an unsubscribe function from the subscription (cleanup contract)", () => {
    renderHook();
    const subscription = mockSubscribe.mock.results[0].value as {
      unsubscribe: () => void;
    };
    expect(subscription).toHaveProperty("unsubscribe");
    expect(typeof subscription.unsubscribe).toBe("function");
  });
});
