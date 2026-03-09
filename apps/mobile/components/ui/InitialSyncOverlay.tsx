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
 */

import { palette } from "@/constants/colors";
import { useSync } from "@/providers/SyncProvider";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function InitialSyncOverlay(): React.ReactNode {
  const { isInitialSync } = useSync();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isInitialSync ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isInitialSync, fadeAnim]);

  if (!isInitialSync) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents={isInitialSync ? "auto" : "none"}
    >
      <View style={styles.card}>
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
        <Text style={styles.title}>Syncing your data...</Text>
        <Text style={styles.subtitle}>This may take a few seconds</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Using StyleSheet here because this overlay must render above all content
 * with absolute positioning — Tailwind classes don't reliably handle
 * z-index + absolute fill on overlay components in React Native.
 */
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
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
    color: "#f8fafc",
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    fontFamily: "Inter_400Regular",
  },
});
