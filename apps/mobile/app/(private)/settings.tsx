import { formatToLocalDateString } from "@/utils/dateHelpers";
import { palette } from "@/constants/colors";
import type { CurrencyType } from "@monyvi/db";
import { CURRENCY_INFO_MAP } from "@monyvi/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocale } from "@/context/LocaleContext";

import { CurrencyPicker } from "@/components/currency/CurrencyPicker";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useDatabase } from "@/providers/DatabaseProvider";
import { performLogout } from "@/services/logout-service";
import { setIntroLocaleOverride } from "@/services/intro-flag-service";
import { setPreferredLanguage } from "@/services/profile-service";
import { useSmsPermission } from "@/hooks/useSmsPermission";
import { useSmsSync } from "@/hooks/useSmsSync";
import { useSmsScanContext } from "@/context/SmsScanContext";
import {
  reconcileLiveDetectionPreference,
  setLiveDetectionEnabled,
  isAutoConfirmEnabled,
  setAutoConfirm,
} from "@/services/sms-live-detection-handler";
import {
  startSmsListener,
  stopSmsListener,
} from "@/services/sms-live-listener-service";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import {
  PermissionRecoveryModal,
  type PermissionRecoveryMode,
} from "@/components/permissions/PermissionRecoveryModal";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import {
  getNotificationPermissionStatus,
  openNotificationSettings,
  requestNotificationPermissionStatus,
} from "@/services/notification-service";

type PermissionRecoveryKind = "sms-sync" | "sms-live" | "notification";

interface PermissionRecoveryState {
  readonly kind: PermissionRecoveryKind;
  readonly mode: PermissionRecoveryMode;
}

function getRecoveryModeForPermissionStatus(
  status: "undetermined" | "granted" | "denied" | "blocked"
): PermissionRecoveryMode {
  return status === "blocked" ? "blocked" : "request";
}

/**
 * Render the Settings screen for managing appearance, currency, and general preferences.
 *
 * The screen provides a theme toggle, a preferred currency selector (modal), navigation back, and access to profile and notification options.
 *
 * @returns A JSX element representing the Settings screen UI.
 */
export default function SettingsScreen(): React.JSX.Element {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { preferredCurrency, setPreferredCurrency } = usePreferredCurrency();
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { language } = useLocale();
  const [isCurrencyPickerVisible, setIsCurrencyPickerVisible] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const {
    status: smsPermissionStatus,
    liveDetectionStatus,
    isAndroid,
    requestPermission,
    requestLiveDetectionPermission,
    openSettings,
  } = useSmsPermission();
  const { hasSynced, lastSyncTimestamp } = useSmsSync();
  const { setScanMode } = useSmsScanContext();
  const [isFullRescanModalOpen, setIsFullRescanModalOpen] = useState(false);
  const database = useDatabase();
  const { showToast } = useToast();

  // Logout UI state
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [showForceLogoutError, setShowForceLogoutError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Live detection preferences
  const [liveDetection, setLiveDetection] = useState(false);
  const [isLiveDetectionEnabling, setIsLiveDetectionEnabling] = useState(false);
  const [autoConfirmSms, setAutoConfirmSms] = useState(false);
  const [permissionRecovery, setPermissionRecovery] =
    useState<PermissionRecoveryState | null>(null);
  const [hasPendingLiveDetectionEnable, setHasPendingLiveDetectionEnable] =
    useState(false);
  const [hasPendingNotificationEnable, setHasPendingNotificationEnable] =
    useState(false);
  const [pendingSmsScanMode, setPendingSmsScanMode] = useState<
    "incremental" | "full" | null
  >(null);
  const previousNotificationAppState = useRef<AppStateStatus>(
    AppState.currentState
  );
  const previousSettingsAppState = useRef<AppStateStatus>(
    AppState.currentState
  );

  const reconcileStoredLiveDetection = useCallback(async (): Promise<void> => {
    if (!isAndroid) {
      return;
    }

    const enabled = await reconcileLiveDetectionPreference();
    setLiveDetection(enabled);

    if (!enabled) {
      stopSmsListener();
      setAutoConfirmSms(false);
      return;
    }

    const autoConfirmEnabled = await isAutoConfirmEnabled();
    setAutoConfirmSms(autoConfirmEnabled);
  }, [isAndroid]);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }
    reconcileStoredLiveDetection().catch(console.error);
  }, [isAndroid, reconcileStoredLiveDetection]);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          previousSettingsAppState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          reconcileStoredLiveDetection().catch(console.error);
        }

        previousSettingsAppState.current = nextState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isAndroid, reconcileStoredLiveDetection]);

  const persistLiveDetectionEnabled = useCallback(async (): Promise<void> => {
    setLiveDetection(true);
    await setLiveDetectionEnabled(true);
    startSmsListener();
  }, []);

  const enableLiveDetectionWithGrantedSms =
    useCallback(async (): Promise<void> => {
      setIsLiveDetectionEnabling(true);
      try {
        const notificationStatus = await getNotificationPermissionStatus();

        if (notificationStatus !== "granted") {
          setPermissionRecovery({
            kind: "notification",
            mode: getRecoveryModeForPermissionStatus(notificationStatus),
          });
          return;
        }

        await persistLiveDetectionEnabled();
      } catch {
        showToast({
          type: "error",
          title: tCommon("error"),
        });
      } finally {
        setIsLiveDetectionEnabling(false);
      }
    }, [persistLiveDetectionEnabled, showToast, tCommon]);

  useEffect(() => {
    if (!hasPendingLiveDetectionEnable) return;
    if (liveDetectionStatus !== "granted") return;

    setHasPendingLiveDetectionEnable(false);
    setPermissionRecovery(null);
    enableLiveDetectionWithGrantedSms().catch(() => {
      showToast({
        type: "error",
        title: tCommon("error"),
      });
    });
  }, [
    enableLiveDetectionWithGrantedSms,
    hasPendingLiveDetectionEnable,
    showToast,
    liveDetectionStatus,
    tCommon,
  ]);

  useEffect(() => {
    if (pendingSmsScanMode === null) return;
    if (smsPermissionStatus !== "granted") return;

    setPendingSmsScanMode(null);
    setPermissionRecovery(null);
    setScanMode(pendingSmsScanMode);
    router.push("/sms-scan");
  }, [pendingSmsScanMode, setScanMode, smsPermissionStatus]);

  const handleToggleLiveDetection = useCallback(
    async (value: boolean): Promise<void> => {
      if (!value) {
        setIsLiveDetectionEnabling(false);
        setHasPendingLiveDetectionEnable(false);
        setHasPendingNotificationEnable(false);
        setPermissionRecovery(null);
        setLiveDetection(false);
        await setLiveDetectionEnabled(false);
        stopSmsListener();
        setAutoConfirmSms(false);
        await setAutoConfirm(false);
        return;
      }

      if (liveDetectionStatus !== "granted") {
        setPermissionRecovery({
          kind: "sms-live",
          mode: getRecoveryModeForPermissionStatus(liveDetectionStatus),
        });
        return;
      }

      await enableLiveDetectionWithGrantedSms();
    },
    [enableLiveDetectionWithGrantedSms, liveDetectionStatus]
  );

  const handlePermissionModalCancel = useCallback((): void => {
    setIsLiveDetectionEnabling(false);
    setHasPendingLiveDetectionEnable(false);
    setHasPendingNotificationEnable(false);
    setPendingSmsScanMode(null);
    setPermissionRecovery(null);
  }, []);

  const handlePermissionModalPrimaryPress =
    useCallback(async (): Promise<void> => {
      if (!permissionRecovery) {
        return;
      }

      if (permissionRecovery.kind === "notification") {
        if (permissionRecovery.mode === "blocked") {
          setHasPendingNotificationEnable(true);
          setPermissionRecovery(null);
          await openNotificationSettings();
          return;
        }

        const result = await requestNotificationPermissionStatus();
        if (result === "granted") {
          setPermissionRecovery(null);
          await persistLiveDetectionEnabled();
          return;
        }

        setPermissionRecovery({
          kind: "notification",
          mode: getRecoveryModeForPermissionStatus(result),
        });
        return;
      }

      if (permissionRecovery.kind === "sms-sync") {
        if (permissionRecovery.mode === "blocked") {
          setPermissionRecovery(null);
          await openSettings();
          return;
        }

        const result = await requestPermission();
        if (result === "granted") {
          const mode = pendingSmsScanMode ?? "incremental";
          setPendingSmsScanMode(null);
          setPermissionRecovery(null);
          setScanMode(mode);
          router.push("/sms-scan");
          return;
        }

        setPermissionRecovery({
          kind: "sms-sync",
          mode: getRecoveryModeForPermissionStatus(result),
        });
        return;
      }

      if (permissionRecovery.mode === "blocked") {
        setHasPendingLiveDetectionEnable(true);
        setPermissionRecovery(null);
        await openSettings();
        return;
      }

      const result = await requestLiveDetectionPermission();

      if (result === "granted") {
        setHasPendingLiveDetectionEnable(false);
        setPermissionRecovery(null);
        await enableLiveDetectionWithGrantedSms();
        return;
      }

      setPermissionRecovery({
        kind: "sms-live",
        mode: getRecoveryModeForPermissionStatus(result),
      });
    }, [
      enableLiveDetectionWithGrantedSms,
      openSettings,
      openNotificationSettings,
      pendingSmsScanMode,
      permissionRecovery,
      persistLiveDetectionEnabled,
      requestLiveDetectionPermission,
      requestPermission,
      setScanMode,
    ]);

  useEffect(() => {
    if (!hasPendingNotificationEnable) {
      return;
    }

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          previousNotificationAppState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          getNotificationPermissionStatus()
            .then((notificationStatus) => {
              if (notificationStatus !== "granted") {
                return;
              }

              setHasPendingNotificationEnable(false);
              return enableLiveDetectionWithGrantedSms();
            })
            .catch(() => {
              showToast({
                type: "error",
                title: tCommon("error"),
              });
            });
        }

        previousNotificationAppState.current = nextState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [
    enableLiveDetectionWithGrantedSms,
    hasPendingNotificationEnable,
    showToast,
    tCommon,
  ]);

  const handleToggleAutoConfirm = useCallback(
    async (value: boolean): Promise<void> => {
      setAutoConfirmSms(value);
      await setAutoConfirm(value);
    },
    []
  );

  const currencyInfo = CURRENCY_INFO_MAP[preferredCurrency];
  const isLiveDetectionSwitchOn = liveDetection || isLiveDetectionEnabling;

  /**
   * Navigate to the scan page, showing permission recovery if needed.
   * Sets the scan mode before navigation.
   */
  const navigateToScan = useCallback(
    (mode: "incremental" | "full"): void => {
      if (!isAndroid) {
        showToast({
          type: "info",
          title: t("sms_android_only"),
        });
        return;
      }

      setScanMode(mode);

      if (smsPermissionStatus === "granted") {
        router.push("/sms-scan");
        return;
      }

      setPendingSmsScanMode(mode);
      setPermissionRecovery({
        kind: "sms-sync",
        mode: getRecoveryModeForPermissionStatus(smsPermissionStatus),
      });
    },
    [isAndroid, smsPermissionStatus, setScanMode, showToast, t]
  );

  const handleIncrementalSync = useCallback((): void => {
    navigateToScan("incremental");
  }, [navigateToScan]);

  const handleCurrencySelect = useCallback(
    (currency: CurrencyType) => {
      // TODO: Replace with structured logging (e.g., Sentry)
      setPreferredCurrency(currency).catch(console.error);
    },
    [setPreferredCurrency]
  );

  const handleLogoutPress = useCallback(async (): Promise<void> => {
    setIsLoggingOut(true);

    const result = await performLogout(database);

    if (result.success) {
      setIsLoggingOut(false);
      router.replace("/auth");
      return;
    }

    setIsLoggingOut(false);

    if (result.error === "no_network") {
      showToast({
        type: "error",
        title: t("no_network_logout"),
      });
      return;
    }

    if (result.error === "sync_failed") {
      setShowSyncWarning(true);
      return;
    }

    // "unknown" or any other unhandled error
    showToast({
      type: "error",
      title: t("logout_error"),
    });
  }, [database, showToast, t]);

  const handleForceLogout = useCallback(async (): Promise<void> => {
    setShowSyncWarning(false);
    setIsLoggingOut(true);

    const result = await performLogout(database, true);

    setIsLoggingOut(false);

    if (result.success) {
      router.replace("/auth");
      return;
    }

    // Force logout failed — show retry modal
    setShowForceLogoutError(true);
  }, [database]);

  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  const handleLanguageChange = useCallback(
    async (lang: "en" | "ar"): Promise<void> => {
      if (isChangingLanguage) return;
      setIsChangingLanguage(true);
      try {
        // Three writes, in order, before the RTL-flip reload kicks in:
        //
        //   1. `setIntroLocaleOverride(lang)` — device-scoped AsyncStorage
        //      key (FR-030). `initI18n()` reads this FIRST on cold launch,
        //      so the next reload starts with the right language and there
        //      is no flash of the previous locale.
        //   2. `setPreferredLanguage(lang)` — persists to
        //      `profile.preferred_language` AND calls `changeLanguage`.
        //      Updating the profile is required because `AppReadyGate`
        //      syncs the runtime to `profile.preferred_language` on cold
        //      launch — leaving the profile stale would make the gate
        //      revert the user's choice.
        //
        // The previous code called `changeLanguage` directly without
        // updating either the override OR the profile, which caused the
        // 2026-04-26 user-reported regression where the app reloaded but
        // came back in the OLD language.
        await setIntroLocaleOverride(lang);
        await setPreferredLanguage(lang);
      } catch (error) {
        // TODO: Replace with structured logging (e.g., Sentry)
        console.error("Failed to change language:", error);
        showToast({
          type: "error",
          title: tCommon("error"),
          message: t("language_change_failed"),
        });
      } finally {
        setIsChangingLanguage(false);
      }
    },
    [isChangingLanguage, showToast, t, tCommon]
  );

  return (
    <GradientBackground className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2.5 mb-5">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {t("title")}
        </Text>
        <View className="w-6" />
      </View>
      <ScrollView contentContainerClassName="px-5">
        {/* Language Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ms-1 uppercase text-slate-500 dark:text-slate-400">
            {t("language")}
          </Text>

          <View className="p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View className="w-8 bg-blue-600 dark:bg-blue-500 h-8 rounded-lg justify-center items-center">
                <Ionicons name="language" size={20} color="#FFF" />
              </View>
              <View className="flex-1">
                <Dropdown<string>
                  label=""
                  items={
                    [
                      { value: "en", label: t("language_english") },
                      { value: "ar", label: t("language_arabic") },
                    ] as ReadonlyArray<DropdownItem<string>>
                  }
                  value={language}
                  onChange={(val) => {
                    void handleLanguageChange(val as "en" | "ar");
                  }}
                  disabled={isChangingLanguage}
                  isOpen={isLanguageDropdownOpen}
                  onToggle={() => setIsLanguageDropdownOpen((prev) => !prev)}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ms-1 uppercase text-slate-500 dark:text-slate-400">
            {t("appearance")}
          </Text>

          <View className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View className="w-8 dark:bg-[#6366f1] bg-[#fb923c] h-8 rounded-lg justify-center items-center">
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={20}
                  color="#FFF"
                />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                {t("dark_mode")}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#767577", true: palette.nileGreen[500] }}
              thumbColor={isDark ? "#FFF" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Currency Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ms-1 uppercase text-slate-500 dark:text-slate-400">
            {t("currency")}
          </Text>

          <TouchableOpacity
            onPress={() => setIsCurrencyPickerVisible(true)}
            className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 bg-nileGreen-700 dark:bg-nileGreen-600 h-8 rounded-lg justify-center items-center">
                <Text className="text-base">{currencyInfo?.flag ?? "💱"}</Text>
              </View>
              <View>
                <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                  {t("preferred_currency")}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  {currencyInfo?.name ?? preferredCurrency}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-semibold text-nileGreen-600 dark:text-nileGreen-400">
                {preferredCurrency}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.text.secondary}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* SMS Sync Section (Android only) */}
        {isAndroid && (
          <View className="mb-8">
            <Text className="text-[13px] font-semibold mb-3 ms-1 uppercase text-slate-500 dark:text-slate-400">
              {t("sms_sync")}
            </Text>

            {/* Sync New Messages (incremental) */}
            <TouchableOpacity
              onPress={() => {
                handleIncrementalSync();
              }}
              className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-8 bg-emerald-600 dark:bg-emerald-500 h-8 rounded-lg justify-center items-center">
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={20}
                    color={palette.slate[25]}
                  />
                </View>
                <View>
                  <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                    {t("sync_new")}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {hasSynced && lastSyncTimestamp
                      ? t("last_synced", {
                          date: formatToLocalDateString(
                            new Date(lastSyncTimestamp)
                          ),
                        })
                      : smsPermissionStatus === "granted"
                        ? t("scan_inbox")
                        : t("grant_sms_permission")}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.text.secondary}
              />
            </TouchableOpacity>

            {/* Full Re-scan */}
            {hasSynced && (
              <TouchableOpacity
                onPress={() => {
                  setIsFullRescanModalOpen(true);
                }}
                className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 bg-orange-600 dark:bg-orange-500 h-8 rounded-lg justify-center items-center">
                    <Ionicons name="refresh" size={20} color="#FFF" />
                  </View>
                  <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                    {t("full_rescan")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Live SMS Detection Section (Android only) */}
        {isAndroid && (
          <View className="mb-8">
            <Text className="text-[13px] font-semibold mb-3 ms-1 uppercase text-slate-500 dark:text-slate-400">
              {t("live_detection")}
            </Text>

            {/* Live Detection Toggle */}
            <View className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-8 bg-violet-600 dark:bg-violet-500 h-8 rounded-lg justify-center items-center">
                  <Ionicons name="radio" size={20} color={palette.slate[25]} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                    {t("live_detection")}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {t("auto_detect_description")}
                  </Text>
                </View>
              </View>
              <Switch
                testID="live-sms-detection-switch"
                value={isLiveDetectionSwitchOn}
                onValueChange={handleToggleLiveDetection}
                trackColor={{ false: "#767577", true: palette.nileGreen[500] }}
                thumbColor={isLiveDetectionSwitchOn ? "#FFF" : "#f4f3f4"}
              />
            </View>

            {/* Auto Confirm Toggle */}
            <View
              className={`flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5 ${!liveDetection ? "opacity-50" : ""}`}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-8 bg-indigo-600 dark:bg-indigo-500 h-8 rounded-lg justify-center items-center">
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                    {t("auto_confirm")}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {t("auto_confirm_description")}
                  </Text>
                </View>
              </View>
              <Switch
                value={autoConfirmSms}
                onValueChange={handleToggleAutoConfirm}
                disabled={!liveDetection}
                trackColor={{ false: "#767577", true: palette.nileGreen[500] }}
                thumbColor={autoConfirmSms ? "#FFF" : "#f4f3f4"}
              />
            </View>
          </View>
        )}

        {/* Profile & Notifications Section */}
        <View className="mb-8">
          {/* Profile */}
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View className="w-8 dark:bg-[#3b82f6] bg-[#fb923c] h-8 rounded-lg justify-center items-center">
                <Ionicons name="person" size={20} color="#FFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                  {t("profile")}
                </Text>
                {user?.email && (
                  <Text
                    className="text-xs text-slate-500 dark:text-slate-400"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {user.email}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.secondary}
            />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5">
            <View className="flex-row items-center gap-3">
              <View className="w-8 dark:bg-[#f43f5e] bg-[#fb923c] h-8 rounded-lg justify-center items-center">
                <Ionicons name="notifications" size={20} color="#FFF" />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                {t("notifications")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogoutPress}
          className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-8 dark:bg-red-700 bg-red-600 h-8 rounded-lg justify-center items-center">
              {isLoggingOut ? (
                <ActivityIndicator size={16} color="#FFF" />
              ) : (
                <Ionicons name="log-out-outline" size={20} color="#FFF" />
              )}
            </View>
            <Text className="text-base font-medium text-red-600 dark:text-red-400">
              {isLoggingOut ? tCommon("loading") : t("logout")}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.text.secondary}
          />
        </TouchableOpacity>
      </ScrollView>
      {/* {t("full_rescan")} Confirmation Modal */}
      <ConfirmationModal
        visible={isFullRescanModalOpen}
        onConfirm={() => {
          navigateToScan("full");
        }}
        onCancel={() => setIsFullRescanModalOpen(false)}
        title={t("rescan_title")}
        message={t("rescan_message")}
        confirmLabel={t("rescan_confirm")}
        variant="warning"
      />

      {/* Sync Failure Warning Modal */}
      <ConfirmationModal
        visible={showSyncWarning}
        variant="warning"
        icon="cloud-offline-outline"
        title={t("sync_failed_title")}
        message={t("sync_failed_message")}
        confirmLabel={t("proceed_anyway")}
        cancelLabel={tCommon("cancel")}
        onConfirm={() => {
          // TODO: Replace with structured logging (e.g., Sentry)
          handleForceLogout().catch(console.error);
        }}
        onCancel={() => setShowSyncWarning(false)}
      />
      {/* Force Logout Error Modal */}
      <ConfirmationModal
        visible={showForceLogoutError}
        variant="warning"
        icon="alert-circle-outline"
        title={t("logout_failed")}
        message={t("logout_failed_message")}
        confirmLabel={tCommon("retry")}
        cancelLabel={tCommon("cancel")}
        onConfirm={() => {
          setShowForceLogoutError(false);
          handleForceLogout().catch(console.error);
        }}
        onCancel={() => setShowForceLogoutError(false)}
      />
      <PermissionRecoveryModal
        visible={permissionRecovery !== null}
        mode={permissionRecovery?.mode ?? "request"}
        icon={
          permissionRecovery?.kind === "notification"
            ? "notifications-outline"
            : permissionRecovery?.mode === "blocked"
              ? "settings-outline"
              : "chatbubble-ellipses-outline"
        }
        onPrimaryPress={() => {
          handlePermissionModalPrimaryPress().catch(() => {
            showToast({
              type: "error",
              title: tCommon("error"),
            });
          });
        }}
        onCancel={handlePermissionModalCancel}
        title={
          permissionRecovery?.kind === "notification"
            ? permissionRecovery.mode === "blocked"
              ? t("notification_permission_blocked_title")
              : t("notification_permission_request_title")
            : permissionRecovery?.kind === "sms-sync"
              ? permissionRecovery.mode === "blocked"
                ? t("sms_sync_permission_blocked_title")
                : t("sms_sync_permission_request_title")
              : permissionRecovery?.mode === "blocked"
                ? t("sms_permission_blocked_title")
                : t("sms_permission_request_title")
        }
        message={
          permissionRecovery?.kind === "notification"
            ? permissionRecovery.mode === "blocked"
              ? t("notification_permission_blocked_message")
              : t("notification_permission_request_message")
            : permissionRecovery?.kind === "sms-sync"
              ? permissionRecovery.mode === "blocked"
                ? t("sms_sync_permission_blocked_message")
                : t("sms_sync_permission_request_message")
              : permissionRecovery?.mode === "blocked"
                ? t("sms_permission_blocked_message")
                : t("sms_permission_request_message")
        }
        primaryLabel={
          permissionRecovery?.mode === "blocked"
            ? t("permission_open_settings")
            : permissionRecovery?.kind === "notification"
              ? t("notification_permission_allow")
              : t("sms_permission_allow")
        }
        cancelLabel={t("permission_not_now")}
      />
      {/* Currency Picker Modal */}
      <CurrencyPicker
        visible={isCurrencyPickerVisible}
        selectedCurrency={preferredCurrency}
        onSelect={handleCurrencySelect}
        onClose={() => setIsCurrencyPickerVisible(false)}
      />
    </GradientBackground>
  );
}
