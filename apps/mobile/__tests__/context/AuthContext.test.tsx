import React from "react";
import { Text } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]): Promise<unknown> =>
        mockGetSession(...args) as Promise<unknown>,
      onAuthStateChange: (...args: unknown[]): unknown =>
        mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]): Promise<unknown> =>
        mockSignOut(...args) as Promise<unknown>,
    },
  },
}));

function AuthProbe(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Text testID="auth-state">
      {isLoading ? "loading" : isAuthenticated ? "authenticated" : "anonymous"}
    </Text>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockUnsubscribe,
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("releases auth loading when session bootstrap hangs", async () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const screen = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByText("loading")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => {
      expect(screen.getByText("anonymous")).toBeTruthy();
    });
  });

  it("applies the bootstrapped session when it resolves before timeout", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
    });

    const screen = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("authenticated")).toBeTruthy();
    });
  });
});
