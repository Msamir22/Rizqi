import { TAB_BAR_HEIGHT } from "@/constants/ui";
import { useTheme } from "@/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

/**
 * Charts Screen - Analytics and charts view
 *
 * Placeholder screen for Charts tab navigation.
 * Will display financial analytics and spending charts.
 */
export default function ChartsScreen(): React.ReactElement {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <LinearGradient
        colors={
          theme.backgroundGradient as unknown as readonly [string, string]
        }
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
            paddingHorizontal: 16,
          }}
        >
          {/* Header */}
          <View className="mb-6">
            <Text
              className="text-2xl font-bold"
              style={{ color: theme.text.primary }}
            >
              {t("stats")}
            </Text>
            <Text
              className="mt-1 text-sm"
              style={{ color: theme.text.secondary }}
            >
              {t("charts_subtitle")}
            </Text>
          </View>

          {/* Placeholder content */}
          <View
            className="items-center justify-center rounded-2xl p-8"
            style={{ backgroundColor: theme.surface }}
          >
            <Text
              className="text-center text-base"
              style={{ color: theme.text.muted }}
            >
              {t("coming_soon")}
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
