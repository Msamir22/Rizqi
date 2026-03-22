/**
 * BudgetDetailOverview Component
 *
 * Overview card on the budget detail screen with circular progress ring,
 * "spent of budget" text, and three key stats (Remaining, Daily Average, Days Left).
 *
 * @module BudgetDetailOverview
 */

import React from "react";
import { Text, View } from "react-native";
import { CircularProgress } from "./CircularProgress";
import type { SpendingMetrics } from "@astik/logic/src/budget";
import type { CurrencyType } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetDetailOverviewProps {
  readonly metrics: SpendingMetrics;
  readonly currency: CurrencyType;
  readonly daysLeft: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetDetailOverview({
  metrics,
  currency,
  daysLeft,
}: BudgetDetailOverviewProps): React.JSX.Element {
  return (
    <View className="rounded-3xl border p-6 mb-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
      {/* Ring + Label */}
      <View className="items-center mb-6">
        <CircularProgress
          percentage={metrics.percentage}
          status={metrics.status}
          size={140}
          strokeWidth={12}
          label="spent"
        />

        <View className="mt-3 items-center">
          <Text className="text-2xl font-bold text-slate-800 dark:text-white">
            {formatCurrency({ amount: metrics.spent, currency })}
          </Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            of {formatCurrency({ amount: metrics.limit, currency })} budget
          </Text>
        </View>
      </View>

      {/* Three Stats Row */}
      <View className="flex-row">
        {/* Remaining */}
        <View className="flex-1 items-center border-r border-slate-200 dark:border-slate-700">
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
            Remaining
          </Text>
          <Text
            className="text-lg font-bold mt-1"
            style={{
              color:
                metrics.status === "danger"
                  ? palette.red[500]
                  : palette.nileGreen[500],
            }}
          >
            {formatCurrency({ amount: metrics.remaining, currency })}
          </Text>
        </View>

        {/* Daily Average */}
        <View className="flex-1 items-center border-r border-slate-200 dark:border-slate-700">
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
            Daily Avg
          </Text>
          <Text className="text-lg font-bold mt-1 text-slate-800 dark:text-white">
            {formatCurrency({
              amount: metrics.dailyAverage,
              currency,
              maximumFractionDigits: 0,
            })}
          </Text>
        </View>

        {/* Days Left */}
        <View className="flex-1 items-center">
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
            Days Left
          </Text>
          <Text className="text-lg font-bold mt-1 text-slate-800 dark:text-white">
            {daysLeft}
          </Text>
        </View>
      </View>
    </View>
  );
}
