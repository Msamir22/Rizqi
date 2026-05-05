import { act, renderHook, waitFor } from "@testing-library/react-native";

const mockDeleteAccountWithCascade = jest.fn(
  (..._args: readonly unknown[]): Promise<unknown> => Promise.resolve()
);
const mockGetCurrentUserId = jest.fn(
  (): Promise<string | null> => Promise.resolve("user-1")
);
const mockShowToast = jest.fn();
const mockRouterBack = jest.fn();
const mockFetchCount = jest.fn((): Promise<number> => Promise.resolve(0));
const mockQuery = jest.fn(() => ({ fetchCount: mockFetchCount }));
const mockDatabaseGet = jest.fn((_collectionName: string) => ({
  query: mockQuery,
}));
const mockSafeNotificationHaptic = jest.fn(
  (..._args: readonly unknown[]): Promise<void> => Promise.resolve()
);

jest.mock("@monyvi/db", () => ({
  database: {
    get: (collectionName: string): unknown => mockDatabaseGet(collectionName),
  },
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    where: (...args: readonly unknown[]) => ({ kind: "where", args }),
    notEq: (value: unknown) => ({ kind: "notEq", value }),
    and: (...args: readonly unknown[]) => ({ kind: "and", args }),
    or: (...args: readonly unknown[]) => ({ kind: "or", args }),
  },
}));

jest.mock("expo-router", () => ({
  useRouter: (): { back: jest.Mock } => ({ back: mockRouterBack }),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("../../components/ui/Toast", () => ({
  useToast: (): { showToast: jest.Mock } => ({ showToast: mockShowToast }),
}));

jest.mock("../../services/edit-account-service", () => ({
  deleteAccountWithCascade: (...args: readonly unknown[]): Promise<unknown> =>
    mockDeleteAccountWithCascade(...args),
}));

jest.mock("../../services/supabase", () => ({
  getCurrentUserId: (): Promise<string | null> => mockGetCurrentUserId(),
}));

jest.mock("../../utils/haptics", () => ({
  safeNotificationHaptic: (...args: readonly unknown[]): Promise<void> =>
    mockSafeNotificationHaptic(...args),
}));

jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: (
    namespace: "accounts" | "common"
  ): { t: (key: string) => string } => ({
    t: (key: string): string => `${namespace}:${key}`,
  }),
}));

import { useDeleteAccount } from "../../hooks/useDeleteAccount";

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchCount.mockResolvedValue(0);
  mockGetCurrentUserId.mockResolvedValue("user-1");
  mockDeleteAccountWithCascade.mockResolvedValue({ success: true });
});

describe("useDeleteAccount", () => {
  it("uses localized success toast text without emojis", async () => {
    const { result } = renderHook(() => useDeleteAccount("acc-1"));

    await waitFor(() => {
      expect(result.current.isLoadingCounts).toBe(false);
    });

    await act(async () => {
      await result.current.performDelete("acc-1");
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "accounts:toast_delete_success_title",
        message: "accounts:toast_delete_success_message",
      })
    );
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("uses localized session-required toast text", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useDeleteAccount("acc-1"));

    await waitFor(() => {
      expect(result.current.isLoadingCounts).toBe(false);
    });

    await act(async () => {
      await result.current.performDelete("acc-1");
    });

    expect(mockDeleteAccountWithCascade).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "accounts:toast_delete_session_required_title",
        message: "accounts:toast_delete_session_required_message",
      })
    );
  });

  it("uses localized generic error toast text when deletion fails", async () => {
    mockDeleteAccountWithCascade.mockRejectedValueOnce(
      new Error("cascade delete failed")
    );
    const { result } = renderHook(() => useDeleteAccount("acc-1"));

    await waitFor(() => {
      expect(result.current.isLoadingCounts).toBe(false);
    });

    await act(async () => {
      await result.current.performDelete("acc-1");
    });

    expect(mockDeleteAccountWithCascade).toHaveBeenCalledWith(
      "acc-1",
      "user-1"
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "accounts:toast_delete_error_title",
        message: "common:error_generic",
      })
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
