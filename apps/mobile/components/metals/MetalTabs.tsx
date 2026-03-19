/**
 * MetalTabs Component
 *
 * A segmented tab control to switch between Gold and Silver holdings.
 * Uses a pill-style selector with gold/silver theming and smooth
 * animated transitions powered by react-native-reanimated.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Component
 * - Why: Parent manages activeTab state, tab is purely presentational.
 * - SOLID: SRP — renders tab UI, emits change events, handles animation.
 *
 * @module MetalTabs
 */

import { FontAwesome5 } from "@expo/vector-icons";
import React, { useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MetalTab = "gold" | "silver";

interface MetalTabsProps {
  /** Currently active tab */
  readonly activeTab: MetalTab;
  /** Callback when the active tab changes */
  readonly onTabChange: (tab: MetalTab) => void;
  /** Count of gold holdings */
  readonly goldCount: number;
  /** Count of silver holdings */
  readonly silverCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANIMATION_DURATION_MS = 250;
const TRANSPARENT = "transparent";

/** Gold tab background colors [inactive, active] indexed by light/dark mode */
const GOLD_BG_LIGHT: readonly [string, string] = [
  TRANSPARENT,
  palette.gold[100],
];
const GOLD_BG_DARK: readonly [string, string] = [
  TRANSPARENT,
  "rgba(254, 243, 199, 0.15)",
];

/** Silver tab background colors [inactive, active] */
const SILVER_BG_LIGHT: readonly [string, string] = [
  TRANSPARENT,
  palette.silver.bg,
];
const SILVER_BG_DARK: readonly [string, string] = [
  TRANSPARENT,
  "rgba(210, 210, 212, 0.15)",
];

/** Text colors [inactive, active] */
const GOLD_TEXT_LIGHT: readonly [string, string] = [
  palette.slate[500],
  palette.gold[800],
];
const GOLD_TEXT_DARK: readonly [string, string] = [
  palette.slate[400],
  palette.gold[400],
];

const SILVER_TEXT_LIGHT: readonly [string, string] = [
  palette.slate[500],
  palette.slate[700],
];
const SILVER_TEXT_DARK: readonly [string, string] = [
  palette.slate[400],
  palette.slate[200],
];

/** Icon colors [inactive, active] */
const GOLD_ICON_LIGHT: readonly [string, string] = [
  palette.slate[400],
  palette.gold[800],
];
const GOLD_ICON_DARK: readonly [string, string] = [
  palette.slate[400],
  palette.gold[400],
];

const SILVER_ICON_LIGHT: readonly [string, string] = [
  palette.slate[400],
  palette.slate[600],
];
const SILVER_ICON_DARK: readonly [string, string] = [
  palette.slate[400],
  palette.slate[200],
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Segmented tab control for switching between Gold and Silver holdings.
 * Tab transitions are animated for a premium feel.
 */
export function MetalTabs({
  activeTab,
  onTabChange,
  goldCount,
  silverCount,
}: MetalTabsProps): React.JSX.Element {
  const { isDark } = useTheme();

  // Shared value: 0 = gold active, 1 = silver active
  const progress = useSharedValue(activeTab === "gold" ? 0 : 1);

  useEffect(() => {
    progress.value = withTiming(activeTab === "gold" ? 0 : 1, {
      duration: ANIMATION_DURATION_MS,
    });
  }, [activeTab, progress]);

  const handleGoldPress = useCallback((): void => {
    onTabChange("gold");
  }, [onTabChange]);

  const handleSilverPress = useCallback((): void => {
    onTabChange("silver");
  }, [onTabChange]);

  // --- Animated styles ---

  const goldBgColors = isDark ? GOLD_BG_DARK : GOLD_BG_LIGHT;
  const silverBgColors = isDark ? SILVER_BG_DARK : SILVER_BG_LIGHT;
  const goldTextColors = isDark ? GOLD_TEXT_DARK : GOLD_TEXT_LIGHT;
  const silverTextColors = isDark ? SILVER_TEXT_DARK : SILVER_TEXT_LIGHT;
  const goldIconColors = isDark ? GOLD_ICON_DARK : GOLD_ICON_LIGHT;
  const silverIconColors = isDark ? SILVER_ICON_DARK : SILVER_ICON_LIGHT;

  // Gold tab: active when progress = 0, inactive when progress = 1
  const goldTabStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      goldBgColors as [string, string]
    ),
  }));

  // Silver tab: inactive when progress = 0, active when progress = 1
  const silverTabStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      silverBgColors as [string, string]
    ),
  }));

  // Gold text: active color at 0, inactive at 1
  const goldTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      goldTextColors as [string, string]
    ),
  }));

  // Silver text: inactive at 0, active at 1
  const silverTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      silverTextColors as [string, string]
    ),
  }));

  // Gold icon color (used by FontAwesome5, needs JS value)
  const goldIconColor =
    activeTab === "gold" ? goldIconColors[1] : goldIconColors[0];
  const silverIconColor =
    activeTab === "silver" ? silverIconColors[1] : silverIconColors[0];

  return (
    <View className="flex-row rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
      {/* Gold Tab */}
      <Animated.View
        className="flex-1 rounded-xl overflow-hidden"
        style={goldTabStyle}
      >
        <Pressable
          onPress={handleGoldPress}
          className="flex-1 flex-row items-center justify-center py-3"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "gold" }}
          accessibilityLabel={`Gold tab, ${goldCount} holdings`}
        >
          <FontAwesome5 name="coins" size={14} color={goldIconColor} />
          <Animated.Text
            className="ml-2 text-sm font-semibold"
            style={goldTextStyle}
          >
            Gold ({goldCount})
          </Animated.Text>
        </Pressable>
      </Animated.View>

      {/* Silver Tab */}
      <Animated.View
        className="flex-1 rounded-xl overflow-hidden"
        style={silverTabStyle}
      >
        <Pressable
          onPress={handleSilverPress}
          className="flex-1 flex-row items-center justify-center py-3"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "silver" }}
          accessibilityLabel={`Silver tab, ${silverCount} holdings`}
        >
          <View
            className="h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: silverIconColor }}
          />
          <Animated.Text
            className="ml-2 text-sm font-semibold"
            style={silverTextStyle}
          >
            Silver ({silverCount})
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export type { MetalTab };
