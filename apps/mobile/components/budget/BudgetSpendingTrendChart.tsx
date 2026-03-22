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
    <View className="bg-white dark:bg-slate-800 rounded-2xl p-5 mx-5 mb-4 border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-4">
        Weekly Spending
      </Text>

      {/* Chart area */}
      <View style={{ height: BAR_MAX_HEIGHT + 24 }}>
        {/* Average line */}
        <View
          className="absolute left-0 right-0 border-dashed"
          style={{
            bottom: averageLineBottom,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? palette.slate[600] : palette.slate[300],
          }}
        >
          <Text
            className="absolute text-slate-400 dark:text-slate-500 font-medium"
            style={{ fontSize: 9, right: 0, top: -12 }}
          >
            avg{" "}
            {formatCurrency({
              amount: weeklyAverage,
              currency,
              maximumFractionDigits: 0,
            })}
          </Text>
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
  );
}
