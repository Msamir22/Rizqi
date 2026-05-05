/**
 * Unit tests for AppReadyGate — composite splash-hide coordinator.
 *
 * Validates:
 * - Splash is NOT hidden while initialSyncState is "in-progress".
 * - Splash is NOT hidden while the profile is still loading (for authenticated users).
 * - Splash IS hidden once sync settles AND profile is loaded.
 * - Unauthenticated users don't gate on sync/profile — splash hides as soon
 *   as auth resolves.
 * - SplashScreen.hideAsync is called at most once per session.
 * - When profile.preferredLanguage differs from i18n.language, the language
 *   is applied BEFORE splash hides.
 */

import React from "react";
import type { PendingSignupLocale } from "@/services/intro-flag-service";

// react-test-renderer has no TS types; minimal shape used by this test.
interface ReactTestRendererInstance {
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}
interface ReactTestRendererModule {
  act: {
    (fn: () => Promise<void>): Promise<void>;
    (fn: () => void): void;
  };
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { language: "en" },
}));

jest.mock("@/i18n/changeLanguage", () => ({
  changeLanguage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the three hooks the gate consumes. Tests override return values per case.
const mockUseAuth = jest.fn();
const mockUseSync = jest.fn();
const mockUseProfile = jest.fn();
const mockReadPendingSignupLocale = jest.fn<
  Promise<PendingSignupLocale | null>,
  []
>();
const mockClearPendingSignupLocale = jest.fn<Promise<void>, []>();

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): unknown => mockUseAuth(),
}));

jest.mock("@/providers/SyncProvider", () => ({
  useSync: (): unknown => mockUseSync(),
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: (): unknown => mockUseProfile(),
}));

jest.mock("@/services/profile-service", () => ({
  setPreferredLanguage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/intro-flag-service", () => ({
  readPendingSignupLocale: (): Promise<unknown> =>
    mockReadPendingSignupLocale(),
  clearPendingSignupLocale: (): Promise<void> => mockClearPendingSignupLocale(),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import * as SplashScreen from "expo-splash-screen";
import { changeLanguage } from "@/i18n/changeLanguage";
import { setPreferredLanguage } from "@/services/profile-service";
import { AppReadyGate } from "@/components/AppReadyGate";

const mockHideAsync = SplashScreen.hideAsync as jest.Mock;
const mockChangeLanguage = changeLanguage as jest.Mock;
const mockSetPreferredLanguage = setPreferredLanguage as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadPendingSignupLocale.mockResolvedValue(null);
  mockClearPendingSignupLocale.mockResolvedValue(undefined);
});

async function flushPromises(): Promise<void> {
  await RTR.act(async () => {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
  });
}

// =============================================================================
// Helpers
// =============================================================================

function setState(opts: {
  authIsLoading: boolean;
  isAuthenticated: boolean;
  user?: { readonly email?: string } | null;
  initialSyncState?: "in-progress" | "success" | "failed" | "timeout";
  profileIsLoading?: boolean;
  profile?: Record<string, unknown> | null;
}): void {
  mockUseAuth.mockReturnValue({
    isLoading: opts.authIsLoading,
    isAuthenticated: opts.isAuthenticated,
    user: opts.user ?? null,
  });
  mockUseSync.mockReturnValue({
    initialSyncState: opts.initialSyncState ?? "in-progress",
  });
  mockUseProfile.mockReturnValue({
    profile: opts.profile ?? null,
    isLoading: opts.profileIsLoading ?? true,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("AppReadyGate", () => {
  it("does NOT hide splash while auth is still loading", async (): Promise<void> => {
    setState({ authIsLoading: true, isAuthenticated: false });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it("does NOT hide splash while initial sync is in-progress (authenticated)", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "in-progress",
      profileIsLoading: false,
      profile: { preferredLanguage: "en" },
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it("does NOT hide splash while profile is still loading (authenticated)", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "success",
      profileIsLoading: true,
      profile: null,
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it("hides splash once sync + profile are ready (authenticated)", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "success",
      profileIsLoading: false,
      profile: { preferredLanguage: "en" },
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("hides splash immediately once auth resolves (unauthenticated)", async (): Promise<void> => {
    // Unauthenticated users don't gate on sync or profile.
    setState({
      authIsLoading: false,
      isAuthenticated: false,
      initialSyncState: "in-progress",
      profileIsLoading: true,
      profile: null,
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("hides splash on sync failure (retry path)", async (): Promise<void> => {
    // Failed sync counts as "not in-progress", so the splash should hide
    // and the retry screen can render.
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "failed",
      profileIsLoading: false,
      profile: null,
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("hides splash on sync timeout", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "timeout",
      profileIsLoading: false,
      profile: null,
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("applies the user's stored language BEFORE hiding splash", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "success",
      profileIsLoading: false,
      profile: { preferredLanguage: "ar" }, // differs from i18n.language = "en"
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockChangeLanguage).toHaveBeenCalledWith("ar");
    expect(mockHideAsync).toHaveBeenCalledTimes(1);

    // changeLanguage should have been invoked before hideAsync.
    const changeLanguageOrder = mockChangeLanguage.mock.invocationCallOrder[0];
    const hideAsyncOrder = mockHideAsync.mock.invocationCallOrder[0];
    expect(changeLanguageOrder).toBeLessThan(hideAsyncOrder);
  });

  it("persists the pending signup language for a matching new profile before hiding splash", async (): Promise<void> => {
    const signupCreatedAt = "2026-05-05T10:00:00.000Z";
    mockReadPendingSignupLocale.mockResolvedValue({
      email: "new@example.com",
      language: "ar",
      createdAt: signupCreatedAt,
    });
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      user: { email: "new@example.com" },
      initialSyncState: "success",
      profileIsLoading: false,
      profile: {
        preferredLanguage: "en",
        onboardingCompleted: false,
        createdAt: new Date("2026-05-05T10:00:03.000Z"),
      },
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockSetPreferredLanguage).toHaveBeenCalledWith("ar");
    expect(mockClearPendingSignupLocale).toHaveBeenCalledTimes(1);
    expect(mockHideAsync).toHaveBeenCalledTimes(1);

    const setLanguageOrder =
      mockSetPreferredLanguage.mock.invocationCallOrder[0];
    const hideAsyncOrder = mockHideAsync.mock.invocationCallOrder[0];
    expect(setLanguageOrder).toBeLessThan(hideAsyncOrder);
  });

  it("keeps the stored profile language when an existing user signs in after changing auth-screen language", async (): Promise<void> => {
    mockReadPendingSignupLocale.mockResolvedValue({
      email: "returning@example.com",
      language: "ar",
      createdAt: "2026-05-05T10:00:00.000Z",
    });
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      user: { email: "returning@example.com" },
      initialSyncState: "success",
      profileIsLoading: false,
      profile: {
        preferredLanguage: "en",
        onboardingCompleted: false,
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
      },
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockSetPreferredLanguage).not.toHaveBeenCalled();
    expect(mockChangeLanguage).not.toHaveBeenCalled();
    expect(mockClearPendingSignupLocale).toHaveBeenCalledTimes(1);
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("does NOT call changeLanguage when stored language matches current i18n", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "success",
      profileIsLoading: false,
      profile: { preferredLanguage: "en" }, // matches mocked i18n.language
    });

    RTR.act(() => {
      RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockChangeLanguage).not.toHaveBeenCalled();
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("hides splash at most once even if inputs re-resolve", async (): Promise<void> => {
    setState({
      authIsLoading: false,
      isAuthenticated: true,
      initialSyncState: "success",
      profileIsLoading: false,
      profile: { preferredLanguage: "en" },
    });

    let renderer: ReactTestRendererInstance | null = null;
    RTR.act(() => {
      renderer = RTR.create(React.createElement(AppReadyGate));
    });
    await flushPromises();

    // Re-render with the same (ready) state — should NOT call hideAsync again.
    RTR.act(() => {
      renderer?.update(React.createElement(AppReadyGate));
    });
    await flushPromises();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });
});
