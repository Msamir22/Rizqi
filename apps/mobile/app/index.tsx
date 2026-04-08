/**
 * App Entry Point
 *
 * Handles initial routing after authentication is confirmed by AuthGuard.
 * Only checks onboarding status — auth is enforced by the layout-level guard.
 *
 * Flow:
 * 1. AuthGuard ensures user is authenticated before this renders
 * 2. Check onboarding → redirect to `/(tabs)` or `/onboarding`
 *
 * @module Index
 */

import { palette } from "@/constants/colors";
import { HAS_ONBOARDED_KEY } from "@/constants/storage-keys";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index(): React.ReactNode {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const value = await AsyncStorage.getItem(HAS_ONBOARDED_KEY);
        if (value === "true") {
          setHasOnboarded(true);
        }
      } catch {
        // TODO: Replace with structured logging (e.g., Sentry)
        // Failed to read onboarding status — default to not onboarded
      } finally {
        setIsReady(true);
      }
    };

    init().catch(() => {
      // Ensure isReady is always set even if the async IIFE throws
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-slate-900">
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
      </View>
    );
  }

  if (hasOnboarded) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/onboarding" />;
  }
}
