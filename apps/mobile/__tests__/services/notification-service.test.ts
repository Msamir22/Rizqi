import type { ParsedSmsTransaction } from "@monyvi/logic";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  ACTION_CONFIRM,
  ACTION_DISCARD,
  hasNotificationPermission,
  registerNotificationActionHandler,
  requestNotificationPermission,
  showTransactionNotification,
} from "@/services/notification-service";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: "high" },
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  setNotificationHandler: jest.fn(),
}));

const mockGetPermissionsAsync =
  Notifications.getPermissionsAsync as jest.MockedFunction<
    typeof Notifications.getPermissionsAsync
  >;
const mockRequestPermissionsAsync =
  Notifications.requestPermissionsAsync as jest.MockedFunction<
    typeof Notifications.requestPermissionsAsync
  >;
const mockScheduleNotificationAsync =
  Notifications.scheduleNotificationAsync as jest.MockedFunction<
    typeof Notifications.scheduleNotificationAsync
  >;
const mockDismissNotificationAsync =
  Notifications.dismissNotificationAsync as jest.MockedFunction<
    typeof Notifications.dismissNotificationAsync
  >;
const mockAddNotificationResponseReceivedListener =
  Notifications.addNotificationResponseReceivedListener as jest.MockedFunction<
    typeof Notifications.addNotificationResponseReceivedListener
  >;

function createParsedSmsTransaction(): ParsedSmsTransaction {
  return {
    amount: 413,
    currency: "EGP",
    type: "EXPENSE",
    counterparty: "LIVE TEST MARKET",
    date: new Date("2026-05-03T12:00:00.000Z"),
    categoryId: "category-1",
    categoryDisplayName: "Shopping",
    confidence: 0.95,
    originLabel: "NBE",
    source: "SMS",
    smsBodyHash: "hash-1",
    senderDisplayName: "NBE",
    rawSmsBody: "Purchase EGP 413.00 at LIVE TEST MARKET",
  };
}

function createNotificationResponse(
  actionIdentifier: string,
  identifier: string,
  smsBodyHash = "hash-1"
): Notifications.NotificationResponse {
  return {
    actionIdentifier,
    notification: {
      request: {
        identifier,
        content: {
          data: {
            type: "sms_transaction",
            transactionData: {
              ...createParsedSmsTransaction(),
              smsBodyHash,
            },
            resolvedAccountId: "account-1",
            resolvedAccountName: "MainCIBAccount",
          },
        },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createPermissionStatus(
  granted: boolean
): Notifications.NotificationPermissionsStatus {
  const status = { granted };
  return status as Notifications.NotificationPermissionsStatus;
}

describe("notification-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports whether notification permission is granted", async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce(createPermissionStatus(true));

    await expect(hasNotificationPermission()).resolves.toBe(true);
  });

  it("requests notification permission when it is not already granted", async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce(
      createPermissionStatus(false)
    );
    mockRequestPermissionsAsync.mockResolvedValueOnce(
      createPermissionStatus(true)
    );

    await expect(requestNotificationPermission()).resolves.toBe(true);

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("does not schedule an SMS notification when permission is denied", async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce(
      createPermissionStatus(false)
    );

    await showTransactionNotification(
      createParsedSmsTransaction(),
      "account-1",
      "MainCIBAccount"
    );

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("uses the SMS notification channel for immediate Android notifications", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    mockGetPermissionsAsync.mockResolvedValueOnce(createPermissionStatus(true));

    await showTransactionNotification(
      createParsedSmsTransaction(),
      "account-1",
      "MainCIBAccount"
    );

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "sms-transaction-hash-1",
        trigger: { channelId: "sms-transactions" },
      })
    );
  });

  it("dismisses a notification before handling a confirm action", async () => {
    const handler = jest.fn(() => Promise.resolve());
    registerNotificationActionHandler(handler);
    const listener =
      mockAddNotificationResponseReceivedListener.mock.calls[0][0];

    listener(createNotificationResponse(ACTION_CONFIRM, "notification-1"));
    await flushPromises();

    expect(mockDismissNotificationAsync).toHaveBeenCalledWith("notification-1");
    expect(handler).toHaveBeenCalledWith(
      ACTION_CONFIRM,
      expect.objectContaining({
        resolvedAccountId: "account-1",
      })
    );
  });

  it("dismisses a notification when the user discards it", async () => {
    const handler = jest.fn(() => Promise.resolve());
    registerNotificationActionHandler(handler);
    const listener =
      mockAddNotificationResponseReceivedListener.mock.calls[0][0];

    listener(
      createNotificationResponse(ACTION_DISCARD, "notification-2", "hash-2")
    );
    await flushPromises();

    expect(mockDismissNotificationAsync).toHaveBeenCalledWith("notification-2");
    expect(handler).toHaveBeenCalledWith(
      ACTION_DISCARD,
      expect.objectContaining({
        resolvedAccountId: "account-1",
      })
    );
  });

  it("does not run the action handler twice for the same SMS notification", async () => {
    const handler = jest.fn(() => Promise.resolve());
    registerNotificationActionHandler(handler);
    const listener =
      mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    const response = createNotificationResponse(
      ACTION_CONFIRM,
      "notification-3",
      "hash-3"
    );

    listener(response);
    listener(response);
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockDismissNotificationAsync).toHaveBeenCalledWith("notification-3");
  });
});
