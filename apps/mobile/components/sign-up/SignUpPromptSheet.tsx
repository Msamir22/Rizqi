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
 * - Uses react-native-reanimated for 60fps UI-thread animations
 * - Uses react-native-gesture-handler (Gesture.Pan) for drag-to-dismiss
 *
 * @module SignUpPromptSheet
 */

import { palette } from "@/constants/colors";
import { useSignUpPrompt } from "@/hooks/useSignUpPrompt";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { SocialLoginButtons } from "@/components/sign-up/SocialLoginButtons";
import { useToast } from "@/components/ui/Toast";

// =============================================================================
// Constants
// =============================================================================

/** Velocity (px/s) threshold to trigger fling-dismiss */
const FLING_VELOCITY_THRESHOLD = 500;

/** Fraction of sheet height to travel before drag-dismiss triggers */
const DRAG_DISMISS_FRACTION = 0.3;

/** Overlay background color */
const OVERLAY_BG = "rgba(0, 0, 0, 0.5)";

// =============================================================================
// Types
// =============================================================================

interface StatItem {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly value: string;
  readonly label: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a currency amount for display in the stats section.
 * Uses compact notation for large numbers (e.g., 12.5K, 1.2M).
 */
function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toFixed(0);
}

// =============================================================================
// Component
// =============================================================================

export function SignUpPromptSheet(): React.JSX.Element | null {
  const { shouldShowPrompt, stats, dismissWithCooldown, dismissPermanently } =
    useSignUpPrompt();
  const { showToast } = useToast();
  const { height: screenHeight } = useWindowDimensions();

  /**
   * The sheet slides in from below. sheetTranslateY represents the
   * off-screen distance. 0 = fully visible, sheetTranslateY = hidden.
   */
  const sheetTranslateY = screenHeight * 0.6;

  // Shared values for UI-thread animation
  const translateY = useSharedValue(sheetTranslateY);
  const overlayOpacity = useSharedValue(0);

  // Controls render — only true after show() animation begins
  const [isMounted, setIsMounted] = useState(false);

  // -------------------------------------------------------------------------
  // Show / Dismiss
  // -------------------------------------------------------------------------

  const showSheet = useCallback((): void => {
    setIsMounted(true);
    overlayOpacity.value = withTiming(1, { duration: 250 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
  }, [overlayOpacity, translateY]);

  const hideSheet = useCallback((): void => {
    overlayOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(
      sheetTranslateY,
      { duration: 250 },
      (finished) => {
        if (finished) {
          runOnJS(setIsMounted)(false);
        }
      }
    );
  }, [overlayOpacity, translateY, sheetTranslateY]);

  // Trigger show when prompt conditions are met
  React.useEffect(() => {
    if (shouldShowPrompt && !stats.isLoading && !isMounted) {
      showSheet();
    }
  }, [shouldShowPrompt, stats.isLoading, isMounted, showSheet]);

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  const handleSkip = useCallback(async (): Promise<void> => {
    hideSheet();
    try {
      await dismissWithCooldown();
    } catch {
      showToast({ type: "error", title: "Failed to save preference" });
    }
  }, [hideSheet, dismissWithCooldown, showToast]);

  const handleNeverShow = useCallback(async (): Promise<void> => {
    hideSheet();
    try {
      await dismissPermanently();
    } catch {
      showToast({ type: "error", title: "Failed to save preference" });
    }
  }, [hideSheet, dismissPermanently, showToast]);

  const handleOAuthSuccess = useCallback((): void => {
    hideSheet();
    showToast({ type: "success", title: "Account secured ✓" });
  }, [hideSheet, showToast]);

  const handleOAuthError = useCallback(
    (errorMessage: string): void => {
      showToast({ type: "error", title: errorMessage });
    },
    [showToast]
  );

  // -------------------------------------------------------------------------
  // Gesture: Drag-to-dismiss
  // -------------------------------------------------------------------------

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow dragging downward (positive translation)
      translateY.value = Math.max(0, event.translationY);

      // Fade overlay proportionally to drag distance
      const progress = Math.max(0, event.translationY) / sheetTranslateY;
      overlayOpacity.value = interpolate(progress, [0, 1], [1, 0]);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.velocityY > FLING_VELOCITY_THRESHOLD ||
        event.translationY > sheetTranslateY * DRAG_DISMISS_FRACTION;

      if (shouldDismiss) {
        // Fling or drag past threshold → dismiss
        overlayOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(
          sheetTranslateY,
          { duration: 200 },
          (finished) => {
            if (finished) {
              runOnJS(setIsMounted)(false);
            }
          }
        );
        // Fire the skip/cooldown handler on JS thread
        runOnJS(handleSkipFromGesture)();
      } else {
        // Snap back to open position
        overlayOpacity.value = withTiming(1, { duration: 150 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
      }
    });

  /**
   * Wrapper to call async handleSkip from runOnJS (which requires
   * a synchronous function reference).
   */
  function handleSkipFromGesture(): void {
    handleSkip().catch(() => {
      // Error already surfaced via toast inside handleSkip
    });
  }

  // -------------------------------------------------------------------------
  // Animated Styles
  // -------------------------------------------------------------------------

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // -------------------------------------------------------------------------
  // Early return
  // -------------------------------------------------------------------------

  if (!isMounted) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  const statItems: readonly StatItem[] = [
    {
      icon: "receipt-outline",
      value: String(stats.transactionCount),
      label: "transactions",
    },
    {
      icon: "wallet-outline",
      value: String(stats.accountCount),
      label: "accounts",
    },
    {
      icon: "cash-outline",
      value: formatAmount(stats.totalAmount),
      label: "tracked",
    },
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.overlay, overlayAnimatedStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            handleSkip().catch(() => {});
          }}
        />
      </Animated.View>

      {/* Sheet with Gesture */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.sheet, sheetAnimatedStyle]}
          className="bg-white dark:bg-slate-900"
        >
          {/* Handle (drag affordance) */}
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
            You&apos;ve built something worth protecting. Sign up to keep it
            safe.
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
      </GestureDetector>
    </View>
  );
}

// =============================================================================
// Styles (non-Tailwind: position/layout that must remain in StyleSheet)
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: OVERLAY_BG,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
});
