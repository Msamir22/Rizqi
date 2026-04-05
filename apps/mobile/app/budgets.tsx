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
import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

// =============================================================================
// Screen
// =============================================================================

export default function BudgetsScreen(): React.JSX.Element {
  const { t } = useTranslation("budgets");

  return (
    <View className="flex-1">
      <PageHeader
        title={t("budgets")}
        showBackButton={false}
        showDrawer={true}
      />

      <BudgetDashboard />
    </View>
  );
}
