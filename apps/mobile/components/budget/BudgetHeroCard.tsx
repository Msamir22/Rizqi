/**
 * BudgetHeroCard Component
 *
 * Prominent hero card for the Global budget displaying the main
 * circular progress ring, total spent vs limit, and days remaining.
 * Matches Mockup 1 (Budget Dashboard) from approved designs.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - SOLID: SRP — renders only the global budget visualization.
 *
 * @module BudgetHeroCard
 */

import React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { CircularProgress } from "./CircularProgress";
import type { BudgetWithMetrics } from "@/hooks/useBudgets";
import { formatCurrency } from "@astik/logic";
import type { CurrencyType } from "@astik/db";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetHeroCardProps {
  /** Global budget with computed spending metrics */
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
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetHeroCard({
  data,
  currency,
  onPress,
}: BudgetHeroCardProps): React.JSX.Element {
  const { budget, metrics, daysLeft } = data;
  const effectiveCurrency = budget.currency ?? currency;
  const isPaused = budget.status === "PAUSED";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="rounded-3xl border p-6 mb-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      style={[CARD_SHADOW, isPaused ? { opacity: 0.55 } : undefined]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
            Overall Budget
          </Text>
          <Text className="text-lg font-bold text-slate-800 dark:text-white mt-1">
            {budget.name}
          </Text>
        </View>
        {isPaused ? (
          <View className="bg-slate-500 rounded-full px-3 py-1">
            <Text className="text-xs font-medium text-white">Paused</Text>
          </View>
        ) : (
          <View className="bg-slate-100 dark:bg-slate-700 rounded-full px-3 py-1">
            <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {daysLeft} days left
            </Text>
          </View>
        )}
      </View>

      {/* Progress Ring + Stats */}
      <View className="flex-row items-center">
        {/* Ring */}
        <CircularProgress
          percentage={metrics.percentage}
          status={metrics.status}
          size={100}
          strokeWidth={10}
          label="spent"
        />

        {/* Stats */}
        <View className="flex-1 ml-6">
          <View className="mb-3">
            <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
              Spent
            </Text>
            <Text className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrency({
                amount: metrics.spent,
                currency: effectiveCurrency,
              })}
            </Text>
          </View>
          <View className="mb-3">
            <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
              Remaining
            </Text>
            <Text
              className="text-lg font-bold"
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
              })}
            </Text>
          </View>
          <View>
            <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
              Daily Average
            </Text>
            <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {formatCurrency({
                amount: metrics.dailyAverage,
                currency: effectiveCurrency,
                maximumFractionDigits: 0,
              })}
              /day
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
