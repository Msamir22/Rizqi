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

import { palette } from "@/constants/colors";
import { useCategoryLookup } from "@/context/CategoriesContext";
import type { BudgetWithMetrics } from "@/hooks/useBudgets";
import type { CurrencyType } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("budgets");
  const { budget, metrics } = data;
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

  // Spent/limit text color — red when over budget
  const spentLimitColor = isOverBudget
    ? "text-red-500"
    : "text-slate-400 dark:text-slate-500";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="flex-1 rounded-3xl border p-5 mb-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      style={[
        CARD_SHADOW,
        overBudgetBorder,
        isPaused ? { opacity: 0.55 } : undefined,
      ]}
    >
      {/* Top row: ring (left) + warning icon (right) */}
      <View className="flex-row items-start justify-between mb-5">
        <CircularProgress
          percentage={metrics.percentage}
          status={metrics.status}
          size={RING_SIZE}
          strokeWidth={RING_STROKE}
          showPercentage
        />

        {/* Paused badge or warning icon */}
        {isPaused ? (
          <View className="bg-slate-500 rounded-full px-2 py-0.5">
            <Text className="text-[10px] font-medium text-white">
              {t("paused")}
            </Text>
          </View>
        ) : isWarning ? (
          <Ionicons
            name="warning"
            size={18}
            color={
              metrics.status === "danger" ? palette.red[500] : palette.gold[600]
            }
          />
        ) : null}
      </View>

      {/* Bottom section: category name + spent/limit */}
      <Text
        className="text-base font-bold text-slate-800 dark:text-white"
        numberOfLines={1}
      >
        {categoryName ?? budget.name}
      </Text>
      <Text className={`text-xs mt-1 ${spentLimitColor}`}>
        {formatCurrency({
          amount: metrics.spent,
          currency: effectiveCurrency,
        })}{" "}
        / {formatCompactAmount(metrics.limit)}
      </Text>
    </TouchableOpacity>
  );
}
