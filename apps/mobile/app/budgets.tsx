/**
 * Budgets Screen
 *
 * Main entry point for the Budget Management feature.
 * Accessible from the app drawer. Displays the budget dashboard
 * with a FAB for creating new budgets.
 *
 * @module budgets
 */

import { PageHeader } from "@/components/navigation/PageHeader";
import { BudgetDashboard } from "@/components/budget/BudgetDashboard";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Screen
// =============================================================================

export default function BudgetsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      <PageHeader title="Budgets" showBackButton={true} showDrawer={false} />

      <BudgetDashboard />

      {/* FAB - Create Budget */}
      <TouchableOpacity
        onPress={() => router.push("/create-budget")}
        className="absolute right-5 bg-nileGreen-500 w-14 h-14 rounded-full items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Create budget"
        accessibilityHint="Opens the form to create a new budget"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          bottom: insets.bottom + 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
