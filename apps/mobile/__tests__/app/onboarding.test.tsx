/**
 * Integration tests for the onboarding screen state machine (T021).
 *
 * Verifies FR-004 resume semantics + FR-011 completion:
 *   - Initial phase is derived from the AsyncStorage cursor per user.
 *   - Missing/null cursor → language-picker.
 *   - "slides" → carousel phase (we assert by which child component renders).
 *   - "currency" → currency-picker.
 *   - "cash-account" + known preferred currency → wallet-creation.
 *   - On "Let's Go!" after wallet creation, `completeOnboarding()` is called
 *     exactly once and navigation happens via router.replace("/(tabs)").
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
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (el: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

const mockReadOnboardingStep = jest.fn();
const mockWriteOnboardingStep = jest.fn().mockResolvedValue(undefined);
const mockCompleteOnboarding = jest.fn().mockResolvedValue(undefined);
const mockSetPreferredLanguage = jest.fn().mockResolvedValue(undefined);
const mockSetPreferredCurrencyAndCreateCashAccount = jest
  .fn()
  .mockResolvedValue(undefined);
const mockUseProfile = jest.fn();
const mockUseAuth = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock("@/services/onboarding-cursor-service", () => ({
  readOnboardingStep: (...args: unknown[]): Promise<string | null> =>
    mockReadOnboardingStep(...args) as Promise<string | null>,
  writeOnboardingStep: (...args: unknown[]): Promise<void> =>
    mockWriteOnboardingStep(...args) as Promise<void>,
}));

jest.mock("@/services/profile-service", () => ({
  completeOnboarding: (): Promise<void> =>
    mockCompleteOnboarding() as Promise<void>,
  setPreferredLanguage: (...args: unknown[]): Promise<void> =>
    mockSetPreferredLanguage(...args) as Promise<void>,
  setPreferredCurrencyAndCreateCashAccount: (
    ...args: unknown[]
  ): Promise<void> =>
    mockSetPreferredCurrencyAndCreateCashAccount(...args) as Promise<void>,
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: (): unknown => mockUseProfile(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): unknown => mockUseAuth(),
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

jest.mock("@/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: (): { showToast: () => void } => ({ showToast: jest.fn() }),
}));

jest.mock("expo-router", () => ({
  useRouter: (): { replace: (path: string) => void } => ({
    replace: mockRouterReplace,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: (): { top: number; bottom: number } => ({
    top: 0,
    bottom: 0,
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (): {
    t: (k: string) => string;
    i18n: { language: string };
  } => ({
    t: (k: string): string => k,
    i18n: { language: "en" },
  }),
}));

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

jest.mock("react-native-reanimated-carousel", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require("react-native");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const ReactMod = require("react");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>): unknown =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ReactMod.createElement(RN.View, {
        testID: "carousel",
        "data-length": (props.data as unknown[] | undefined)?.length ?? 0,
      }),
  };
});

// Tag each step component so we can assert which one renders for a given
// cursor. The real components pull in many deps we don't need here.
jest.mock("@/components/onboarding/LanguagePickerStep", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require("react-native");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const ReactMod = require("react");
  return {
    LanguagePickerStep: (): unknown =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ReactMod.createElement(RN.View, { testID: "step-language" }),
  };
});

jest.mock("@/components/onboarding/CurrencyPickerStep", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require("react-native");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const ReactMod = require("react");
  return {
    CurrencyPickerStep: (): unknown =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ReactMod.createElement(RN.View, { testID: "step-currency" }),
  };
});

jest.mock("@/components/onboarding/WalletCreationStep", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require("react-native");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const ReactMod = require("react");
  return {
    WalletCreationStep: (props: {
      onComplete: () => void;
      onError: () => void;
    }): unknown =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ReactMod.createElement(RN.View, {
        testID: "step-wallet",
        onStartShouldSetResponder: () => props.onComplete(),
      }),
  };
});

// =============================================================================
// Under test
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const OnboardingModule = require("../../app/onboarding.tsx") as {
  default: (props: unknown) => React.ReactNode;
};
const OnboardingScreen = OnboardingModule.default;

// =============================================================================
// Helpers
// =============================================================================

function setAuth(opts: { isLoading?: boolean } = {}): void {
  mockUseAuth.mockReturnValue({ isLoading: opts.isLoading ?? false });
}

function setProfile(opts: {
  userId?: string | null;
  preferredCurrency?: string | null;
}): void {
  mockUseProfile.mockReturnValue({
    profile: {
      userId: opts.userId ?? "user-1",
      preferredCurrency: opts.preferredCurrency ?? null,
    },
    isLoading: false,
  });
}

async function renderOnboarding(): Promise<ReactTestRendererInstance> {
  let renderer!: ReactTestRendererInstance;
  await RTR.act(() => {
    renderer = RTR.create(React.createElement(OnboardingScreen));
  });
  // Flush the resume-cursor useEffect and subsequent setState.
  await RTR.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer;
}

function hasTestId(
  renderer: ReactTestRendererInstance,
  testID: string
): boolean {
  return renderer.root.findAllByProps({ testID }).length > 0;
}

// =============================================================================
// Tests
// =============================================================================

describe("onboarding.tsx state machine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteOnboardingStep.mockResolvedValue(undefined);
    mockCompleteOnboarding.mockResolvedValue(undefined);
    setAuth();
  });

  it("starts at the language picker when the cursor is missing (new user)", async () => {
    mockReadOnboardingStep.mockResolvedValue(null);
    setProfile({ userId: "user-1" });

    const renderer = await renderOnboarding();

    expect(hasTestId(renderer, "step-language")).toBe(true);
    expect(hasTestId(renderer, "step-currency")).toBe(false);
    expect(hasTestId(renderer, "step-wallet")).toBe(false);
  });

  it("resumes at the carousel when cursor is 'slides'", async () => {
    mockReadOnboardingStep.mockResolvedValue("slides");
    setProfile({ userId: "user-1" });

    const renderer = await renderOnboarding();

    expect(hasTestId(renderer, "carousel")).toBe(true);
    expect(hasTestId(renderer, "step-language")).toBe(false);
  });

  it("resumes at the currency picker when cursor is 'currency'", async () => {
    mockReadOnboardingStep.mockResolvedValue("currency");
    setProfile({ userId: "user-1" });

    const renderer = await renderOnboarding();

    expect(hasTestId(renderer, "step-currency")).toBe(true);
    expect(hasTestId(renderer, "step-language")).toBe(false);
  });

  it("resumes at the wallet creation step when cursor is 'cash-account' and preferredCurrency is known", async () => {
    mockReadOnboardingStep.mockResolvedValue("cash-account");
    setProfile({ userId: "user-1", preferredCurrency: "EGP" });

    const renderer = await renderOnboarding();

    expect(hasTestId(renderer, "step-wallet")).toBe(true);
    expect(hasTestId(renderer, "step-currency")).toBe(false);
  });

  it("renders nothing until the profile userId is available", async () => {
    mockReadOnboardingStep.mockResolvedValue(null);
    // profile.userId is null — gate blocks all rendering.
    mockUseProfile.mockReturnValue({
      profile: { userId: null, preferredCurrency: null },
      isLoading: false,
    });

    const renderer = await renderOnboarding();

    expect(renderer.toJSON()).toBeNull();
  });

  it("calls completeOnboarding exactly once and navigates to /(tabs) when the wallet step reports completion", async () => {
    mockReadOnboardingStep.mockResolvedValue("cash-account");
    setProfile({ userId: "user-1", preferredCurrency: "EGP" });

    const renderer = await renderOnboarding();

    // Simulate "Let's Go!" — our WalletCreationStep stub wires onComplete to
    // the View's responder. Pull the node and invoke the handler directly.
    const walletNodes = renderer.root.findAllByProps({ testID: "step-wallet" });
    const walletNode = walletNodes[0] as
      | { props: { onStartShouldSetResponder?: () => void } }
      | undefined;
    expect(walletNode).toBeDefined();

    await RTR.act(async () => {
      walletNode?.props.onStartShouldSetResponder?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("does NOT navigate to /(tabs) when completeOnboarding fails — user stays on wallet step to retry (round-3 CR finding)", async () => {
    mockReadOnboardingStep.mockResolvedValue("cash-account");
    setProfile({ userId: "user-1", preferredCurrency: "EGP" });
    mockCompleteOnboarding.mockRejectedValueOnce(new Error("db write failed"));

    const renderer = await renderOnboarding();

    const walletNodes = renderer.root.findAllByProps({ testID: "step-wallet" });
    const walletNode = walletNodes[0] as
      | { props: { onStartShouldSetResponder?: () => void } }
      | undefined;
    expect(walletNode).toBeDefined();

    await RTR.act(async () => {
      walletNode?.props.onStartShouldSetResponder?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    // Guard — navigation must not fire when the DB flag write rejected.
    // Previously the handler fell through and navigated anyway, leaving the
    // router gate bouncing the user back to onboarding on next launch.
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
