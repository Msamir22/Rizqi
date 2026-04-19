/**
 * RetrySyncScreen — Variant 2 "Status Card" (approved 2026-04-18)
 *
 * Shown when the initial pull-sync fails or times out (FR-006).
 * Two actions only: Retry (re-triggers sync) and Sign out (clears session).
 * No top-app-bar — the retry screen has no valid close destination.
 *
 * Theming: follows the app's standard pattern — semantic tokens
 * (`bg-background`, `bg-surface`, `text-text-primary`, …) + `dark:` variants,
 * so the screen adapts to the system theme. The approved mockup
 * (`mockups/retry-sync-screen.html`) was drawn in dark mode only, but the
 * color families map cleanly onto the light-mode tokens.
 *
 * Mockup reference: specs/024-skip-returning-onboarding/mockups/retry-sync-screen.html
 *
 * @module RetrySyncScreen
 */

import { palette } from "@/constants/colors";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RetrySyncScreenProps {
  /** Re-trigger the initial sync. */
  readonly onRetry: () => void;
  /** Clear the session and return to sign-in. */
  readonly onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RetrySyncScreen({
  onRetry,
  onSignOut,
}: RetrySyncScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");

  return (
    <View
      className="flex-1 items-center justify-center px-4 bg-background dark:bg-background-dark"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Status Card */}
      <View className="w-full max-w-[342px] bg-surface dark:bg-surface-dark rounded-2xl p-6 items-center shadow-lg">
        {/* Icon Tile */}
        <View className="w-12 h-12 rounded-xl items-center justify-center mb-5 bg-red-500/10 dark:bg-red-500/[0.15]">
          <Ionicons name="cloud-offline" size={24} color={palette.red[400]} />
        </View>

        {/* Status Chip — dedicated i18n key per review Finding #3.
            Previously derived via sync_failed_title.split(" ").slice(-2),
            which breaks in Arabic (RTL + different word order). */}
        <View className="px-3 py-1 rounded-full mb-4 bg-red-500/10 dark:bg-red-500/15">
          <Text className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            {t("sync_failed_chip")}
          </Text>
        </View>

        {/* Headline */}
        <Text className="text-[22px] font-bold leading-tight mb-3 text-text-primary dark:text-text-primary-dark text-center max-w-[280px]">
          {t("sync_failed_title")}
        </Text>

        {/* Body */}
        <Text className="text-sm leading-relaxed mb-6 text-text-secondary dark:text-text-secondary-dark text-center max-w-[280px]">
          {t("sync_failed_description")}
        </Text>

        {/* Buttons Side-by-Side */}
        <View className="flex-row w-full gap-3">
          {/* Sign out — ghost button */}
          <TouchableOpacity
            onPress={onSignOut}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("sign_out")}
            className="flex-1 h-12 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700"
          >
            <Text className="text-[15px] font-medium text-text-primary dark:text-text-primary-dark">
              {t("sign_out")}
            </Text>
          </TouchableOpacity>

          {/* Retry — primary button */}
          <TouchableOpacity
            onPress={onRetry}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("retry")}
            className="flex-1 h-12 items-center justify-center rounded-xl bg-nileGreen-500"
            // NativeWind v4 crash: shadow on TouchableOpacity must use inline style
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              elevation: 4,
              shadowColor: palette.nileGreen[500],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <Text className="text-[15px] font-semibold text-white">
              {t("retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Helper line */}
      <Text className="mt-6 text-xs text-text-muted dark:text-text-muted-dark text-center max-w-[300px]">
        {t("sync_helper_text")}
      </Text>
    </View>
  );
}
