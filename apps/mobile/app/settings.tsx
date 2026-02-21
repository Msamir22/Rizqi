import { palette } from "@/constants/colors";
import type { CurrencyType } from "@astik/db";
import { CURRENCY_INFO_MAP } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { CurrencyPicker } from "../components/currency/CurrencyPicker";
import { GradientBackground } from "../components/ui/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { usePreferredCurrency } from "../hooks/usePreferredCurrency";

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

  const currencyInfo = CURRENCY_INFO_MAP[preferredCurrency];

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