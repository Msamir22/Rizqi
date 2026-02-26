import { palette } from "@/constants/colors";
import type { CurrencyType } from "@astik/db";
import { CURRENCY_INFO_MAP } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CurrencyPicker } from "../components/currency/CurrencyPicker";
import { GradientBackground } from "../components/ui/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { usePreferredCurrency } from "../hooks/usePreferredCurrency";
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

/**
 * Render the Settings screen for managing appearance, currency, and general preferences.
 *
 * The screen provides a theme toggle, a preferred currency selector (modal), navigation back, and access to profile and notification options.
 *
 * @returns A JSX element representing the Settings screen UI.
 */
export default function SettingsScreen(): React.JSX.Element {
  const { theme, mode, toggleTheme } = useTheme();
  const { preferredCurrency, setPreferredCurrency } = usePreferredCurrency();
  const [isCurrencyPickerVisible, setIsCurrencyPickerVisible] = useState(false);
  const {
    status: smsPermissionStatus,
    isAndroid,
    requestPermission,
  } = useSmsPermission();
  const { hasSynced, lastSyncTimestamp } = useSmsSync();
  const { setScanMode } = useSmsScanContext();
  const [isFullRescanModalOpen, setIsFullRescanModalOpen] = useState(false);

  // Live detection preferences
  const [liveDetection, setLiveDetection] = useState(false);
  const [autoConfirmSms, setAutoConfirmSms] = useState(false);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }
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
        Alert.alert(
          "SMS Sync",
          "SMS transaction sync is only available on Android devices.",
          [{ text: "OK" }]
        );
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
    [isAndroid, smsPermissionStatus, requestPermission, setScanMode]
  );

  const handleIncrementalSync = useCallback(async (): Promise<void> => {
    await navigateToScan("incremental");
  }, [navigateToScan]);

  const handleCurrencySelect = useCallback(
    (currency: CurrencyType) => {
      setPreferredCurrency(currency).catch(console.error);
    },
    [setPreferredCurrency]
  );

  return (
    <GradientBackground className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2.5 mb-5">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900 dark:text-slate-50">
          Settings
        </Text>
        <View className="w-6" />
      </View>
      <ScrollView contentContainerClassName="px-5">
        {/* Appearance Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
            Appearance
          </Text>

          <View className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View className="w-8 dark:bg-[#6366f1] bg-[#fb923c] h-8 rounded-lg justify-center items-center">
                <Ionicons
                  name={mode === "dark" ? "moon" : "sunny"}
                  size={20}
                  color="#FFF"
                />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                Dark Mode
              </Text>
            </View>
            <Switch
              value={mode === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: "#767577", true: palette.nileGreen[500] }}
              thumbColor={mode === "dark" ? "#FFF" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Currency Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
            Currency
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
                  Preferred Currency
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
            <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
              SMS Sync
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
                    Sync New Messages
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {hasSynced && lastSyncTimestamp
                      ? `Last synced ${new Date(lastSyncTimestamp).toLocaleDateString()}`
                      : smsPermissionStatus === "granted"
                        ? "Scan inbox for financial SMS"
                        : "Grant permission to read SMS"}
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
                className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 bg-amber-600 dark:bg-amber-500 h-8 rounded-lg justify-center items-center">
                    <Ionicons
                      name="refresh"
                      size={20}
                      color={palette.slate[25]}
                    />
                  </View>
                  <View>
                    <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                      Full Re-scan
                    </Text>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      Scan all messages (Previously scanned messages
                      auto-skipped)
                    </Text>
                  </View>
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
            <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
              Live Detection
            </Text>

            {/* Live Detection Toggle */}
            <View className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-8 bg-violet-600 dark:bg-violet-500 h-8 rounded-lg justify-center items-center">
                  <Ionicons name="radio" size={20} color={palette.slate[25]} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                    Live SMS Detection
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    Detect transactions from incoming SMS
                  </Text>
                </View>
              </View>
              <Switch
                value={liveDetection}
                onValueChange={(v) => {
                  handleToggleLiveDetection(v).catch(console.error);
                }}
                trackColor={{ false: "#767577", true: palette.nileGreen[500] }}
                thumbColor={liveDetection ? "#FFF" : "#f4f3f4"}
              />
            </View>

            {/* Auto-confirm Toggle (only when live detection is on) */}
            {liveDetection && (
              <View className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-8 bg-sky-600 dark:bg-sky-500 h-8 rounded-lg justify-center items-center">
                    <Ionicons
                      name="checkmark-done"
                      size={20}
                      color={palette.slate[25]}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                      Auto-confirm
                    </Text>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      {autoConfirmSms
                        ? "Transactions saved automatically"
                        : "Ask me each time (notification)"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={autoConfirmSms}
                  onValueChange={(v) => {
                    handleToggleAutoConfirm(v).catch(console.error);
                  }}
                  trackColor={{
                    false: "#767577",
                    true: palette.nileGreen[500],
                  }}
                  thumbColor={autoConfirmSms ? "#FFF" : "#f4f3f4"}
                />
              </View>
            )}
          </View>
        )}

        {/* General Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
            General
          </Text>

          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View className="w-8 dark:bg-[#3b82f6] bg-[#fb923c] h-8 rounded-lg justify-center items-center">
                <Ionicons name="person" size={20} color="#FFF" />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                Profile
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.secondary}
            />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5">
            <View className="flex-row items-center gap-3">
              <View className="w-8 dark:bg-[#f43f5e] bg-[#fb923c] h-8 rounded-lg justify-center items-center">
                <Ionicons name="notifications" size={20} color="#FFF" />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                Notifications
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Full Rescan Confirmation Modal */}
      <ConfirmationModal
        visible={isFullRescanModalOpen}
        onConfirm={() => {
          navigateToScan("full").catch(console.error);
        }}
        onCancel={() => setIsFullRescanModalOpen(false)}
        title="Full Re-scan"
        message="This will scan all SMS messages from scratch. Previously scanned messages will be automatically skipped."
        confirmLabel="Re-scan"
        variant="warning"
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
