/**
 * QuickStats
 * Compact insights card showing average monthly spend and month-over-month change.
 */

import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { palette } from "@/constants/colors";
import { useMonthlySummaries } from "@/hooks/useAnalytics";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

// =============================================================================
// Constants
// =============================================================================

/** Number of months to include in the summary window. */
const SUMMARY_MONTHS = 3;

// =============================================================================
// Component
// =============================================================================

export function QuickStats(): React.JSX.Element {
  const { data: summaries, isLoading } = useMonthlySummaries(SUMMARY_MONTHS);
  const { preferredCurrency } = usePreferredCurrency();

  const currentMonth = summaries[0];
  const lastMonth = summaries[1];

  const avgExpense =
    summaries.length > 0
      ? summaries.reduce((sum, s) => sum + s.totalExpenses, 0) /
        summaries.length
      : 0;

  const percentageChange =
    lastMonth && lastMonth.totalExpenses > 0 && currentMonth
      ? ((currentMonth.totalExpenses - lastMonth.totalExpenses) /
          lastMonth.totalExpenses) *
        100
      : 0;

  return (
    <View className="rounded-3xl border p-5 mb-5 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
      <Text className="text-lg font-bold mb-4 text-slate-800 dark:text-white">
        Quick Insights
      </Text>

      {isLoading ? (
        <View className="h-[80px] items-center justify-center">
          <ActivityIndicator size="small" color={palette.nileGreen[500]} />
        </View>
      ) : (
        <View className="flex-row gap-3">
          {/* Average */}
          <View className="flex-1 rounded-2xl p-4 bg-slate-100/50 dark:bg-slate-700/50">
            <Text className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Avg Monthly Spend
            </Text>
            <Text className="text-base font-bold mt-1 text-slate-800 dark:text-white">
              {formatCurrency({
                amount: avgExpense,
                currency: preferredCurrency,
              })}
            </Text>
          </View>

          {/* Month over Month */}
          <View className="flex-1 rounded-2xl p-4 bg-slate-100/50 dark:bg-slate-700/50">
            <Text className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              vs Last Month
            </Text>
            <View className="flex-row items-center mt-1">
              <Ionicons
                name={percentageChange >= 0 ? "arrow-up" : "arrow-down"}
                size={14}
                color={
                  percentageChange >= 0
                    ? palette.red[400]
                    : palette.nileGreen[500]
                }
              />
              <Text
                className={`text-base font-bold ms-1 ${
                  percentageChange >= 0 ? "text-red-400" : "text-nileGreen-500"
                }`}
              >
                {Math.abs(percentageChange).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
