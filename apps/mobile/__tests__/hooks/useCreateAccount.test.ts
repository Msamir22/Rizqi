/**
 * useCreateAccount.test.ts
 *
 * Guards the create-account flow against rapid duplicate submits. The hook
 * must lock synchronously before any awaited auth/service work so repeated
 * presses cannot create duplicate local rows or trigger multiple navigations.
 */

import React from "react";
import type { AccountFormData } from "../../validation/account-validation";

interface ReactTestRendererInstance {
  unmount: () => void;
}

interface ReactTestRendererAct {
  (callback: () => Promise<void>): Promise<void>;
  (callback: () => void): void;
}

interface ReactTestRendererModule {
  act: ReactTestRendererAct;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

const mockCreateAccountForUser = jest.fn();
const mockGetCurrentUserId = jest.fn();
const mockShowToast = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterCanGoBack = jest.fn();

jest.mock("../../services/account-service", () => ({
  CREATE_ACCOUNT_ERROR_CODES: {
    USER_ID_REQUIRED: "USER_ID_REQUIRED",
    DUPLICATE_ACCOUNT: "DUPLICATE_ACCOUNT",
    DUPLICATE_IN_FLIGHT: "DUPLICATE_IN_FLIGHT",
  },
  createAccountForUser: (...args: readonly unknown[]): Promise<unknown> =>
    mockCreateAccountForUser(...args) as Promise<unknown>,
}));

jest.mock("../../services/supabase", () => ({
  getCurrentUserId: (): Promise<string | null> =>
    mockGetCurrentUserId() as Promise<string | null>,
}));

jest.mock("../../components/ui/Toast", () => ({
  useToast: (): { showToast: jest.Mock } => ({ showToast: mockShowToast }),
}));

jest.mock("expo-router", () => ({
  useRouter: (): {
    back: jest.Mock;
    replace: jest.Mock;
    canGoBack: jest.Mock;
  } => ({
    back: mockRouterBack,
    replace: mockRouterReplace,
    canGoBack: mockRouterCanGoBack,
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (
    namespace: "accounts" | "common"
  ): { t: (key: string, options?: Record<string, unknown>) => string } => ({
    t: (key: string, options?: Record<string, unknown>): string => {
      const prefix = `${namespace}:${key}`;
      return typeof options?.name === "string"
        ? `${prefix}:${options.name}`
        : prefix;
    },
  }),
}));

// Import AFTER mocks
// eslint-disable-next-line import/first
import { useCreateAccount } from "../../hooks/useCreateAccount";

interface HookResult {
  readonly createAccount: (data: AccountFormData) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly error: Error | null;
}

function renderHook(): {
  readonly result: { current: HookResult };
  readonly unmount: () => void;
} {
  const ref: { current: HookResult } = {
    current: {
      createAccount: () => Promise.resolve(),
      isSubmitting: false,
      error: null,
    },
  };

  const HookWrapper = (): React.JSX.Element | null => {
    ref.current = useCreateAccount() as HookResult;
    return null;
  };

  const renderer = RTR.create(React.createElement(HookWrapper));
  return { result: ref, unmount: () => renderer.unmount() };
}

const accountFormData: AccountFormData = {
  name: "Cash",
  accountType: "CASH",
  currency: "EGP",
  balance: "0",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUserId.mockResolvedValue("user-1");
  mockCreateAccountForUser.mockResolvedValue({
    success: true,
    accountId: "account-1",
    created: true,
  });
  mockRouterCanGoBack.mockReturnValue(true);
});

describe("useCreateAccount", () => {
  it("synchronously ignores rapid duplicate submits", async () => {
    let releaseCreate: () => void = () => undefined;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    mockCreateAccountForUser.mockImplementationOnce(async () => {
      await createGate;
      return { success: true, accountId: "account-1", created: true };
    });

    const { result } = renderHook();

    let firstSubmit: Promise<void> = Promise.resolve();
    let secondSubmit: Promise<void> = Promise.resolve();
    let thirdSubmit: Promise<void> = Promise.resolve();

    RTR.act(() => {
      firstSubmit = result.current.createAccount(accountFormData);
      secondSubmit = result.current.createAccount(accountFormData);
      thirdSubmit = result.current.createAccount(accountFormData);
    });

    await Promise.resolve();

    expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1);
    expect(mockCreateAccountForUser).toHaveBeenCalledTimes(1);

    releaseCreate();

    await RTR.act(async () => {
      await Promise.all([firstSubmit, secondSubmit, thirdSubmit]);
    });

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  it("replaces to the accounts tab when there is no route to go back to", async () => {
    mockRouterCanGoBack.mockReturnValue(false);
    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.createAccount(accountFormData);
    });

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)/accounts");
  });

  it("uses localized success toast text without emojis", async () => {
    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.createAccount(accountFormData);
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "accounts:toast_create_success_title",
        message: "accounts:toast_create_success_message:Cash",
      })
    );
  });

  it("uses localized session-required toast text", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.createAccount(accountFormData);
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "accounts:toast_create_session_required_title",
        message: "accounts:toast_create_session_required_message",
      })
    );
    expect(mockCreateAccountForUser).not.toHaveBeenCalled();
  });
});
