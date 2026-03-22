/**
 * BudgetEmptyState Component
 *
 * Full-page empty state shown when the user has no budgets.
 * Follows the same pattern as EmptyMetalsState.tsx.
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

const CTA_BUTTON_SHADOW: ViewStyle = {
  shadowColor: palette.nileGreen[500],
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
};

const ICON_CONTAINER_SIZE = 96;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Empty state displayed when the user has no budgets.
 * Shows an icon, heading, description, and a prominent CTA button.
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
      {/* Illustration: Wallet + Target icon */}
      <View
        className="mb-6 items-center justify-center rounded-full bg-emerald-50 dark:bg-slate-800"
        style={{ width: ICON_CONTAINER_SIZE, height: ICON_CONTAINER_SIZE }}
      >
        <Ionicons
          name="wallet-outline"
          size={40}
          color={palette.nileGreen[500]}
        />
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

      {/* CTA Button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create First Budget"
        accessibilityHint="Opens the budget creation form"
        className="mt-8 flex-row items-center rounded-2xl px-8 py-4"
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
        <Text className="ml-2 text-base font-bold text-white">
          Create First Budget
        </Text>
      </TouchableOpacity>
    </View>
  );
}
