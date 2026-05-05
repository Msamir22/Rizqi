import { act, renderHook, waitFor } from "@testing-library/react-native";

type TestCurrency = "EGP" | "USD";

interface UniquenessResult {
  readonly isUnique: boolean;
  readonly error: string | null;
}

const mockGetCurrentUserId = jest.fn<Promise<string>, []>();
const mockCheckAccountNameUniqueness = jest.fn<
  Promise<UniquenessResult>,
  [string, string, TestCurrency]
>();
let mockPreferredCurrency: TestCurrency = "EGP";

jest.mock("../../hooks/usePreferredCurrency", () => ({
  usePreferredCurrency: (): {
    preferredCurrency: typeof mockPreferredCurrency;
  } => ({
    preferredCurrency: mockPreferredCurrency,
  }),
}));

jest.mock("../../services/supabase", () => ({
  getCurrentUserId: (): Promise<string> => mockGetCurrentUserId(),
}));

jest.mock("../../services/edit-account-service", () => ({
  checkAccountNameUniqueness: (
    userId: string,
    name: string,
    currency: TestCurrency
  ): Promise<UniquenessResult> =>
    mockCheckAccountNameUniqueness(userId, name, currency),
}));

import { useAccountForm } from "../../hooks/useAccountForm";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushAct(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockPreferredCurrency = "EGP";
  mockGetCurrentUserId.mockResolvedValue("user-1");
  mockCheckAccountNameUniqueness.mockResolvedValue({
    isUnique: true,
    error: null,
  });
});

describe("useAccountForm", () => {
  it("initializes account balance to the visible default of zero", () => {
    const { result } = renderHook(() => useAccountForm());

    expect(result.current.formData.balance).toBe("0");
  });

  it("resets account balance back to zero", () => {
    const { result } = renderHook(() => useAccountForm());

    act(() => {
      result.current.updateField("balance", "125");
    });

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.formData.balance).toBe("0");
  });

  it("ignores stale uniqueness results after the account name changes", async () => {
    jest.useFakeTimers();
    const firstCheck = createDeferred<{ isUnique: boolean; error: null }>();
    const secondCheck = createDeferred<{ isUnique: boolean; error: null }>();
    mockCheckAccountNameUniqueness
      .mockReturnValueOnce(firstCheck.promise)
      .mockReturnValueOnce(secondCheck.promise);

    const { result } = renderHook(() => useAccountForm());

    await flushAct();

    act(() => {
      result.current.updateField("name", "Wallet");
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockCheckAccountNameUniqueness).toHaveBeenCalledWith(
      "user-1",
      "Wallet",
      "EGP"
    );

    act(() => {
      result.current.updateField("name", "Savings");
    });

    await act(async () => {
      firstCheck.resolve({ isUnique: false, error: null });
      await Promise.resolve();
    });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.isCheckingUniqueness).toBe(true);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockCheckAccountNameUniqueness).toHaveBeenLastCalledWith(
      "user-1",
      "Savings",
      "EGP"
    );

    await act(async () => {
      secondCheck.resolve({ isUnique: true, error: null });
      await Promise.resolve();
    });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.isCheckingUniqueness).toBe(false);
  });

  it("rechecks name uniqueness when untouched currency follows preferred currency", async () => {
    jest.useFakeTimers();
    const { result, rerender } = renderHook(() => useAccountForm());

    await flushAct();

    act(() => {
      result.current.updateField("name", "Wallet");
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    await flushAct();

    expect(mockCheckAccountNameUniqueness).toHaveBeenCalledWith(
      "user-1",
      "Wallet",
      "EGP"
    );

    mockPreferredCurrency = "USD";
    rerender({});

    await waitFor(() => {
      expect(result.current.formData.currency).toBe("USD");
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    await flushAct();

    expect(mockCheckAccountNameUniqueness).toHaveBeenLastCalledWith(
      "user-1",
      "Wallet",
      "USD"
    );
  });
});
