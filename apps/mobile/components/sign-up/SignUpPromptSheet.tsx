/**
 * SignUpPromptSheet — Urgency Bottom Sheet
 *
 * Bottom sheet shown on cold app launch when an anonymous user has
 * 50+ transactions or 10+ days since first use. Displays real user
 * stats and urgency messaging.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component (data from useSignUpPrompt hook)
 * - Why: Sheet only renders UI; logic lives in the hook (SRP)
 * - SOLID: DIP — depends on stats/callbacks, not data sources
 *
 * TODO: Migrate from RN Animated to react-native-reanimated for
 * smoother 60fps animations on the UI thread.
 *
 * @module SignUpPromptSheet
 */

import { palette } from "@/constants/colors";
import { useSignUpPrompt } from "@/hooks/useSignUpPrompt";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { SocialLoginButtons } from "@/components/sign-up/SocialLoginButtons";
import { useToast } from "@/components/ui/Toast";

// =============================================================================
// Types
// =============================================================================

interface StatItem {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly value: number;
  readonly label: string;
}

// =============================================================================
// Component
// =============================================================================

export function SignUpPromptSheet(): React.JSX.Element | null {
  const { shouldShowPrompt, stats, dismissWithCooldown, dismissPermanently } =
    useSignUpPrompt();
  const { showToast } = useToast();
  const { height: screenHeight } = useWindowDimensions();
  const sheetTranslateY = screenHeight * 0.6;
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(sheetTranslateY)).current;

  // Show the sheet when conditions are met
  useEffect(() => {
    if (shouldShowPrompt && !stats.isLoading) {
      setIsVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [shouldShowPrompt, stats.isLoading, slideAnim]);

  const handleDismiss = useCallback((): void => {
    Animated.timing(slideAnim, {
      toValue: sheetTranslateY,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  }, [slideAnim, sheetTranslateY]);

  const handleSkip = useCallback(async (): Promise<void> => {
    handleDismiss();
    try {
      await dismissWithCooldown();
    } catch {
      showToast({ type: "error", title: "Failed to save preference" });
    }
  }, [handleDismiss, dismissWithCooldown, showToast]);

  const handleNeverShow = useCallback(async (): Promise<void> => {
    handleDismiss();
    try {
      await dismissPermanently();
    } catch {
      showToast({ type: "error", title: "Failed to save preference" });
    }
  }, [handleDismiss, dismissPermanently, showToast]);

  const handleOAuthSuccess = useCallback((): void => {
    handleDismiss();
    showToast({ type: "success", title: "Account secured ✓" });
  }, [handleDismiss, showToast]);

  const handleOAuthError = useCallback(
    (errorMessage: string): void => {
      showToast({ type: "error", title: errorMessage });
    },
    [showToast]
  );

  if (!isVisible) {
    return null;
  }

  const statItems: readonly StatItem[] = [
    {
      icon: "receipt-outline",
      value: stats.transactionCount,
      label: "transactions",
    },
    {
      icon: "wallet-outline",
      value: stats.accountCount,
      label: "accounts",
    },
  ];

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Overlay */}
      <Pressable
        className="flex-1 bg-black/50"
        onPress={() => {
          handleSkip().catch(() => {});
        }}
      />

      {/* Sheet */}
      <Animated.View
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl px-6 pt-6 pb-10"
        style={{ transform: [{ translateY: slideAnim }] }}
      >
        {/* Handle */}
        <View className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full self-center mb-5" />

        {/* Warning Icon */}
        <View className="items-center mb-4">
          <View className="w-14 h-14 rounded-full bg-amber-500/15 items-center justify-center">
            <MaterialCommunityIcons
              name="alert-outline"
              size={32}
              color={palette.gold[600]}
            />
          </View>
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-center text-slate-900 dark:text-slate-50 mb-2">
          Your data isn&apos;t backed up
        </Text>

        {/* Subtitle */}
        <Text className="text-sm text-center text-slate-500 dark:text-slate-400 mb-5 leading-5">
          You&apos;ve built something worth protecting. Sign up to keep it safe.
        </Text>

        {/* Stats */}
        <View className="flex-row justify-center gap-8 mb-6">
          {statItems.map((stat) => (
            <View key={stat.label} className="items-center">
              <Ionicons
                name={stat.icon}
                size={20}
                color={palette.nileGreen[500]}
              />
              <Text className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-1">
                {stat.value}
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Social Login Buttons */}
        <SocialLoginButtons
          onSuccess={handleOAuthSuccess}
          onError={handleOAuthError}
        />

        {/* Dismiss Actions */}
        <View className="flex-row justify-between mt-4 px-2">
          <Pressable
            onPress={() => {
              handleSkip().catch(() => {});
            }}
            className="py-2"
          >
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              Skip for now
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              handleNeverShow().catch(() => {});
            }}
            className="py-2"
          >
            <Text className="text-sm text-slate-400 dark:text-slate-500">
              Never show this again
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
