/**
 * BudgetCategoryCard Component
 *
 * Compact card for individual category budgets showing category name,
 * progress bar, spent/limit, and progress ring.
 * Matches Mockup 1 (Budget Dashboard) list items from approved designs.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - SOLID: SRP — renders a single category budget card.
 *
 * @module BudgetCategoryCard
 */

import React, { useEffect } from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { BudgetWithMetrics } from "@/hooks/useBudgets";
import { formatCurrency } from "@astik/logic";
import type { CurrencyType } from "@astik/db";
import { palette } from "@/constants/colors";
import type { ProgressStatus } from "@astik/logic/src/budget";
import { useCategoryLookup } from "@/context/CategoriesContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetCategoryCardProps {
  /** Category budget with computed spending metrics */
  readonly data: BudgetWithMetrics;
  /** Preferred user currency */
  readonly currency: CurrencyType;
  /** Callback when the card is tapped */
  readonly onPress: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_SHADOW: ViewStyle = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

const PROGRESS_BAR_HEIGHT = 6;
const ANIMATION_DURATION = 600;

const STATUS_COLORS: Record<ProgressStatus, string> = {
  safe: palette.nileGreen[500],
  warning: palette.gold[600],
  danger: palette.red[500],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetCategoryCard({
  data,
  currency,
  onPress,
}: BudgetCategoryCardProps): React.JSX.Element {
  const { budget, metrics, daysLeft } = data;
  const effectiveCurrency = budget.currency ?? currency;
  const isPaused = budget.status === "PAUSED";
  const progressColor = isPaused
    ? palette.slate[400]
    : STATUS_COLORS[metrics.status];

  // Animated progress bar width
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(Math.min(metrics.percentage, 100), {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [metrics.percentage, barWidth]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  const categoryMap = useCategoryLookup();
  const categoryName = budget.categoryId
    ? (categoryMap.get(budget.categoryId)?.displayName ?? "[Deleted Category]")
    : undefined;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="flex-1 rounded-2xl border p-4 mb-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      style={[CARD_SHADOW, isPaused ? { opacity: 0.55 } : undefined]}
    >
      {/* Top row: name + amount */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text
            className="text-base font-bold text-slate-800 dark:text-white"
            numberOfLines={1}
          >
            {budget.name}
          </Text>
          {categoryName ? (
            <Text
              className="text-[10px] text-slate-400 dark:text-slate-500 font-medium"
              numberOfLines={1}
            >
              {categoryName}
            </Text>
          ) : null}
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isPaused ? "Paused" : `${daysLeft} days left`}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-sm font-bold text-slate-800 dark:text-white">
            {formatCurrency({
              amount: metrics.spent,
              currency: effectiveCurrency,
            })}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            /{" "}
            {formatCurrency({
              amount: metrics.limit,
              currency: effectiveCurrency,
            })}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        className="w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
        style={{ height: PROGRESS_BAR_HEIGHT }}
      >
        <Animated.View
          className="h-full rounded-full"
          style={[animatedBarStyle, { backgroundColor: progressColor }]}
        />
      </View>

      {/* Bottom stats */}
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {Math.round(metrics.percentage)}% used
        </Text>
        <Text
          className="text-xs font-semibold"
          style={{
            color:
              metrics.status === "danger"
                ? palette.red[500]
                : palette.nileGreen[500],
          }}
        >
          {formatCurrency({
            amount: metrics.remaining,
            currency: effectiveCurrency,
          })}{" "}
          left
        </Text>
      </View>
    </TouchableOpacity>
  );
}
