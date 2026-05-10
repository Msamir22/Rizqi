import React, { type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

type SmsPermissionStatus = "undetermined" | "granted" | "denied" | "blocked";
type NotificationPermissionStatus =
  | "undetermined"
  | "granted"
  | "denied"
  | "blocked";

const mockRequestPermission = jest.fn<Promise<SmsPermissionStatus>, []>();
const mockRequestLiveDetectionPermission = jest.fn<
  Promise<SmsPermissionStatus>,
  []
>();
const mockOpenSettings = jest.fn<Promise<void>, []>();
const mockSetLiveDetectionEnabled = jest.fn<Promise<void>, [boolean]>();
const mockReconcileLiveDetectionPreference = jest.fn<Promise<boolean>, []>();
const mockStartSmsListener = jest.fn<void, []>();
const mockStopSmsListener = jest.fn<void, []>();
const mockRequestNotificationPermissionStatus = jest.fn<
  Promise<NotificationPermissionStatus>,
  []
>();
const mockOpenNotificationSettings = jest.fn<Promise<void>, []>();
const mockGetNotificationPermissionStatus = jest.fn<
  Promise<NotificationPermissionStatus>,
  []
>();
const mockRouterPush = jest.fn<void, [string]>();

let mockSmsPermissionStatus: SmsPermissionStatus = "denied";
let mockLiveDetectionPermissionStatus: SmsPermissionStatus = "denied";
let appStateChangeHandler: ((status: AppStateStatus) => void) | null = null;

jest.mock("react-native/Libraries/Modal/Modal", () => {
  function MockModal({
    visible,
    children,
  }: {
    readonly visible: boolean;
    readonly children?: ReactNode;
  }): ReactNode {
    return visible ? children : null;
  }

  return MockModal;
});

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (path: string) => mockRouterPush(path),
    replace: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/context/LocaleContext", () => ({
  useLocale: () => ({ language: "en" }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "user@example.com" } }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { text: { primary: "#111827", secondary: "#6b7280" } },
    isDark: false,
    toggleTheme: jest.fn(),
  }),
}));

jest.mock("@/hooks/usePreferredCurrency", () => ({
  usePreferredCurrency: () => ({
    preferredCurrency: "EGP",
    setPreferredCurrency: jest.fn(),
  }),
}));

jest.mock("@/providers/DatabaseProvider", () => ({
  useDatabase: () => ({}),
}));

jest.mock("@/services/logout-service", () => ({
  performLogout: jest.fn(),
}));

jest.mock("@/services/intro-flag-service", () => ({
  setIntroLocaleOverride: jest.fn(),
}));

jest.mock("@/services/profile-service", () => ({
  setPreferredLanguage: jest.fn(),
}));

jest.mock("@/hooks/useSmsPermission", () => ({
  useSmsPermission: () => ({
    status: mockSmsPermissionStatus,
    liveDetectionStatus: mockLiveDetectionPermissionStatus,
    isAndroid: true,
    isLoading: false,
    requestPermission: mockRequestPermission,
    requestLiveDetectionPermission: mockRequestLiveDetectionPermission,
    openSettings: mockOpenSettings,
    recheckPermission: jest.fn(),
  }),
}));

jest.mock("@/hooks/useSmsSync", () => ({
  useSmsSync: () => ({
    hasSynced: false,
    lastSyncTimestamp: null,
  }),
}));

jest.mock("@/context/SmsScanContext", () => ({
  useSmsScanContext: () => ({
    setScanMode: jest.fn(),
  }),
}));

jest.mock("@/services/sms-live-detection-handler", () => ({
  isLiveDetectionEnabled: jest.fn(() => Promise.resolve(false)),
  reconcileLiveDetectionPreference: () =>
    mockReconcileLiveDetectionPreference(),
  setLiveDetectionEnabled: (value: boolean) =>
    mockSetLiveDetectionEnabled(value),
  isAutoConfirmEnabled: jest.fn(() => Promise.resolve(false)),
  setAutoConfirm: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/services/sms-live-listener-service", () => ({
  startSmsListener: () => mockStartSmsListener(),
  stopSmsListener: () => mockStopSmsListener(),
}));

jest.mock("@/services/notification-service", () => ({
  getNotificationPermissionStatus: () => mockGetNotificationPermissionStatus(),
  requestNotificationPermissionStatus: () =>
    mockRequestNotificationPermissionStatus(),
  openNotificationSettings: () => mockOpenNotificationSettings(),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("@/components/ui/GradientBackground", () => {
  return {
    GradientBackground: ({
      children,
    }: {
      readonly children?: ReactNode;
    }): ReactNode => children,
  };
});

jest.mock("@/components/currency/CurrencyPicker", () => ({
  CurrencyPicker: () => null,
}));

jest.mock("@/components/ui/Dropdown", () => ({
  Dropdown: () => null,
}));

jest.mock("@/utils/dateHelpers", () => ({
  formatToLocalDateString: () => "2026-05-10",
}));

jest.mock("@monyvi/logic", () => ({
  CURRENCY_INFO_MAP: {
    EGP: { flag: "EG", name: "Egyptian Pound" },
  },
}));

import SettingsScreen from "@/app/(private)/settings";

function renderSettings(): ReturnType<typeof render> {
  return render(<SettingsScreen />);
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function getLiveDetectionSwitchValue(
  screen: ReturnType<typeof render>
): boolean {
  const switchNode = screen.getByTestId(
    "live-sms-detection-switch"
  ) as unknown as {
    readonly props: {
      readonly value?: boolean;
    };
  };

  return switchNode.props.value === true;
}

describe("Settings live SMS permission recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateChangeHandler = null;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler): { remove: () => void } => {
        appStateChangeHandler = handler as (status: AppStateStatus) => void;
        return { remove: jest.fn() };
      });
    mockSmsPermissionStatus = "denied";
    mockLiveDetectionPermissionStatus = "undetermined";
    mockRequestPermission.mockResolvedValue("granted");
    mockRequestLiveDetectionPermission.mockResolvedValue("granted");
    mockReconcileLiveDetectionPreference.mockResolvedValue(false);
    mockOpenSettings.mockResolvedValue();
    mockSetLiveDetectionEnabled.mockResolvedValue();
    mockGetNotificationPermissionStatus.mockResolvedValue("granted");
    mockRequestNotificationPermissionStatus.mockResolvedValue("granted");
    mockOpenNotificationSettings.mockResolvedValue();
  });

  it("opens the custom SMS permission modal instead of enabling live detection immediately", async () => {
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(
      await screen.findByText("sms_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("sms_permission_allow")).toBeTruthy();
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);
    expect(mockStartSmsListener).not.toHaveBeenCalled();
  });

  it("keeps the switch off when stored live detection is no longer allowed by permissions", async () => {
    mockReconcileLiveDetectionPreference.mockResolvedValue(false);
    const screen = renderSettings();

    await waitFor(() => {
      expect(mockReconcileLiveDetectionPreference).toHaveBeenCalledTimes(1);
    });

    expect(getLiveDetectionSwitchValue(screen)).toBe(false);
    expect(mockStopSmsListener).toHaveBeenCalledTimes(1);
  });

  it("opens the custom SMS sync permission modal before requesting Android permission", async () => {
    mockSmsPermissionStatus = "undetermined";
    const screen = renderSettings();

    fireEvent.press(screen.getByText("sync_new"));

    expect(
      await screen.findByText("sms_sync_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("sms_permission_allow")).toBeTruthy();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalledWith("/sms-scan");
  });

  it("opens SMS scan after allowing SMS sync permission", async () => {
    mockSmsPermissionStatus = "undetermined";
    mockRequestPermission.mockResolvedValue("granted");
    const screen = renderSettings();

    fireEvent.press(screen.getByText("sync_new"));
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/sms-scan");
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestLiveDetectionPermission).not.toHaveBeenCalled();
  });

  it("keeps SMS sync recovery actionable when SMS permission can still be requested", async () => {
    mockSmsPermissionStatus = "undetermined";
    mockRequestPermission.mockResolvedValue("denied");
    const screen = renderSettings();

    fireEvent.press(screen.getByText("sync_new"));
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    expect(
      await screen.findByText("sms_sync_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("sms_permission_allow")).toBeTruthy();
    expect(mockRouterPush).not.toHaveBeenCalledWith("/sms-scan");
  });

  it("opens settings from blocked SMS sync recovery", async () => {
    mockSmsPermissionStatus = "blocked";
    const screen = renderSettings();

    fireEvent.press(screen.getByText("sync_new"));
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("enables live detection after retrying SMS permission successfully", async () => {
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockSetLiveDetectionEnabled).toHaveBeenCalledWith(true);
    });
    expect(mockRequestLiveDetectionPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockGetNotificationPermissionStatus).toHaveBeenCalledTimes(1);
    expect(mockRequestNotificationPermissionStatus).not.toHaveBeenCalled();
    expect(mockStartSmsListener).toHaveBeenCalledTimes(1);
  });

  it("opens the Allow notifications modal when notifications are not requested yet", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    mockGetNotificationPermissionStatus.mockResolvedValue("undetermined");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(
      await screen.findByText("notification_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("notification_permission_allow")).toBeTruthy();
    expect(mockRequestNotificationPermissionStatus).not.toHaveBeenCalled();
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);
    expect(mockStartSmsListener).not.toHaveBeenCalled();
  });

  it("keeps notification recovery actionable when notifications were denied but can be requested again", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    mockGetNotificationPermissionStatus.mockResolvedValue("denied");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(
      await screen.findByText("notification_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("notification_permission_allow")).toBeTruthy();
    expect(mockRequestNotificationPermissionStatus).not.toHaveBeenCalled();
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);
    expect(mockStartSmsListener).not.toHaveBeenCalled();
  });

  it("keeps the live detection switch on while enable work is pending", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    const notificationCheck = createDeferred<NotificationPermissionStatus>();
    mockGetNotificationPermissionStatus.mockReturnValue(
      notificationCheck.promise
    );
    const screen = renderSettings();

    expect(getLiveDetectionSwitchValue(screen)).toBe(false);

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(getLiveDetectionSwitchValue(screen)).toBe(true);
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);

    notificationCheck.resolve("granted");

    await waitFor(() => {
      expect(mockSetLiveDetectionEnabled).toHaveBeenCalledWith(true);
    });
    expect(getLiveDetectionSwitchValue(screen)).toBe(true);
  });

  it("enables live detection after retrying notification permission successfully", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    mockGetNotificationPermissionStatus.mockResolvedValue("undetermined");
    mockRequestNotificationPermissionStatus.mockResolvedValue("granted");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockSetLiveDetectionEnabled).toHaveBeenCalledWith(true);
    });
    expect(mockStartSmsListener).toHaveBeenCalledTimes(1);
  });

  it("switches notification recovery to Open Settings when notifications are blocked", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    mockGetNotificationPermissionStatus.mockResolvedValue("undetermined");
    mockRequestNotificationPermissionStatus.mockResolvedValue("blocked");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(
      await screen.findByText("notification_permission_request_title")
    ).toBeTruthy();
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    expect(
      await screen.findByText("notification_permission_blocked_title")
    ).toBeTruthy();
    expect(screen.getByText("permission_open_settings")).toBeTruthy();
  });

  it("opens settings from blocked notification recovery", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    mockGetNotificationPermissionStatus.mockResolvedValue("undetermined");
    mockRequestNotificationPermissionStatus.mockResolvedValue("blocked");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockOpenNotificationSettings).toHaveBeenCalledTimes(1);
    });
  });

  it("enables live detection after returning from settings with notification permission granted", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "granted";
    mockGetNotificationPermissionStatus
      .mockResolvedValueOnce("blocked")
      .mockResolvedValue("granted");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockOpenNotificationSettings).toHaveBeenCalledTimes(1);
      expect(appStateChangeHandler).not.toBeNull();
    });

    act(() => {
      appStateChangeHandler?.("background");
      appStateChangeHandler?.("active");
    });

    await waitFor(() => {
      expect(mockSetLiveDetectionEnabled).toHaveBeenCalledWith(true);
    });
    expect(mockStartSmsListener).toHaveBeenCalledTimes(1);
  });

  it("keeps SMS recovery actionable when SMS permission is denied but can be requested again", async () => {
    mockRequestLiveDetectionPermission.mockResolvedValue("denied");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    expect(
      await screen.findByText("sms_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("sms_permission_allow")).toBeTruthy();
    expect(mockRequestLiveDetectionPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);
    expect(mockStartSmsListener).not.toHaveBeenCalled();
  });

  it("opens the Allow SMS modal when live SMS permission can still be requested", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "undetermined";
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(
      await screen.findByText("sms_permission_request_title")
    ).toBeTruthy();
    expect(screen.getByText("sms_permission_allow")).toBeTruthy();
    expect(mockRequestLiveDetectionPermission).not.toHaveBeenCalled();
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);
    expect(mockStartSmsListener).not.toHaveBeenCalled();
  });

  it("opens SMS settings recovery when live SMS permission can no longer be requested", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "blocked";
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );

    expect(
      await screen.findByText("sms_permission_blocked_title")
    ).toBeTruthy();
    expect(screen.getByText("permission_open_settings")).toBeTruthy();
    expect(mockRequestLiveDetectionPermission).not.toHaveBeenCalled();
    expect(mockSetLiveDetectionEnabled).not.toHaveBeenCalledWith(true);
    expect(mockStartSmsListener).not.toHaveBeenCalled();
  });

  it("switches to Open Settings recovery when Android blocks the SMS prompt", async () => {
    mockRequestLiveDetectionPermission.mockResolvedValue("blocked");
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    expect(
      await screen.findByText("sms_permission_blocked_title")
    ).toBeTruthy();
    expect(mockRequestLiveDetectionPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(screen.getByText("permission_open_settings")).toBeTruthy();
  });

  it("opens device settings from the blocked recovery modal", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "blocked";
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  it("enables live detection after returning from settings with SMS permission granted", async () => {
    mockSmsPermissionStatus = "granted";
    mockLiveDetectionPermissionStatus = "blocked";
    const screen = renderSettings();

    fireEvent(
      screen.getByTestId("live-sms-detection-switch"),
      "valueChange",
      true
    );
    fireEvent.press(await screen.findByTestId("permission-modal-primary"));

    await waitFor(() => {
      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });

    mockLiveDetectionPermissionStatus = "granted";
    screen.rerender(<SettingsScreen />);

    await waitFor(() => {
      expect(mockSetLiveDetectionEnabled).toHaveBeenCalledWith(true);
    });
    expect(mockStartSmsListener).toHaveBeenCalledTimes(1);
  });
});
