import { render, waitFor } from "@testing-library/react-native";
import React from "react";

/* eslint-disable @typescript-eslint/no-require-imports */

interface MockAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface MockRootNavigationState {
  key?: string;
}

const mockReplace = jest.fn();
let mockRootNavigationState: MockRootNavigationState | undefined;
let mockAuthState: MockAuthState;

jest.mock("expo-router", () => ({
  useRouter: (): { replace: typeof mockReplace } => ({
    replace: mockReplace,
  }),
  useRootNavigationState: (): MockRootNavigationState | undefined =>
    mockRootNavigationState,
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): MockAuthState => mockAuthState,
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: (): { isDark: boolean } => ({ isDark: false }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (): { t: (key: string) => string } => ({
    t: (key: string): string => key,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: (): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: (): { showToast: jest.Mock } => ({ showToast: jest.fn() }),
}));

jest.mock("@/components/auth/FormView", () => ({
  FormView: (): React.ReactElement => {
    const ReactMod = require("react") as typeof React;
    const RN = require("react-native") as typeof import("react-native");
    return ReactMod.createElement(RN.View, { testID: "auth-form" });
  },
}));

jest.mock("@/components/auth/VerificationPendingView", () => ({
  VerificationPendingView: (): React.ReactElement => {
    const ReactMod = require("react") as typeof React;
    const RN = require("react-native") as typeof import("react-native");
    return ReactMod.createElement(RN.View, {
      testID: "verification-pending",
    });
  },
}));

jest.mock("@/components/auth/ResetSentView", () => ({
  ResetSentView: (): React.ReactElement => {
    const ReactMod = require("react") as typeof React;
    const RN = require("react-native") as typeof import("react-native");
    return ReactMod.createElement(RN.View, { testID: "reset-sent" });
  },
}));

jest.mock("@/services/auth-service", () => ({
  signInWithOAuth: jest.fn(),
  signUpWithEmail: jest.fn(),
  signInWithEmail: jest.fn(),
  requestPasswordReset: jest.fn(),
}));

jest.mock("@/services/supabase", () => ({
  resendVerificationEmail: jest.fn(),
}));

const AuthModule = require("../../app/auth") as {
  default: () => React.JSX.Element;
};
const AuthScreen = AuthModule.default;

describe("AuthScreen redirect", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockRootNavigationState = undefined;
    mockAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
  });

  it("waits for reactive root navigation state before redirecting authenticated users", async () => {
    const screen = render(<AuthScreen />);

    expect(mockReplace).not.toHaveBeenCalled();

    mockRootNavigationState = { key: "root" };
    screen.rerender(<AuthScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });
});
