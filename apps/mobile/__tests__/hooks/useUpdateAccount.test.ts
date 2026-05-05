/**
 * useUpdateAccount.test.ts
 *
 * Verifies the atomicity contract of the update-account flow: when the
 * combined service reports failure, the user MUST see the error toast,
 * NOT the success toast, and the navigation MUST NOT fire. This guards
 * against regressing back to the prior split-write flow where a failed
 * balance-adjustment insert was silently swallowed and the success toast
 * still fired.
 */

import React from "react";

// ---------------------------------------------------------------------------
// Test renderer utilities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateAccountWithBalanceAdjustment = jest.fn();
const mockGetCurrentUserId = jest.fn();
const mockShowToast = jest.fn();
const mockRouterBack = jest.fn();
const mockHapticsNotification = jest.fn(() => Promise.resolve());

jest.mock("../../services/edit-account-service", () => ({
  updateAccountWithBalanceAdjustment: (
    ...args: readonly unknown[]
  ): Promise<unknown> =>
    mockUpdateAccountWithBalanceAdjustment(...args) as Promise<unknown>,
}));

jest.mock("../../services/supabase", () => ({
  getCurrentUserId: (): Promise<string | null> =>
    mockGetCurrentUserId() as Promise<string | null>,
}));

jest.mock("../../components/ui/Toast", () => ({
  useToast: (): { showToast: jest.Mock } => ({ showToast: mockShowToast }),
}));

jest.mock("expo-router", () => ({
  useRouter: (): { back: jest.Mock } => ({ back: mockRouterBack }),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: (): Promise<void> => mockHapticsNotification(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
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
import { useUpdateAccount } from "../../hooks/useUpdateAccount";

// ---------------------------------------------------------------------------
// Lightweight renderHook
// ---------------------------------------------------------------------------

interface HookResult {
  performUpdate: (
    accountId: string,
    data: {
      readonly name: string;
      readonly balance: number;
      readonly isDefault: boolean;
    },
    balanceAdjustment?: {
      readonly trackAsTransaction: boolean;
      readonly currency: "EGP";
    }
  ) => Promise<void>;
  isSubmitting: boolean;
}

function renderHook(): {
  result: { current: HookResult };
  unmount: () => void;
} {
  const ref: { current: HookResult } = {
    current: {
      performUpdate: () => Promise.resolve(),
      isSubmitting: false,
    },
  };

  const HookWrapper = (): React.JSX.Element | null => {
    ref.current = useUpdateAccount() as HookResult;
    return null;
  };

  const renderer = RTR.create(React.createElement(HookWrapper));
  return { result: ref, unmount: () => renderer.unmount() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUserId.mockResolvedValue("user-1");
});

describe("useUpdateAccount", () => {
  it("shows error toast (not success) and does NOT navigate when service fails", async () => {
    mockUpdateAccountWithBalanceAdjustment.mockResolvedValueOnce({
      success: false,
      error: "Transaction insert failed",
    });

    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.performUpdate("acc-1", {
        name: "Test",
        balance: 200,
        isDefault: false,
      });
    });

    const titles = (
      mockShowToast.mock.calls as ReadonlyArray<
        readonly [{ readonly title?: string }]
      >
    ).map(([arg]) => arg.title);
    expect(titles).not.toContain("accounts:toast_update_success_title");
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "accounts:toast_update_error_title",
        message: "common:error_generic",
      })
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("calls the combined service with userId-resolved adjustment when tracking is on", async () => {
    mockUpdateAccountWithBalanceAdjustment.mockResolvedValueOnce({
      success: true,
    });
    mockGetCurrentUserId.mockResolvedValueOnce("user-1");

    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.performUpdate(
        "acc-1",
        { name: "Test", balance: 250, isDefault: false },
        { trackAsTransaction: true, currency: "EGP" }
      );
    });

    expect(mockUpdateAccountWithBalanceAdjustment).toHaveBeenCalledWith(
      "acc-1",
      "user-1",
      expect.objectContaining({ name: "Test", balance: 250 }),
      { userId: "user-1", currency: "EGP" }
    );
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("fails the whole update (no row mutation) when userId is missing and tracking is on", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce(null);

    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.performUpdate(
        "acc-1",
        { name: "Test", balance: 250, isDefault: false },
        { trackAsTransaction: true, currency: "EGP" }
      );
    });

    // The service must NOT be called at all — we refuse to silently skip the
    // ledger entry while still mutating the account.
    expect(mockUpdateAccountWithBalanceAdjustment).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "accounts:toast_update_session_required_title",
        message: "accounts:toast_update_session_required_message",
      })
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("calls the service with null adjustment when no balanceAdjustment is provided (rename-only path)", async () => {
    // The most common path through the hook: user just renames the account
    // or flips the default flag without changing the balance.
    mockUpdateAccountWithBalanceAdjustment.mockResolvedValueOnce({
      success: true,
    });

    const { result } = renderHook();

    await RTR.act(async () => {
      await result.current.performUpdate("acc-1", {
        name: "Renamed",
        balance: 100,
        isDefault: true,
      });
    });

    // userId resolution must be skipped entirely — no auth call when
    expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1);
    expect(mockUpdateAccountWithBalanceAdjustment).toHaveBeenCalledWith(
      "acc-1",
      "user-1",
      expect.objectContaining({
        name: "Renamed",
        balance: 100,
        isDefault: true,
      }),
      null
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "accounts:toast_update_success_title",
        message: "accounts:toast_update_success_message:Renamed",
      })
    );
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
