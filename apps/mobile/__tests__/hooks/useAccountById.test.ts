/**
 * useAccountById tests
 *
 * Guards the edit-account screen contract: BANK accounts must not finish
 * loading until their bank_details row has been fetched, otherwise the form
 * mounts with empty bank fields and never hydrates them.
 */

import React from "react";

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

interface MockBankDetails {
  readonly bankName?: string;
  readonly cardLast4?: string;
  readonly smsSenderName?: string;
}

interface MockAccount {
  readonly id: string;
  readonly isBank: boolean;
  readonly bankDetails: {
    readonly fetch: jest.Mock<Promise<MockBankDetails[]>, []>;
  };
}

interface MockObserver {
  readonly next: (record: MockAccount) => void;
  readonly error: (err: unknown) => void;
}

interface UseAccountByIdResult {
  readonly account: MockAccount | null;
  readonly bankDetails: {
    readonly bankName: string;
    readonly cardLast4: string;
    readonly smsSenderName: string;
  } | null;
  readonly isLoading: boolean;
}

let activeObserver: MockObserver | null = null;
const mockUnsubscribe = jest.fn();
const mockFindAndObserve = jest.fn(() => ({
  subscribe: jest.fn((observer: MockObserver) => {
    activeObserver = observer;
    return { unsubscribe: mockUnsubscribe };
  }),
}));

jest.mock("@rizqi/db", () => ({
  database: {
    get: jest.fn(() => ({
      findAndObserve: mockFindAndObserve,
    })),
  },
}));

// Import AFTER mocks
// eslint-disable-next-line import/first
import { useAccountById } from "../../hooks/useAccountById";

function renderHook(id: string): {
  readonly result: { current: UseAccountByIdResult };
  readonly unmount: () => void;
} {
  const ref: { current: UseAccountByIdResult } = {
    current: { account: null, bankDetails: null, isLoading: true },
  };

  const HookWrapper = (): React.JSX.Element | null => {
    ref.current = useAccountById(id) as unknown as UseAccountByIdResult;
    return null;
  };

  let renderer: ReactTestRendererInstance = { unmount: () => undefined };
  RTR.act(() => {
    renderer = RTR.create(React.createElement(HookWrapper));
  });
  return { result: ref, unmount: () => renderer.unmount() };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

beforeEach(() => {
  jest.clearAllMocks();
  activeObserver = null;
});

describe("useAccountById", () => {
  it("keeps bank accounts loading until bank details are fetched", async () => {
    const deferredDetails = createDeferred<MockBankDetails[]>();
    const account: MockAccount = {
      id: "acc-1",
      isBank: true,
      bankDetails: {
        fetch: jest.fn(() => deferredDetails.promise),
      },
    };
    const { result } = renderHook("acc-1");

    RTR.act(() => {
      activeObserver?.next(account);
    });

    expect(result.current.account).toBe(account);
    expect(result.current.bankDetails).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await RTR.act(async () => {
      deferredDetails.resolve([
        {
          bankName: "CIB",
          cardLast4: "1234",
          smsSenderName: "CIBSMS",
        },
      ]);
      await deferredDetails.promise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.bankDetails).toEqual({
      bankName: "CIB",
      cardLast4: "1234",
      smsSenderName: "CIBSMS",
    });
  });
});
