/**
 * VerificationPendingView — Email Verification Pending State
 *
 * Displayed after a successful sign-up when the user's email
 * needs verification. Shows instructions and a resend button.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Extracted from auth.tsx to enforce SRP — auth.tsx orchestrates
 *   screen state, this component handles the verification pending UI.
 *
 * @module VerificationPendingView
 */

import { palette } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

// =============================================================================
// Types
// =============================================================================

export interface VerificationPendingViewProps {
  readonly email: string;
  readonly isDark: boolean;
  readonly onResend: () => Promise<void>;
  readonly onBack: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function VerificationPendingView({
  email,
  isDark,
  onResend,
  onBack,
}: VerificationPendingViewProps): React.JSX.Element {
  const { t } = useTranslation("auth");
  return (
    <>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        {/* Mail Icon */}
        <View className="w-24 h-24 rounded-full bg-nileGreen-500/15 items-center justify-center">
          <Ionicons
            name="mail-outline"
            size={48}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          />
        </View>

        <Text className="text-2xl font-bold text-center text-text-primary dark:text-text-primary-dark">
          {t("check_your_inbox")}
        </Text>

        <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[300px] leading-6">
          {t("verification_sent_message", { email })}
        </Text>

        {/* Resend Button */}
        <TouchableOpacity
          onPress={() => {
            onResend().catch(() => {});
          }}
          className="py-3 px-6 rounded-2xl border border-nileGreen-500"
          activeOpacity={0.8}
          accessibilityLabel={t("resend_email")}
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-nileGreen-400">
            {t("resend_email")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Back to Sign In */}
      <TouchableOpacity
        onPress={onBack}
        className="py-3 items-center"
        activeOpacity={0.6}
        accessibilityLabel={t("back_to_sign_in")}
        accessibilityRole="button"
      >
        <View className="flex-row items-center gap-1">
          <Ionicons
            name="arrow-back"
            size={14}
            color={isDark ? palette.slate[400] : palette.slate[500]}
          />
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {t("back_to_sign_in")}
          </Text>
        </View>
      </TouchableOpacity>
    </>
  );
}
