/**
 * BudgetEmptyState Component
 *
 * Full-page empty state shown when the user has no budgets.
 * Features a View-composition illustration matching the approved mockup
 * (dark card with bar chart columns + coin icon + target icon).
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Decoupled from data layer; parent decides when to show it.
 * - SOLID: SRP — renders only the empty state UI.
 *
 * @module BudgetEmptyState
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetEmptyStateProps {
  /** Callback when the user taps "Create First Budget" */
  readonly onCreateBudget: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// NativeWind v4 shadow limitation — use inline style on TouchableOpacity
const CTA_BUTTON_SHADOW: ViewStyle = {
  shadowColor: palette.nileGreen[500],
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
};

const ILLUSTRATION_SIZE = 160;
const BAR_WIDTH = 24;

// ---------------------------------------------------------------------------
// Illustration Sub-component
// ---------------------------------------------------------------------------

/**
 * Mockup illustration: a rounded dark card containing 3 abstract bar chart
 * columns (gray, green, gray) with a coin icon and a target/bullseye icon.
 * Built entirely using View blocks + Ionicons, no static images needed.
 */
function EmptyIllustration(): React.JSX.Element {
  return (
    <View
      className="rounded-3xl items-center justify-end overflow-hidden bg-slate-800 dark:bg-slate-900"
      style={{ width: ILLUSTRATION_SIZE, height: ILLUSTRATION_SIZE }}
    >
      {/* Bar chart columns */}
      <View className="flex-row items-end mb-3" style={{ gap: 8 }}>
        {/* Bar 1 (gray, short) */}
        <View
          className="rounded-t-md bg-slate-500"
          style={{ width: BAR_WIDTH, height: 32 }}
        />
        {/* Bar 2 (green, tall) */}
        <View
          className="rounded-t-md"
          style={{
            width: BAR_WIDTH,
            height: 56,
            backgroundColor: palette.nileGreen[500],
          }}
        />
        {/* Bar 3 (gray, medium) */}
        <View
          className="rounded-t-md bg-slate-500"
          style={{ width: BAR_WIDTH, height: 44 }}
        />
      </View>

      {/* Bottom row: coin + target icons */}
      <View
        className="flex-row items-center justify-center mb-4"
        style={{ gap: 16 }}
      >
        <Ionicons name="wallet-outline" size={22} color={palette.gold[400]} />
        <Ionicons
          name="analytics-outline"
          size={22}
          color={palette.nileGreen[400]}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Empty state displayed when the user has no budgets.
 * Shows a composed illustration, heading, description, and a prominent CTA button.
 * Matches Mockup 6 from the approved Stitch designs.
 */
export function BudgetEmptyState({
  onCreateBudget,
}: BudgetEmptyStateProps): React.JSX.Element {
  const handlePress = useCallback((): void => {
    onCreateBudget();
  }, [onCreateBudget]);

  return (
    <View className="flex-1 items-center justify-center px-8 pb-20">
      {/* Composed illustration */}
      <View className="mb-6">
        <EmptyIllustration />
      </View>

      {/* Heading */}
      <Text className="text-xl font-bold text-slate-800 dark:text-white text-center">
        Start Budgeting Smarter
      </Text>

      {/* Description */}
      <Text className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center leading-5 px-4">
        Create your first budget to track spending and stay in control of your
        finances.
      </Text>

      {/* CTA Button — pill shaped per mockup */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create First Budget"
        accessibilityHint="Opens the budget creation form"
        className="mt-8 flex-row items-center rounded-full px-8 py-4"
        // NativeWind v4 shadow limitation — requires inline style on interactive components
        style={{
          backgroundColor: palette.nileGreen[500],
          ...CTA_BUTTON_SHADOW,
        }}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={palette.slate[50]}
        />
        <Text className="ms-2 text-base font-bold text-white">
          Create First Budget
        </Text>
      </TouchableOpacity>
    </View>
  );
}
