/**
 * Unit tests for useProfile hook.
 *
 * Validates that the hook subscribes only while authenticated and exposes the
 * expected profile/loading shape.
 */

import { renderHook } from "@testing-library/react-native";

let mockIsAuthenticated = true;

let activeSubscriber: {
  next: (value: unknown[]) => void;
  error: (err: unknown) => void;
} | null = null;

const mockUnsubscribe = jest.fn(() => {
  activeSubscriber = null;
});

const mockSubscribe = jest.fn(
  (subscriber: {
    next: (value: unknown[]) => void;
    error: (err: unknown) => void;
  }) => {
    activeSubscriber = subscriber;
    return {
      unsubscribe: mockUnsubscribe,
    };
  }
);

const mockObserve = jest.fn(() => ({ subscribe: mockSubscribe }));

const mockQuery = jest.fn(() => ({ observe: mockObserve }));

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): { isAuthenticated: boolean } => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

jest.mock("@monyvi/db", () => ({
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

import { useProfile } from "../../hooks/useProfile";

beforeEach(() => {
  jest.clearAllMocks();
  activeSubscriber = null;
  mockIsAuthenticated = true;
});

describe("useProfile", () => {
  it("starts with isLoading=true and profile=null while authenticated", () => {
    const { result } = renderHook(() => useProfile());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("sets up a WatermelonDB observation while authenticated", () => {
    renderHook(() => useProfile());

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(activeSubscriber).not.toBeNull();
  });

  it("unsubscribes from the observation on unmount", () => {
    const { unmount } = renderHook(() => useProfile());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(activeSubscriber).toBeNull();
  });

  it("does not subscribe while signed out", () => {
    mockIsAuthenticated = false;

    const { result } = renderHook(() => useProfile());

    expect(result.current).toEqual({ profile: null, isLoading: false });
    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});
