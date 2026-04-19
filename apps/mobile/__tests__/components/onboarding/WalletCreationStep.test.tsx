/**
 * Unit tests for WalletCreationStep.
 *
 * Regression guard (T031) for PR #238 review Finding #1:
 *   "WalletCreationStep must NOT call completeOnboarding itself — the
 *    onboarding screen (parent) owns the DB write + cursor clear so it can
 *    await the write before navigation. Duplicating the call caused a race."
 *
 * These tests verify:
 * - ensureCashAccount is called with (userId, currency) on mount.
 * - completeOnboarding (from profile-service) is NEVER called from this
 *   component — only `onComplete` / `onError` callbacks are invoked.
 * - On success, tapping "Let's Go!" forwards `onComplete`.
 * - On error, tapping "Let's Go!" forwards `onError`.
 */

import React from "react";

interface ReactTestRendererInstance {
  toJSON: () => unknown;
  root: {
    findAllByType: (type: unknown) => Array<{ props: Record<string, unknown> }>;
  };
  unmount: () => void;
}
interface ReactTestRendererModule {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

const mockEnsureCashAccount = jest.fn();
const mockCompleteOnboarding = jest.fn();

jest.mock("@/services/account-service", () => ({
  ensureCashAccount: (
    ...args: unknown[]
  ): Promise<{
    created: boolean;
    accountId: string | null;
    error: string | null;
  }> =>
    mockEnsureCashAccount(...args) as Promise<{
      created: boolean;
      accountId: string | null;
      error: string | null;
    }>,
}));

// Regression guard — if this component ever imports completeOnboarding, the
// mock factory exposes it so the test can assert it is NEVER invoked.
jest.mock("@/services/profile-service", () => ({
  completeOnboarding: (...args: unknown[]): Promise<void> =>
    mockCompleteOnboarding(...args) as Promise<void>,
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: (): {
    theme: { backgroundGradient: string[] };
    isDark: boolean;
  } => ({
    theme: { backgroundGradient: ["#000", "#111"] },
    isDark: false,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: (): { top: number; bottom: number } => ({
    top: 0,
    bottom: 0,
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (): { t: (key: string) => string } => ({
    t: (key: string): string => key,
  }),
}));

jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require("react-native");
  // Each entering/exiting builder needs .duration(), .delay(), .springify()
  // to chain indefinitely. Return a Proxy that echoes any chained call.
  const chainable: unknown = new Proxy(
    {},
    {
      get: (): unknown => (): unknown => chainable,
    }
  );
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  return {
    __esModule: true,
    default: { View: RN.View, createAnimatedComponent: (c: unknown) => c },
    View: RN.View,
    FadeIn: chainable,
    FadeOut: chainable,
    ZoomIn: chainable,
  };
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
});

jest.mock("expo-linear-gradient", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require("react-native");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const ReactMod = require("react");
  return {
    LinearGradient: (props: Record<string, unknown>): unknown =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ReactMod.createElement(RN.View, props),
  };
});

// =============================================================================
// Under test
// =============================================================================

import { WalletCreationStep } from "@/components/onboarding/WalletCreationStep";
import { TouchableOpacity } from "react-native";

// =============================================================================
// Helpers
// =============================================================================

async function renderStep(
  overrides: Partial<{
    userId: string;
    currency: "EGP" | "USD";
    onComplete: () => void;
    onError: () => void;
  }> = {}
): Promise<ReactTestRendererInstance> {
  let renderer!: ReactTestRendererInstance;
  await RTR.act(() => {
    renderer = RTR.create(
      React.createElement(WalletCreationStep, {
        userId: overrides.userId ?? "user-1",
        currency: (overrides.currency ?? "EGP") as "EGP",
        onComplete: overrides.onComplete ?? jest.fn(),
        onError: overrides.onError ?? jest.fn(),
      })
    );
  });
  // Flush the createWallet() promise chain.
  await RTR.act(async () => {
    await Promise.resolve();
  });
  return renderer;
}

function tapContinue(renderer: ReactTestRendererInstance): void {
  const buttons = renderer.root.findAllByType(TouchableOpacity);
  const onPress = buttons[0]?.props.onPress as (() => void) | undefined;
  if (!onPress) throw new Error("No TouchableOpacity with onPress found");
  onPress();
}

// =============================================================================
// Tests
// =============================================================================

describe("WalletCreationStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls ensureCashAccount with (userId, currency) on mount", async () => {
    mockEnsureCashAccount.mockResolvedValue({
      created: true,
      accountId: "acc-1",
      error: null,
    });

    await renderStep({ userId: "user-abc", currency: "EGP" });

    expect(mockEnsureCashAccount).toHaveBeenCalledTimes(1);
    expect(mockEnsureCashAccount).toHaveBeenCalledWith("user-abc", "EGP");
  });

  it("never calls completeOnboarding from inside the component — that is the parent's responsibility (Finding #1)", async () => {
    mockEnsureCashAccount.mockResolvedValue({
      created: true,
      accountId: "acc-1",
      error: null,
    });

    const renderer = await renderStep();
    tapContinue(renderer);
    // Flush any post-tap microtasks before asserting.
    await RTR.act(async () => {
      await Promise.resolve();
    });

    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
  });

  it("invokes onComplete (not onError) when ensureCashAccount succeeds and the user taps continue", async () => {
    mockEnsureCashAccount.mockResolvedValue({
      created: true,
      accountId: "acc-1",
      error: null,
    });
    const onComplete = jest.fn();
    const onError = jest.fn();

    const renderer = await renderStep({ onComplete, onError });
    tapContinue(renderer);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("invokes onError (not onComplete) when ensureCashAccount returns an error", async () => {
    mockEnsureCashAccount.mockResolvedValue({
      created: false,
      accountId: null,
      error: "network",
    });
    const onComplete = jest.fn();
    const onError = jest.fn();

    const renderer = await renderStep({ onComplete, onError });
    tapContinue(renderer);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
