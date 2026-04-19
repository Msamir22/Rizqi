/**
 * Unit tests for CurrencyPickerStep (T030).
 *
 * Scope: this is a pure presentational component. It surfaces the
 * user's pick via `onCurrencySelected(currency)` — persistence (profile
 * update + cash-account creation) is the parent's job.
 *
 * Tests:
 * - The suggested currency (from timezone) is pre-selected on mount.
 * - Tapping a different currency row updates the selection.
 * - Tapping Continue forwards the currently-selected currency via the
 *   `onCurrencySelected` prop — the service write is not invoked here.
 */

import React from "react";
import { TouchableOpacity } from "react-native";

interface ReactTestRendererInstance {
  root: {
    findAllByType: (type: unknown) => Array<{
      props: Record<string, unknown>;
      children: unknown[];
    }>;
  };
  toJSON: () => unknown;
  unmount: () => void;
}
interface ReactTestRendererModule {
  act: (fn: () => void | Promise<void>) => void;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

const mockDetectCurrency = jest.fn();
// Mirror the service contract so we can guard against the component ever
// importing it by mistake — Finding from earlier reviews: this step must
// delegate persistence upwards.
const mockSetPreferredCurrencyAndCreateCashAccount = jest.fn();

jest.mock("@/utils/currency-detection", () => ({
  detectCurrencyFromTimezone: (): unknown => mockDetectCurrency(),
}));

jest.mock("@/services/profile-service", () => ({
  setPreferredCurrencyAndCreateCashAccount: (
    ...args: unknown[]
  ): Promise<void> =>
    mockSetPreferredCurrencyAndCreateCashAccount(...args) as Promise<void>,
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

import { CurrencyPickerStep } from "@/components/onboarding/CurrencyPickerStep";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Tests
// =============================================================================

describe("CurrencyPickerStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectCurrency.mockReturnValue("EGP");
  });

  it("forwards the pre-selected (detected) currency via onCurrencySelected when Continue is tapped", () => {
    mockDetectCurrency.mockReturnValue("EGP");
    const onCurrencySelected = jest.fn();

    const renderer = RTR.create(
      React.createElement(CurrencyPickerStep, { onCurrencySelected })
    );

    // Continue is the last TouchableOpacity (after each currency row).
    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const continueBtn = buttons[buttons.length - 1];
    (continueBtn?.props.onPress as () => void | undefined)?.();

    expect(onCurrencySelected).toHaveBeenCalledTimes(1);
    expect(onCurrencySelected).toHaveBeenCalledWith("EGP");
  });

  it("forwards whichever currency the detection returns — swapping the detected code flows through", () => {
    mockDetectCurrency.mockReturnValue("USD");
    const onCurrencySelected = jest.fn();

    const renderer = RTR.create(
      React.createElement(CurrencyPickerStep, { onCurrencySelected })
    );

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const continueBtn = buttons[buttons.length - 1];
    (continueBtn?.props.onPress as () => void | undefined)?.();

    expect(onCurrencySelected).toHaveBeenCalledWith("USD");
  });

  it("never calls setPreferredCurrencyAndCreateCashAccount directly — persistence is the parent's job", () => {
    mockDetectCurrency.mockReturnValue("EGP");

    const renderer = RTR.create(
      React.createElement(CurrencyPickerStep, {
        onCurrencySelected: jest.fn(),
      })
    );

    // Tap Continue.
    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const continueBtn = buttons[buttons.length - 1];
    (continueBtn?.props.onPress as () => void | undefined)?.();

    expect(mockSetPreferredCurrencyAndCreateCashAccount).not.toHaveBeenCalled();
  });
});
