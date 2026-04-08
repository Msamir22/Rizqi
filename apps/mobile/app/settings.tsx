import { formatToLocalDateString } from "@/utils/dateHelpers";
import { palette } from "@/constants/colors";
import type { CurrencyType } from "@astik/db";
import { CURRENCY_INFO_MAP } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocale } from "../context/LocaleContext";

import { CurrencyPicker } from "../components/currency/CurrencyPicker";
import { GradientBackground } from "../components/ui/GradientBackground";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { usePreferredCurrency } from "../hooks/usePreferredCurrency";
import { useDatabase } from "../providers/DatabaseProvider";
import { performLogout } from "../services/logout-service";
import { changeLanguage } from "../i18n/changeLanguage";
import { useSmsPermission } from "../hooks/useSmsPermission";
import { useSmsSync } from "../hooks/useSmsSync";
import { useSmsScanContext } from "../context/SmsScanContext";
import {
  isLiveDetectionEnabled,
  setLiveDetectionEnabled,
  isAutoConfirmEnabled,
  setAutoConfirm,
} from "../services/sms-live-detection-handler";
import {
  startSmsListener,
  stopSmsListener,
} from "../services/sms-live-listener-service";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";

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
    isAndroid,
    requestPermission,
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
  const [autoConfirmSms, setAutoConfirmSms] = useState(false);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }
    // TODO: Replace with structured logging (e.g., Sentry)
    isLiveDetectionEnabled().then(setLiveDetection).catch(console.error);
    isAutoConfirmEnabled().then(setAutoConfirmSms).catch(console.error);
  }, [isAndroid]);

  const handleToggleLiveDetection = useCallback(
    async (value: boolean): Promise<void> => {
      setLiveDetection(value);
      await setLiveDetectionEnabled(value);
      if (value) {
        startSmsListener();
      } else {
        stopSmsListener();
        setAutoConfirmSms(false);
        await setAutoConfirm(false);
      }
    },
    []
  );

  const handleToggleAutoConfirm = useCallback(
    async (value: boolean): Promise<void> => {
      setAutoConfirmSms(value);
      await setAutoConfirm(value);
    },
    []
  );

  const currencyInfo = CURRENCY_INFO_MAP[preferredCurrency];

  /**
   * Navigate to the scan page, requesting permission if needed.
   * Sets the scan mode before navigation.
   */
  const navigateToScan = useCallback(
    async (mode: "incremental" | "full"): Promise<void> => {
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

      const result = await requestPermission();
      if (result === "granted") {
        router.push("/sms-scan");
      }
    },
    [
      isAndroid,
      smsPermissionStatus,
      requestPermission,
      setScanMode,
      showToast,
      t,
    ]
  );

  const handleIncrementalSync = useCallback(async (): Promise<void> => {
    await navigateToScan("incremental");
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
        await changeLanguage(lang);
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
                handleIncrementalSync().catch(() => {});
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
                value={liveDetection}
                onValueChange={handleToggleLiveDetection}
                trackColor={{ false: "#767577", true: palette.nileGreen[500] }}
                thumbColor={liveDetection ? "#FFF" : "#f4f3f4"}
              />
            </View>

            {/* Auto Confirm Toggle */}
            <View className={`flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5 ${!liveDetection ? "opacity-50" : ""}`}>
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
          // TODO: Replace with structured logging (e.g., Sentry)
          navigateToScan("full").catch(console.error);
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
