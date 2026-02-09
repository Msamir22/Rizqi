/**
 * Stats Tab Screen
 * Analytics and insights about spending patterns
 */

import { PageHeader } from "@/components/navigation/PageHeader";
import { CategoryDrilldownCard } from "@/components/stats/CategoryDrilldownCard";
import { palette } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/ui";
import { useTheme } from "@/context/ThemeContext";
import { useMonthlyChartData, useMonthlySummaries } from "@/hooks/useAnalytics";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";

// =============================================================================
// Types
// =============================================================================

type PeriodFilter = "6m" | "12m";

// =============================================================================
// Components
// =============================================================================

function MonthlyExpenseChart(): React.JSX.Element {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState<PeriodFilter>("6m");
  const months = period === "6m" ? 6 : 12;

  const { data: expenseData, isLoading: expenseLoading } = useMonthlyChartData(
    months,
    undefined,
    "EXPENSE"
  );
  const { data: incomeData, isLoading: incomeLoading } = useMonthlyChartData(
    months,
    undefined,
    "INCOME"
  );

  const isLoading = expenseLoading || incomeLoading;

  // Transform data for grouped bar chart
  const chartData: Array<{
    value: number;
    frontColor: string;
    label?: string;
  }> = [];

  expenseData.forEach((expense, index) => {
    const income = incomeData[index];
    // Income bar
    chartData.push({
      value: income?.value || 0,
      frontColor: palette.nileGreen[500],
      label: expense.label.substring(0, 3),
    });
    // Expense bar
    chartData.push({
      value: expense.value,
      frontColor: palette.red[400],
    });
  });

  // Calculate totals
  const totalExpenses = expenseData.reduce((sum, d) => sum + d.value, 0);
  const totalIncome = incomeData.reduce((sum, d) => sum + d.value, 0);
  const netSavings = totalIncome - totalExpenses;

  return (
    <View className="rounded-3xl border p-5 mb-5 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold text-slate-800 dark:text-white">
          Monthly Overview
        </Text>
        <View className="flex-row gap-1">
          {(["6m", "12m"] as PeriodFilter[]).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full ${period === p ? "bg-nileGreen-500" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <Text
                className={`text-xs font-semibold ${period === p ? "text-white" : "text-slate-600 dark:text-slate-300"}`}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View className="flex-row gap-4 mb-3">
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-sm mr-1 bg-nileGreen-500" />
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            Income
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-sm mr-1 bg-red-400" />
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            Expenses
          </Text>
        </View>
      </View>

      {/* Chart */}
      {isLoading ? (
        <View className="h-[200px] items-center justify-center">
          <ActivityIndicator size="small" color={palette.nileGreen[500]} />
        </View>
      ) : (
        <View className="overflow-hidden">
          <BarChart
            data={chartData}
            barWidth={14}
            spacing={period === "6m" ? 24 : 10}
            initialSpacing={10}
            noOfSections={4}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={isDark ? palette.slate[700] : palette.slate[200]}
            rulesColor={isDark ? palette.slate[700] : palette.slate[200]}
            yAxisTextStyle={{
              color: isDark ? palette.slate[500] : palette.slate[400],
              fontSize: 10,
            }}
            xAxisLabelTextStyle={{
              color: isDark ? palette.slate[400] : palette.slate[500],
              fontSize: 9,
            }}
            height={160}
            barBorderRadius={4}
            isAnimated
          />
        </View>
      )}

      {/* Summary Stats */}
      <View className="flex-row justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <View className="items-center flex-1">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            Total Income
          </Text>
          <Text className="text-sm font-bold text-nileGreen-500 mt-0.5">
            {formatCurrency({ amount: totalIncome, currency: "EGP" })}
          </Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            Total Expenses
          </Text>
          <Text className="text-sm font-bold text-red-500 dark:text-red-400 mt-0.5">
            {formatCurrency({ amount: totalExpenses, currency: "EGP" })}
          </Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            Net Savings
          </Text>
          <Text
            className={`text-sm font-bold mt-0.5 ${netSavings >= 0 ? "text-nileGreen-500" : "text-red-400"}`}
          >
            {formatCurrency({ amount: netSavings, currency: "EGP" })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function QuickStats(): React.JSX.Element {
  const { data: summaries, isLoading } = useMonthlySummaries(3);

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
              {formatCurrency({ amount: avgExpense, currency: "EGP" })}
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
                className={`text-base font-bold ml-1 ${
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

// =============================================================================
// Main Screen
// =============================================================================

export default function StatsScreen(): React.JSX.Element {
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-900">
      <PageHeader title="Stats" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4">
          {/* Quick Stats */}
          <QuickStats />

          {/* Monthly Chart */}
          <MonthlyExpenseChart />

          {/* Category Breakdown with Drill-down */}
          <CategoryDrilldownCard />
        </View>
      </ScrollView>
    </View>
  );
}
