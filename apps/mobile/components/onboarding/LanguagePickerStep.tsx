/**
 * LanguagePickerStep Component
 *
 * Full-screen onboarding step that lets the user pick their language.
 * Shown before the carousel if no language preference is stored.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Pure UI — receives callbacks via props, no side effects
 * - SOLID: SRP — only renders language options and forwards selection
 *
 * @module LanguagePickerStep
 */

import type { SupportedLanguage } from "@/i18n/changeLanguage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getLocales } from "expo-localization";
import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LanguagePickerStepProps {
  /** Called when the user selects a language. */
  readonly onLanguageSelected: (language: SupportedLanguage) => void;
  /** Whether a language change is in progress. */
  readonly isLoading?: boolean;
  /** Pre-selected language from i18n context. Falls back to device locale. */
  readonly initialLanguage?: SupportedLanguage;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}> = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇪🇬",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LanguagePickerStep({
  onLanguageSelected,
  isLoading = false,
  initialLanguage,
}: LanguagePickerStepProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("common");
  const deviceLanguage = getLocales()[0]?.languageCode;
  const [selectedCode, setSelectedCode] = useState<SupportedLanguage>(
    initialLanguage ?? (deviceLanguage === "ar" ? "ar" : "en")
  );

  const handleSelect = (code: SupportedLanguage): void => {
    setSelectedCode(code);
  };

  const handleContinue = (): void => {
    onLanguageSelected(selectedCode);
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {/* Background Gradient for Dark Mode */}
      {isDark && (
        <LinearGradient
          colors={theme.backgroundGradient}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Content Container */}
      <View
        className="flex-1 px-8 pt-20"
        style={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-center text-text-primary dark:text-text-primary-dark mb-3">
            {t("select_language")}
          </Text>
          <Text className="text-center text-text-secondary dark:text-text-secondary-dark text-base">
            {t("select_language_description")}
          </Text>
        </View>

        {/* Language Options */}
        <View className="flex-1 justify-center gap-6">
          {LANGUAGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.code}
              onPress={() => handleSelect(option.code)}
              activeOpacity={0.7}
              className={`flex-row items-center p-5 rounded-2xl border-2 ${
                selectedCode === option.code
                  ? "border-nileGreen-500 bg-nileGreen-50 dark:bg-nileGreen-900/20"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
              // eslint-disable-next-line react-native/no-inline-styles
              style={[
                styles.shadow,
                { elevation: selectedCode === option.code ? 8 : 2 },
              ]}
            >
              {/* Flag */}
              <Text className="text-4xl me-4" style={{ fontSize: 32 }}>
                {/* eslint-disable-next-line react-native/no-inline-styles */}
                {option.flag}
              </Text>

              {/* Language Info */}
              <View className="flex-1">
                <Text
                  className="text-xl font-semibold text-text-primary dark:text-text-primary-dark"
                  numberOfLines={1}
                >
                  {option.name}
                </Text>
                <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                  {option.nativeName}
                </Text>
              </View>

              {/* Selection Indicator */}
              {selectedCode === option.code && (
                <View className="w-6 h-6 rounded-full items-center justify-center bg-nileGreen-500">
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={isLoading}
          className="rounded-2xl py-[18px] bg-nileGreen-500 w-full flex-row items-center justify-center"
          // eslint-disable-next-line react-native/no-inline-styles
          style={[styles.shadow, { elevation: 4, opacity: isLoading ? 0.6 : 1 }]}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-white font-semibold text-lg">
                {t("continue")}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="white"
                className="ms-2"
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
});
