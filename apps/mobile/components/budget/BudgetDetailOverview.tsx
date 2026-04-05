/**
 * BudgetDetailOverview Component
 *
 * Overview card on the budget detail screen with circular progress ring,
 * "spent of budget" text, and three key stats (Remaining, Daily Average, Days Left).
 *
 * @module BudgetDetailOverview
 */

import { palette } from "@/constants/colors";
import type { CurrencyType } from "@astik/db";
import { type SpendingMetrics, formatCurrency } from "@astik/logic";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CircularProgress } from "./CircularProgress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetDetailOverviewProps {
  readonly metrics: SpendingMetrics;
  readonly currency: CurrencyType;
  readonly daysLeft: number;
  readonly isPaused: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetDetailOverview({
  metrics,
  currency,
  daysLeft,
  isPaused,
}: BudgetDetailOverviewProps): React.JSX.Element {
  const { t } = useTranslation("budgets");

  return (
    <View className="rounded-3xl border p-6 mb-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
      {/* Paused indicator */}
      {isPaused && (
        <View className="bg-slate-500 rounded-full px-3 py-1 mb-3 self-center">
          <Text className="text-xs font-medium text-white">
            {t("paused")}
          </Text>
        </View>
      )}

      {/* Ring + Label */}
      <View className="items-center mb-6">
        <CircularProgress
          percentage={metrics.percentage}
          status={metrics.status}
          size={140}
          strokeWidth={12}
          label={t("spent")}
        />

        <View className="mt-3 items-center">
          <Text className="text-2xl font-bold text-slate-800 dark:text-white">
            {formatCurrency({ amount: metrics.spent, currency })}
          </Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("of_budget", {
              amount: formatCurrency({ amount: metrics.limit, currency }),
            })}
          </Text>
        </View>
      </View>

      {/* Three Stats Row */}
      <View className="flex-row">
        {/* Remaining */}
        <View className="flex-1 items-center border-r border-slate-200 dark:border-slate-700">
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
            {t("remaining")}
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
            {t("daily_avg")}
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
            {t("days_left")}
          </Text>
          <Text className="text-lg font-bold mt-1 text-slate-800 dark:text-white">
            {daysLeft}
          </Text>
        </View>
      </View>
    </View>
  );
}
