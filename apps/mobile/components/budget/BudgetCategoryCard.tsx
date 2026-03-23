/**
 * BudgetCategoryCard Component
 *
 * Compact card for individual category budgets showing category name,
 * circular progress ring, spent/limit, and status indicators.
 * Matches Mockup 1 (Budget Dashboard) list items from approved designs.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - SOLID: SRP — renders a single category budget card.
 *
 * @module BudgetCategoryCard
 */

import React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BudgetWithMetrics } from "@/hooks/useBudgets";
import { formatCurrency } from "@astik/logic";
import type { CurrencyType } from "@astik/db";
import { palette } from "@/constants/colors";
import { useCategoryLookup } from "@/context/CategoriesContext";
import { CircularProgress } from "./CircularProgress";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- shadow/elevation requires inline style per NativeWind limitation
const CARD_SHADOW: ViewStyle = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

const RING_SIZE = 48;
const RING_STROKE = 4;

/**
 * Compact amount formatter for card-level display (e.g., "5k", "12.4k").
 * Keeps values readable without taking too much horizontal space.
 */
function formatCompactAmount(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    // Show one decimal only if remainder is significant
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${formatted}k`;
  }
  return Math.round(amount).toString();
}

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
  const isOverBudget = metrics.percentage >= 100;
  const isWarning = metrics.status === "warning" || metrics.status === "danger";

  const categoryMap = useCategoryLookup();
  const categoryName = budget.categoryId
    ? (categoryMap.get(budget.categoryId)?.displayName ?? "[Deleted Category]")
    : undefined;

  // S-07: Red left border for over-budget cards
  const overBudgetBorder: ViewStyle | undefined = isOverBudget
    ? { borderLeftWidth: 3, borderLeftColor: palette.red[500] }
    : undefined;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="flex-1 rounded-2xl border p-4 mb-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      style={[
        CARD_SHADOW,
        overBudgetBorder,
        isPaused ? { opacity: 0.55 } : undefined,
      ]}
    >
      {/* Top row: info + ring */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          {/* Budget name + warning badge */}
          <View className="flex-row items-center">
            <Text
              className="text-base font-bold text-slate-800 dark:text-white"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {budget.name}
            </Text>
            {/* S-06: Warning badge for budgets at or above threshold */}
            {isWarning && !isPaused && (
              <Ionicons
                name="warning"
                size={14}
                color={
                  metrics.status === "danger"
                    ? palette.red[500]
                    : palette.gold[600]
                }
                style={{ marginLeft: 4 }}
              />
            )}
          </View>

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

        {/* S-03: Small circular progress ring instead of bar */}
        <CircularProgress
          percentage={metrics.percentage}
          status={metrics.status}
          size={RING_SIZE}
          strokeWidth={RING_STROKE}
          showPercentage={false}
        />
      </View>

      {/* Bottom stats */}
      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-sm font-bold text-slate-800 dark:text-white">
          {formatCurrency({
            amount: metrics.spent,
            currency: effectiveCurrency,
          })}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          / {formatCompactAmount(metrics.limit)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
