/**
 * MetalTabs Component
 *
 * A segmented tab control to switch between Gold and Silver holdings.
 * Uses a pill-style selector with gold/silver theming.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Component
 * - Why: Parent manages activeTab state, tab is purely presentational.
 * - SOLID: SRP — renders tab UI and emits change events.
 *
 * @module MetalTabs
 */

import { FontAwesome5 } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";

import { palette } from "@/constants/colors";

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

const ACTIVE_GOLD_BG: ViewStyle = {
  backgroundColor: palette.gold[100],
};

const ACTIVE_SILVER_BG: ViewStyle = {
  backgroundColor: palette.silver.bg,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Segmented tab control for switching between Gold and Silver holdings.
 */
export function MetalTabs({
  activeTab,
  onTabChange,
  goldCount,
  silverCount,
}: MetalTabsProps): React.JSX.Element {
  const handleGoldPress = useCallback((): void => {
    onTabChange("gold");
  }, [onTabChange]);

  const handleSilverPress = useCallback((): void => {
    onTabChange("silver");
  }, [onTabChange]);

  const isGoldActive = activeTab === "gold";
  const isSilverActive = activeTab === "silver";

  return (
    <View className="flex-row rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
      {/* Gold Tab */}
      <TouchableOpacity
        onPress={handleGoldPress}
        activeOpacity={0.8}
        className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
          isGoldActive ? "" : "bg-transparent"
        }`}
        style={isGoldActive ? ACTIVE_GOLD_BG : undefined}
        accessibilityRole="tab"
        accessibilityState={{ selected: isGoldActive }}
        accessibilityLabel={`Gold tab, ${goldCount} holdings`}
      >
        <FontAwesome5
          name="coins"
          size={14}
          color={isGoldActive ? palette.gold[800] : palette.slate[400]}
        />
        <Text
          className={`ml-2 text-sm font-semibold ${
            isGoldActive
              ? "text-amber-800"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Gold ({goldCount})
        </Text>
      </TouchableOpacity>

      {/* Silver Tab */}
      <TouchableOpacity
        onPress={handleSilverPress}
        activeOpacity={0.8}
        className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
          isSilverActive ? "" : "bg-transparent"
        }`}
        style={isSilverActive ? ACTIVE_SILVER_BG : undefined}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSilverActive }}
        accessibilityLabel={`Silver tab, ${silverCount} holdings`}
      >
        <View
          className="h-3.5 w-3.5 rounded-full"
          style={{
            backgroundColor: isSilverActive
              ? palette.slate[600]
              : palette.slate[400],
          }}
        />
        <Text
          className={`ml-2 text-sm font-semibold ${
            isSilverActive
              ? "text-slate-700 dark:text-slate-200"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Silver ({silverCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export type { MetalTab };
