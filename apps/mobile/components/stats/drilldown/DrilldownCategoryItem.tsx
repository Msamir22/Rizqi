/**
 * DrilldownCategoryItem
 * Single row in the category drilldown list with color dot,
 * name, amount, percentage, and optional drill-in chevron.
 */

import { type CategoryData } from "./types";
import { palette } from "@/constants/colors";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface DrilldownCategoryItemProps {
  readonly category: CategoryData;
  readonly onPress: () => void;
  readonly hasChildren: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function DrilldownCategoryItem({
  category,
  onPress,
  hasChildren,
}: DrilldownCategoryItemProps): React.JSX.Element {
  const { isDark } = useTheme();
  const { preferredCurrency } = usePreferredCurrency();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!hasChildren}
      className="flex-row items-center py-2"
    >
      <View
        className="w-3 h-3 rounded-full me-3"
        style={{ backgroundColor: category.color }}
      />
      <View className="flex-1">
        <Text
          className="text-sm font-medium text-slate-700 dark:text-white"
          numberOfLines={1}
        >
          {category.displayName}
        </Text>
      </View>
      <Text className="text-sm font-semibold me-2 text-slate-600 dark:text-slate-300">
        {formatCurrency({
          amount: category.amount,
          currency: preferredCurrency,
        })}
      </Text>
      <Text className="text-xs text-slate-400 dark:text-slate-500">
        {category.percentage.toFixed(1)}%
      </Text>
      {hasChildren && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={isDark ? palette.slate[500] : palette.slate[400]}
          style={{ marginStart: 4 }}
        />
      )}
    </TouchableOpacity>
  );
}
