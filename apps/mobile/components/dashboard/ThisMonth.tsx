/**
 * ThisMonth Section - Dashboard period summary with ring gauge
 *
 * Design: Option D - Minimal ring with filter chips
 * Shows: Income, Expenses, Saved (amount + percentage)
 * Features: Filter chips for different time periods, dynamic title
 */

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import {
  PERIOD_LABELS,
  PeriodFilter,
  usePeriodSummary,
} from "@/hooks/usePeriodSummary";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

// =============================================================================
// Constants
// =============================================================================

const RING_SIZE = 80;
const RING_STROKE_WIDTH = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const FILTER_OPTIONS: PeriodFilter[] = [
  "today",
  "this_week",
  "this_month",
  "last_month",
  "six_months",
  "this_year",
];

// =============================================================================
// Sub-Components
// =============================================================================

interface RingGaugeProps {
  percentage: number;
  isDark: boolean;
}

function RingGauge({ percentage, isDark }: RingGaugeProps): React.JSX.Element {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset =
    RING_CIRCUMFERENCE - (clampedPercentage / 100) * RING_CIRCUMFERENCE;

  return (
    <View
      className="relative items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Background Circle */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={isDark ? palette.slate[700] : palette.slate[200]}
          strokeWidth={RING_STROKE_WIDTH}
          fill="transparent"
        />
        {/* Progress Circle */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={palette.nileGreen[500]}
          strokeWidth={RING_STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      {/* Center Text */}
      <View className="absolute items-center justify-center">
        <Text
          className={`text-lg font-bold ${isDark ? "text-slate-25" : "text-slate-800"}`}
        >
          {clampedPercentage}%
        </Text>
        <Text
          className={`text-[10px] font-medium mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Spent
        </Text>
      </View>
    </View>
  );
}

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
}

function FilterChip({
  label,
  isSelected,
  onPress,
  isDark,
}: FilterChipProps): React.JSX.Element {
  const bgClass = isSelected
    ? "bg-nileGreen-500"
    : isDark
      ? "bg-slate-800 border border-slate-700"
      : "bg-slate-100 border border-slate-200";

  const textClass = isSelected
    ? "text-white"
    : isDark
      ? "text-slate-300"
      : "text-slate-600";

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-2xl ${bgClass}`}
    >
      <Text className={`text-xs font-semibold ${textClass}`}>{label}</Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ThisMonth(): React.JSX.Element {
  const { isDark } = useTheme();
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodFilter>("this_month");
  const { data, isLoading } = usePeriodSummary(selectedPeriod);

  const handleDetails = (): void => {
    router.push("/transactions");
  };

  const title = PERIOD_LABELS[selectedPeriod];

  const containerClass = isDark
    ? "bg-slate-800/50 border-slate-700"
    : "bg-slate-100/50 border-slate-200";

  return (
    <View
      className={`my-3 rounded-2xl border p-4 overflow-hidden ${containerClass}`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text
          className={`text-lg font-bold ${isDark ? "text-slate-25" : "text-slate-800"}`}
        >
          {title}
        </Text>
        <TouchableOpacity
          onPress={handleDetails}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="flex-row items-center"
        >
          <Text className="text-sm font-semibold text-nileGreen-500">
            Details
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={palette.nileGreen[500]}
            className="ml-1"
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="h-24 items-center justify-center">
          <ActivityIndicator size="small" color={palette.nileGreen[500]} />
        </View>
      ) : (
        <View className="flex-row items-center mb-4">
          {/* Ring Gauge */}
          <RingGauge percentage={data.spentPercentage} isDark={isDark} />

          {/* Stats */}
          <View className="flex-1 ml-5 gap-2">
            {/* Income */}
            <View className="flex-row items-center">
              <Text
                className={`text-[13px] font-medium mr-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Income:
              </Text>
              <Text className="text-sm font-semibold text-nileGreen-500">
                {formatCurrency(data.totalIncome, "EGP")} ↑
              </Text>
            </View>

            {/* Expenses */}
            <View className="flex-row items-center">
              <Text
                className={`text-[13px] font-medium mr-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Expenses:
              </Text>
              <Text className="text-sm font-semibold text-red-500">
                {formatCurrency(data.totalExpenses, "EGP")} ↓
              </Text>
            </View>

            {/* Saved */}
            <View className="flex-row items-center">
              <Text
                className={`text-[13px] font-medium mr-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Saved:
              </Text>
              <Text className="text-sm font-semibold text-gold-600">
                {formatCurrency(data.savings, "EGP")} ({data.savingsPercentage}
                %) ✓
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Divider Line */}
      <View
        className={`h-[1px] ${isDark ? "bg-slate-700" : "bg-slate-200"} -mx-4 mb-3`}
      />

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerClassName="flex-row gap-2 px-4"
      >
        {FILTER_OPTIONS.map((filter) => (
          <FilterChip
            key={filter}
            label={PERIOD_LABELS[filter]}
            isSelected={selectedPeriod === filter}
            onPress={() => setSelectedPeriod(filter)}
            isDark={isDark}
          />
        ))}
      </ScrollView>
    </View>
  );
}
