/**
 * SmsImportStatusCard
 *
 * Compact dashboard banner showing SMS auto-import status.
 * Displays the count of SMS-sourced transactions this month,
 * last scan time, and a toggle to enable/disable SMS permission.
 *
 * Only renders on Android when SMS permission has been granted.
 *
 * Mockup reference: SMS Import Status Card image
 *
 * @module SmsImportStatusCard
 */

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useSmsImportStats } from "@/hooks/useSmsImportStats";
import { useSmsPermission } from "@/hooks/useSmsPermission";
import { useSmsSync } from "@/hooks/useSmsSync";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Formats a timestamp into a human-readable relative time string.
 */
function formatLastScan(
  timestamp: number | null,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!timestamp) {
    return t("sms_never_scanned");
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return t("just_now");
  }
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return t("just_now");
  if (diffMinutes < 60) {
    return t("sms_last_scan", {
      time: t("minutes_ago", { count: diffMinutes }),
    });
  }
  if (diffHours < 24) {
    return t("sms_last_scan", {
      time: t("hours_ago", { count: diffHours }),
    });
  }
  return t("sms_last_scan", {
    time: t("days_ago", { count: diffDays }),
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

function SmsImportStatusCardComponent(): React.ReactElement | null {
  const { t } = useTranslation("common");
  const { isDark } = useTheme();
  const router = useRouter();
  const { status, isAndroid } = useSmsPermission();
  const { hasSynced, lastSyncTimestamp } = useSmsSync();
  const { importedThisMonth, isLoading } = useSmsImportStats();

  const isEnabled = status === "granted";

  const lastScanText = useMemo(
    () => formatLastScan(lastSyncTimestamp, t),
    [lastSyncTimestamp, t]
  );

  const handleCardPress = useCallback((): void => {
    router.push("/sms-scan" as never);
  }, [router]);

  const handleToggle = useCallback((): void => {
    // Navigate to SMS settings/scan screen for toggling
    router.push("/sms-scan" as never);
  }, [router]);

  // Only show on Android after user has synced at least once
  if (!isAndroid || !hasSynced || isLoading) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? palette.slate[800] : palette.slate[100],
          borderLeftColor: palette.nileGreen[500],
        },
      ]}
    >
      {/* SMS Icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${palette.nileGreen[500]}1A` },
        ]}
      >
        <Ionicons name="chatbubble" size={20} color={palette.nileGreen[500]} />
      </View>

      {/* Text Content */}
      <View className="flex-1 ml-3">
        <Text
          className="text-sm font-bold"
          style={{
            color: isDark ? palette.slate[50] : palette.slate[800],
          }}
          numberOfLines={1}
        >
          {t("sms_imported_count", { count: importedThisMonth })}
        </Text>
        <Text
          className="mt-0.5"
          style={[
            styles.subtitle,
            {
              color: isDark ? `${palette.slate[400]}B3` : palette.slate[500],
            },
          ]}
        >
          {lastScanText}
        </Text>
      </View>

      {/* Toggle Switch */}
      <Switch
        value={isEnabled}
        onValueChange={handleToggle}
        trackColor={{
          false: isDark ? palette.slate[600] : palette.slate[300],
          true: palette.nileGreen[500],
        }}
        thumbColor={isDark ? palette.slate[25] : palette.slate[25]}
        style={styles.toggle}
      />
    </TouchableOpacity>
  );
}

export const SmsImportStatusCard = React.memo(SmsImportStatusCardComponent);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderLeftWidth: 2,
    overflow: "hidden",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggle: {
    marginLeft: 8,
  },
});
