import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { AstikLogo } from "../ui/AstikLogo";

// TODO: Replace with user context when available
const USER_NAME = "Mohamed";

interface TopNavProps {
  onMenuPress?: () => void;
  /** Optional: shows a currency chip button when provided */
  currencyCode?: string;
  currencyFlag?: string;
  onCurrencyPress?: () => void;
  /** When true, the currency chip is disabled (e.g., while the preference loads) */
  isCurrencyLoading?: boolean;
}

/**
 * Renders the top navigation bar with branding, a time-based greeting, and action controls.
 *
 * @param onMenuPress - Optional handler invoked when the hamburger menu is pressed.
 * @param currencyCode - Optional currency code shown in a currency chip (e.g., "USD"); the chip is rendered only when this and `onCurrencyPress` are provided.
 * @param currencyFlag - Optional emoji or short text shown before the currency code; defaults to "💱" when omitted.
 * @param onCurrencyPress - Optional handler invoked when the currency chip is pressed.
 * @returns The top navigation React element for use within a safe-area layout.
 */
export function TopNav({
  onMenuPress,
  currencyCode,
  currencyFlag,
  onCurrencyPress,
  isCurrencyLoading = false,
}: TopNavProps): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation("common");

  const getGreeting = (): string => {
    const hours = new Date().getHours();
    if (hours < 12) return t("good_morning");
    if (hours < 18) return t("good_afternoon");
    return t("good_evening");
  };

  return (
    <SafeAreaView edges={["top"]} className="pb-2">
      <View className=" flex-row items-center mb-5 mt-2">
        {/* Hamburger Menu */}
        {onMenuPress && (
          <TouchableOpacity
            onPress={onMenuPress}
            accessibilityLabel={t("open_menu")}
            accessibilityRole="button"
            className="me-3"
          >
            <Ionicons
              name="menu-outline"
              size={26}
              color={theme.text.primary}
            />
          </TouchableOpacity>
        )}

        {/* Left Side: Logo & Greeting */}
        <View className="flex-row items-center gap-3 flex-1">
          <AstikLogo width={80} height={25} color={theme.text.primary} />

          {/* Vertical Divider */}
          <View className="h-8 w-[1px] opacity-30 bg-slate-400 dark:bg-slate-200" />

          {/* Greeting Text */}
          <View className="flex-1 justify-center">
            <Text
              numberOfLines={1}
              style={{ color: theme.text.secondary }}
              className="font-medium font-regular text-sm tracking-wider"
            >
              {getGreeting()}
            </Text>

            <Text
              numberOfLines={1}
              style={{ color: theme.text.primary }}
              className="font-bold font-regular text-sm mt-0.5"
            >
              {USER_NAME}
            </Text>
          </View>
        </View>

        {/* Right Side: Actions */}
        <View className="flex-row items-center gap-2">
          {/* Currency Chip */}
          {currencyCode && onCurrencyPress && (
            <TouchableOpacity
              onPress={onCurrencyPress}
              disabled={isCurrencyLoading}
              accessibilityLabel={t("change_currency")}
              accessibilityRole="button"
              style={{ backgroundColor: theme.surfaceHighlight }}
              className={`flex-row items-center gap-1 px-2.5 py-1.5 rounded-full ${isCurrencyLoading ? "opacity-50" : ""}`}
            >
              <Text className="text-sm">{currencyFlag ?? "💱"}</Text>
              <Text
                style={{ color: theme.text.primary }}
                className="text-xs font-bold"
              >
                {currencyCode}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={theme.text.secondary}
              />
            </TouchableOpacity>
          )}

          {/* Settings Button */}
          <TouchableOpacity
            style={{
              backgroundColor: theme.surfaceHighlight,
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.push("/settings")}
            accessibilityLabel={t("settings")}
            accessibilityRole="button"
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={theme.text.secondary}
            />
          </TouchableOpacity>

          {/* Notification Button */}
          <TouchableOpacity
            accessibilityLabel={t("notifications")}
            accessibilityRole="button"
            style={{ backgroundColor: theme.surfaceHighlight }}
            className="w-10 h-10 rounded-full items-center justify-center relative"
            onPress={() => {
              // TODO: Implement notifications navigation
            }}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={theme.text.secondary}
            />
            {/* Notification Badge */}
            <View
              style={{
                borderColor: theme.surface,
              }}
              className="absolute top-2 end-2 w-2 h-2 rounded-full border bg-red-500 dark:bg-red-600"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
