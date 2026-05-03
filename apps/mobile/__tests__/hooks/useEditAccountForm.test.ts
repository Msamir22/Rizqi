import React from "react";
import type { Account } from "@monyvi/db";

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

const mockCheckAccountNameUniqueness = jest.fn();

jest.mock("i18next", () => ({
  t: (key: string): string => key,
}));

jest.mock("../../services/edit-account-service", () => ({
  checkAccountNameUniqueness: (...args: readonly unknown[]): Promise<unknown> =>
    mockCheckAccountNameUniqueness(...args) as Promise<unknown>,
}));

// Import AFTER mocks
// eslint-disable-next-line import/first
import { useEditAccountForm } from "../../hooks/useEditAccountForm";
// eslint-disable-next-line import/first
import type { EditAccountFormData } from "../../validation/account-validation";

interface HookResult {
  readonly formData: EditAccountFormData;
  readonly isCheckingUniqueness: boolean;
  readonly updateField: <K extends keyof EditAccountFormData>(
    field: K,
    value: EditAccountFormData[K]
  ) => void;
}

const account = {
  id: "acc-1",
  userId: "user-1",
  name: "Cash",
  balance: 100,
  isDefault: false,
  type: "CASH",
  currency: "EGP",
} as unknown as Account;

function renderHook(): {
  readonly result: { current: HookResult };
  readonly unmount: () => void;
} {
  const ref: { current: HookResult } = {
    current: {
      formData: {
        name: "Cash",
        balance: "100",
        bankName: "",
        cardLast4: "",
        smsSenderName: "",
      },
      isCheckingUniqueness: false,
      updateField: () => undefined,
    },
  };

  const HookWrapper = (): React.JSX.Element | null => {
    ref.current = useEditAccountForm(account, null) as HookResult;
    return null;
  };

  const renderer = RTR.create(React.createElement(HookWrapper));
  return { result: ref, unmount: () => renderer.unmount() };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockCheckAccountNameUniqueness.mockResolvedValue({
    isUnique: true,
    error: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useEditAccountForm", () => {
  it("does not mark uniqueness as checking until the debounce fires", async () => {
    const { result } = renderHook();

    RTR.act(() => {
      result.current.updateField("name", "Cash Plus");
    });

    expect(result.current.isCheckingUniqueness).toBe(false);
    expect(mockCheckAccountNameUniqueness).not.toHaveBeenCalled();

    await RTR.act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(result.current.isCheckingUniqueness).toBe(false);
    expect(mockCheckAccountNameUniqueness).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid name edits into one uniqueness query", async () => {
    const { result } = renderHook();

    RTR.act(() => {
      result.current.updateField("name", "C");
      result.current.updateField("name", "Ca");
      result.current.updateField("name", "Cas");
      result.current.updateField("name", "Cash Plus");
    });

    await RTR.act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockCheckAccountNameUniqueness).toHaveBeenCalledTimes(1);
    expect(mockCheckAccountNameUniqueness).toHaveBeenCalledWith(
      "user-1",
      "Cash Plus",
      "EGP",
      "acc-1"
    );
  });
});
