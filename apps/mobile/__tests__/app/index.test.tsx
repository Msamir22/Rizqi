/**
 * Integration tests for the post-auth routing gate (T020) at app/index.tsx.
 *
 * FR-012: runs on every post-auth entry — no caching of outcome.
 * Offline-first corollary: an onboarded user routes to the dashboard even
 * when the current sync state is "failed" or "timeout".
 *
 * Tests:
 * - loading state (sync in-progress OR profile loading) renders null.
 * - sync=success + onboardingCompleted=true → dashboard redirect.
 * - sync=success + onboardingCompleted=false → onboarding redirect.
 * - sync=failed  + onboardingCompleted=false → retry screen.
 * - sync=failed  + onboardingCompleted=true  → dashboard (offline-first).
 */

import React from "react";

interface ReactTestRendererInstance {
  root: {
    findAllByProps: (m: Record<string, unknown>) => unknown[];
    findAllByType: (t: unknown) => unknown[];
  };
  toJSON: () => unknown;
  unmount: () => void;
}
interface ReactTestRendererModule {
  create: (el: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

const mockUseSync = jest.fn();
const mockUseProfile = jest.fn();
const mockPerformLogout = jest.fn().mockResolvedValue(undefined);

// Tag the Redirect element with its `href` so the test can assert the target
// without depending on expo-router internals.
jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }): React.ReactElement => {
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    const ReactMod = require("react");
    const RN = require("react-native");
    return ReactMod.createElement(
      RN.View,
      { testID: "redirect", "data-href": props.href },
      null
    ) as React.ReactElement;
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  },
}));

jest.mock("@rizqi/db", () => ({ database: {} }));

jest.mock("@/providers/SyncProvider", () => ({
  useSync: (): unknown => mockUseSync(),
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: (): unknown => mockUseProfile(),
}));

jest.mock("@/services/logout-service", () => ({
  performLogout: (): Promise<void> => mockPerformLogout() as Promise<void>,
}));

jest.mock("@/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// `app/index.tsx` (feature 026) pulls `useAuth` + `useIntroSeen` into the gate.
// Both transitively import `services/supabase.ts`, which throws at module load
// when `EXPO_PUBLIC_SUPABASE_*` env vars are absent (CI does not ship the
// committed `.env` through `npm ci`). Mock these hooks directly so the gate is
// testable in isolation without spinning up a Supabase client.
jest.mock("@/context/AuthContext", () => ({
  useAuth: (): unknown => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

jest.mock("@/hooks/useIntroSeen", () => ({
  useIntroSeen: (): unknown => ({
    isSeen: true,
    isLoading: false,
  }),
}));

// RetrySyncScreen pulled in via the gate — stub that forwards the two
// callbacks onto the node's `onRetry` / `onSignOut` props so tests can
// invoke them via renderer lookup.
jest.mock("@/components/ui/RetrySyncScreen", () => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  const ReactMod = require("react");
  const RN = require("react-native");
  return {
    RetrySyncScreen: (props: {
      onRetry: () => void;
      onSignOut: () => void;
    }): React.ReactElement =>
      ReactMod.createElement(
        RN.View,
        {
          testID: "retry-screen",
          onRetry: props.onRetry,
          onSignOut: props.onSignOut,
        },
        null
      ) as React.ReactElement,
  };
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
});

// =============================================================================
// Under test
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const IndexModule = require("../../app/index.tsx") as {
  default: (props: unknown) => React.ReactNode;
};
const Index = IndexModule.default;

// =============================================================================
// Helpers
// =============================================================================

function setState(opts: {
  syncState: "in-progress" | "success" | "failed" | "timeout";
  isProfileLoading?: boolean;
  onboardingCompleted?: boolean;
  /**
   * When `true`, `useProfile` returns `{ profile: null, isLoading: false }`
   * — the race-condition scenario where the observation has emitted at
   * least once but no row has been pulled into local DB yet.
   */
  profileNull?: boolean;
}): void {
  mockUseSync.mockReturnValue({
    initialSyncState: opts.syncState,
    retryInitialSync: jest.fn().mockResolvedValue(opts.syncState),
  });
  mockUseProfile.mockReturnValue({
    profile: opts.profileNull
      ? null
      : { onboardingCompleted: opts.onboardingCompleted ?? false },
    isLoading: opts.isProfileLoading ?? false,
  });
}

function renderGate(): ReactTestRendererInstance {
  return RTR.create(React.createElement(Index));
}

function findRedirectHref(
  renderer: ReactTestRendererInstance
): string | undefined {
  const hits = renderer.root.findAllByProps({ testID: "redirect" });
  const node = hits[0] as { props?: { [key: string]: unknown } } | undefined;
  return node?.props?.["data-href"] as string | undefined;
}

// =============================================================================
// Tests
// =============================================================================

describe("index.tsx routing gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders null while sync is still in progress", () => {
    setState({ syncState: "in-progress" });
    const renderer = renderGate();
    expect(renderer.toJSON()).toBeNull();
  });

  it("renders null while the profile is still loading (even after sync success)", () => {
    setState({ syncState: "success", isProfileLoading: true });
    const renderer = renderGate();
    expect(renderer.toJSON()).toBeNull();
  });

  it("redirects to /(tabs) when sync succeeded and onboarding is already completed", () => {
    setState({
      syncState: "success",
      onboardingCompleted: true,
    });
    const renderer = renderGate();
    expect(findRedirectHref(renderer)).toBe("/(tabs)");
  });

  it("redirects to /onboarding when sync succeeded and onboarding is NOT completed", () => {
    setState({
      syncState: "success",
      onboardingCompleted: false,
    });
    const renderer = renderGate();
    expect(findRedirectHref(renderer)).toBe("/onboarding");
  });

  it("renders the retry screen when sync failed and the user has NOT onboarded yet", () => {
    setState({
      syncState: "failed",
      onboardingCompleted: false,
    });
    const renderer = renderGate();
    const hits = renderer.root.findAllByProps({ testID: "retry-screen" });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("routes an onboarded user to the dashboard even when sync FAILED — offline-first guarantee", () => {
    setState({
      syncState: "failed",
      onboardingCompleted: true,
    });
    const renderer = renderGate();
    expect(findRedirectHref(renderer)).toBe("/(tabs)");
  });

  it("routes an onboarded user to the dashboard even when sync TIMED OUT — offline-first guarantee", () => {
    setState({
      syncState: "timeout",
      onboardingCompleted: true,
    });
    const renderer = renderGate();
    expect(findRedirectHref(renderer)).toBe("/(tabs)");
  });

  // Race-condition guards — `useProfile.isLoading` flips false on the FIRST
  // observation emission, even if that emission is empty (no profile row in
  // local DB yet). The gate MUST NOT route to /onboarding while sync is
  // settling, otherwise an already-onboarded user gets force-redirected to
  // the Currency step on cold launch (user-report 2026-04-24).
  it("does NOT route to /onboarding when sync succeeded but profile observation is still null", () => {
    setState({ syncState: "success", profileNull: true });
    const renderer = renderGate();
    // Should render null (loading splash held by AppReadyGate), not redirect
    // to /onboarding.
    expect(renderer.toJSON()).toBeNull();
    expect(findRedirectHref(renderer)).toBeUndefined();
  });

  it("does NOT route to /onboarding when sync is in-progress and profile is null", () => {
    setState({ syncState: "in-progress", profileNull: true });
    const renderer = renderGate();
    expect(renderer.toJSON()).toBeNull();
    expect(findRedirectHref(renderer)).toBeUndefined();
  });

  it("falls back to retry screen when sync FAILED AND the profile is still null (escape hatch from the race-guard wait)", () => {
    setState({ syncState: "failed", profileNull: true });
    const renderer = renderGate();
    const hits = renderer.root.findAllByProps({ testID: "retry-screen" });
    expect(hits.length).toBeGreaterThan(0);
    expect(findRedirectHref(renderer)).toBeUndefined();
  });

  it("falls back to retry screen when sync TIMED OUT AND the profile is still null", () => {
    setState({ syncState: "timeout", profileNull: true });
    const renderer = renderGate();
    const hits = renderer.root.findAllByProps({ testID: "retry-screen" });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("wires the retry screen's Sign out callback to performLogout (guards against the gate dropping the handler)", () => {
    setState({ syncState: "failed", onboardingCompleted: false });
    const renderer = renderGate();

    const nodes = renderer.root.findAllByProps({ testID: "retry-screen" });
    const node = nodes[0] as { props: { onSignOut?: () => void } } | undefined;
    expect(node).toBeDefined();

    node?.props.onSignOut?.();

    expect(mockPerformLogout).toHaveBeenCalledTimes(1);
  });

  it("wires the retry screen's Retry callback to retryInitialSync", () => {
    const retrySpy = jest.fn().mockResolvedValue("success");
    mockUseSync.mockReturnValue({
      initialSyncState: "failed",
      retryInitialSync: retrySpy,
    });
    mockUseProfile.mockReturnValue({
      profile: { onboardingCompleted: false },
      isLoading: false,
    });
    const renderer = renderGate();

    const nodes = renderer.root.findAllByProps({ testID: "retry-screen" });
    const node = nodes[0] as { props: { onRetry?: () => void } } | undefined;
    expect(node).toBeDefined();

    node?.props.onRetry?.();

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
