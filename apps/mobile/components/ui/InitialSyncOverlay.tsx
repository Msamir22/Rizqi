/**
 * Initial Sync Overlay
 * Full-screen overlay shown during the first sync after login (empty local DB).
 * Provides visual feedback so users know their data is being downloaded.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational component consuming SyncContext
 * - Why: Separates display concern from sync logic. SyncProvider owns the
 *   `isInitialSync` state; this component only reads it.
 * - SOLID: SRP — only renders the overlay UI.
 * - Uses react-native-reanimated for smooth, performant animations
 *   as required by Constitution V.
 */

import { palette } from "@/constants/colors";
import { getLocaleFontFamily } from "@/constants/typography";
import { useSync } from "@/providers/SyncProvider";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

export function InitialSyncOverlay(): React.ReactNode {
  const { isInitialSync } = useSync();
  const { t } = useTranslation("common");
  const opacity = useSharedValue(0);
  const [visible, setVisible] = useState(isInitialSync);

  useEffect(() => {
    if (isInitialSync) {
      // Sync started — mount overlay, then fade in
      setVisible(true);
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      // Sync ended — fade out, then unmount via callback
      opacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
        }
      });
    }
  }, [isInitialSync, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.overlay, animatedStyle]}
      pointerEvents={isInitialSync ? "auto" : "none"}
    >
      <View style={styles.card}>
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
        <Text
          style={[styles.title, { fontFamily: getLocaleFontFamily().semiBold }]}
        >
          {t("syncing_your_data")}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { fontFamily: getLocaleFontFamily().regular },
          ]}
        >
          {t("syncing_subtitle")}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Using StyleSheet here because this overlay must render above all content
 * with absolute positioning — Tailwind classes don't reliably handle
 * z-index + absolute fill on overlay components in React Native.
 *
 * Colors use palette constants from colors.ts per Constitution V.
 */
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgba(${hexToRgbValues(palette.slate[950])}, 0.95)`,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    alignItems: "center",
    gap: 16,
    padding: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: palette.slate[50],
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: palette.slate[400],
    fontFamily: "Inter_400Regular",
  },
});

/**
 * Convert a hex color string to comma-separated RGB values
 * for use in rgba() expressions.
 *
 * @param hex - A hex color string (e.g., "#0f172a")
 * @returns Comma-separated RGB values (e.g., "15, 23, 42")
 */
function hexToRgbValues(hex: string): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
