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
  act: (cb: () => void | Promise<void>) => void;
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

jest.mock("@monyvi/db", () => ({ database: {} }));

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
  // Use fake timers for the whole suite. The gate schedules a setTimeout
  // (PROFILE_OBSERVATION_GRACE_MS) inside its useEffect whenever sync has
  // settled but profile is still null; on real timers, that callback fires
  // ~4s after a test ends, attempts to setState on an unmounted tree, and
  // crashes the next test by reading mocks that beforeEach has just cleared.
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders the loader (NOT null) while sync is still in progress — keeps the screen non-blank under the InitialSyncOverlay fade-in", () => {
    setState({ syncState: "in-progress" });
    const renderer = renderGate();
    // No redirect, no retry — just the BootLoadingView.
    expect(findRedirectHref(renderer)).toBeUndefined();
    expect(
      renderer.root.findAllByProps({ testID: "retry-screen" })
    ).toHaveLength(0);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("renders the loader (NOT null) while the profile is still loading (even after sync success)", () => {
    setState({ syncState: "success", isProfileLoading: true });
    const renderer = renderGate();
    expect(findRedirectHref(renderer)).toBeUndefined();
    expect(
      renderer.root.findAllByProps({ testID: "retry-screen" })
    ).toHaveLength(0);
    expect(renderer.toJSON()).not.toBeNull();
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
    // Should render the BootLoadingView (themed loader during the grace
    // window) — NOT a redirect to /onboarding, and NOT null/blank
    // (AppReadyGate has already released the native splash by this point,
    // so a `null` here would surface a blank screen — see
    // BootLoadingView in app/index.tsx).
    expect(findRedirectHref(renderer)).toBeUndefined();
    expect(
      renderer.root.findAllByProps({ testID: "retry-screen" })
    ).toHaveLength(0);
    // Loader present (ActivityIndicator is rendered).
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const ActivityIndicator = require("react-native").ActivityIndicator;
    expect(
      renderer.root.findAllByType(
        ActivityIndicator as unknown as React.ComponentType
      ).length
    ).toBeGreaterThan(0);
  });

  it("renders loader (no redirect, no retry) when sync is in-progress and profile is null", () => {
    setState({ syncState: "in-progress", profileNull: true });
    const renderer = renderGate();
    expect(findRedirectHref(renderer)).toBeUndefined();
    expect(
      renderer.root.findAllByProps({ testID: "retry-screen" })
    ).toHaveLength(0);
    expect(renderer.toJSON()).not.toBeNull();
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

  // Bounded escape hatch — the post-sync race-guard MUST NOT trap the user on
  // a loading screen indefinitely when sync reports "success" but the profile
  // observation never produces a row. An authenticated user MUST have a
  // profile (DB trigger creates one on signup), so this state is a data
  // inconsistency — surface RetrySyncScreen so the user has a path forward
  // (sign out + try again) rather than falling through to /onboarding and
  // overwriting potentially-existing cloud data (user-report 2026-04-27).
  //
  // NOTE: RetrySyncScreen is a temporary stand-in for this branch — sync
  // technically succeeded, so "Couldn't load your account" + Retry isn't
  // a perfect fit. The intended replacement is a dedicated
  // ContactSupportScreen (see TODO in app/index.tsx). When that lands,
  // update this test's expectation accordingly.
  it("escapes to retry screen after the grace period elapses when sync=success but profile stays null (data inconsistency — RetrySyncScreen is a temporary stand-in until ContactSupportScreen exists)", () => {
    setState({ syncState: "success", profileNull: true });

    // Wrap initial render in act() so the useEffect that schedules the
    // grace timer actually runs (in legacy react-test-renderer mode the
    // effect would otherwise not commit until the next external trigger).
    let renderer: ReactTestRendererInstance | undefined;
    RTR.act(() => {
      renderer = renderGate();
    });
    if (!renderer) throw new Error("renderer not initialised");

    // Before grace elapses → BootLoadingView, NO redirect, NO retry.
    expect(findRedirectHref(renderer)).toBeUndefined();
    expect(
      renderer.root.findAllByProps({ testID: "retry-screen" })
    ).toHaveLength(0);

    // Advance past the 4s grace window so the bounded timer fires AND
    // flush the resulting setState through act() so the tree re-renders.
    RTR.act(() => {
      jest.advanceTimersByTime(5_000);
    });

    // After grace → retry screen. NEVER /onboarding — that would skip
    // an already-onboarded user past their data on the next sync.
    const hits = renderer.root.findAllByProps({ testID: "retry-screen" });
    expect(hits.length).toBeGreaterThan(0);
    expect(findRedirectHref(renderer)).toBeUndefined();
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
