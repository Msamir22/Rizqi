/**
 * BudgetSpendingTrendChart Component
 *
 * Weekly spending bar chart for the budget detail screen.
 * Built with react-native-reanimated for animated bars and
 * a dashed average line.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: No external chart library needed — simple bar chart with animated transitions.
 * - SOLID: SRP — renders only the weekly spending visualization.
 *
 * @module BudgetSpendingTrendChart
 */

import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { formatCurrency } from "@astik/logic";
import type { CurrencyType } from "@astik/db";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeeklySpending {
  readonly label: string;
  readonly amount: number;
}

interface BudgetSpendingTrendChartProps {
  /** Weekly spending data (sorted chronologically) */
  readonly data: readonly WeeklySpending[];
  /** Budget currency */
  readonly currency: CurrencyType;
  /** Weekly budget limit (amount / weeks in period) for the average line */
  readonly weeklyAverage: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_MAX_HEIGHT = 120;
const BAR_WIDTH = 28;
const ANIMATION_DURATION = 600;

// ---------------------------------------------------------------------------
// Animated Bar
// ---------------------------------------------------------------------------

function AnimatedBar({
  height,
  color,
  delay,
}: {
  readonly height: number;
  readonly color: string;
  readonly delay: number;
}): React.JSX.Element {
  const animHeight = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      animHeight.value = withTiming(height, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timeout);
  }, [height, delay, animHeight]);

  const animStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));

  return (
    <Animated.View
      className="rounded-t-lg"
      style={[{ width: BAR_WIDTH, backgroundColor: color }, animStyle]}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetSpendingTrendChart({
  data,
  currency,
  weeklyAverage,
}: BudgetSpendingTrendChartProps): React.JSX.Element {
  const { t } = useTranslation("budgets");
  const { isDark } = useTheme();
  const amounts = data.map((d) => d.amount);
  const maxAmount = Math.max(...amounts, weeklyAverage, 1);

  const getBarColor = (amount: number): string => {
    if (amount >= weeklyAverage * 1.2) return palette.red[500];
    if (amount >= weeklyAverage * 0.8) return palette.gold[500];
    return palette.nileGreen[500];
  };

  const averageLineBottom = (weeklyAverage / maxAmount) * BAR_MAX_HEIGHT;

  return (
    <View className="mb-6">
      <Text className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2 ms-[22px]">
        {t("spending_trend")}
      </Text>
      <View className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700">
        {/* Chart area */}
        <View style={{ height: BAR_MAX_HEIGHT + 24 }}>
          {/* Average line */}
          <View
            className="absolute start-0 end-0 border-dashed"
            style={{
              bottom: averageLineBottom,
              borderBottomWidth: 1,
              borderBottomColor: isDark
                ? palette.slate[600]
                : palette.slate[300],
            }}
          >
            <View
              className="absolute flex-row justify-end"
              style={{ right: 0, top: -7, left: 0, zIndex: 10 }}
            >
              <Text
                className="text-slate-400 dark:text-slate-500 font-medium bg-white dark:bg-slate-800 px-1"
                style={{ fontSize: 9 }}
              >
                avg{" "}
                {formatCurrency({
                  amount: weeklyAverage,
                  currency,
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
          </View>

          {/* Bars */}
          <View
            className="flex-row items-end justify-around"
            style={{ height: BAR_MAX_HEIGHT }}
          >
            {data.map((week, index) => {
              const barHeight = Math.max(
                (week.amount / maxAmount) * BAR_MAX_HEIGHT,
                2
              );
              return (
                <View key={week.label} className="items-center">
                  <AnimatedBar
                    height={barHeight}
                    color={getBarColor(week.amount)}
                    delay={index * 80}
                  />
                </View>
              );
            })}
          </View>

          {/* Labels */}
          <View className="flex-row justify-around mt-2">
            {data.map((week) => (
              <Text
                key={week.label}
                className="text-slate-400 dark:text-slate-500 font-medium text-center"
                style={{ fontSize: 9, width: BAR_WIDTH + 8 }}
              >
                {week.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
