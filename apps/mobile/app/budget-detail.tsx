/**
 * Budget Detail Screen
 *
 * Shows full detail for a single budget: overview card, weekly spending,
 * subcategory breakdown, and recent transactions.
 * Accessible via tapping a budget card on the dashboard.
 *
 * @module budget-detail
 */

import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PageHeader } from "@/components/navigation/PageHeader";
import { BudgetDetailOverview } from "@/components/budget/BudgetDetailOverview";
import { BudgetSpendingTrendChart } from "@/components/budget/BudgetSpendingTrendChart";
import { SubcategoryBreakdown } from "@/components/budget/SubcategoryBreakdown";
import { BudgetRecentTransactions } from "@/components/budget/BudgetRecentTransactions";
import {
  BudgetActionsSheet,
  type BudgetAction,
} from "@/components/budget/BudgetActionsSheet";
import { useBudgetDetail } from "@/hooks/useBudgetDetail";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useToast } from "@/components/ui/Toast";
import {
  deleteBudget,
  pauseBudget,
  resumeBudget,
} from "@/services/budget-service";
import { palette } from "@/constants/colors";

// =============================================================================
// Screen
// =============================================================================

export default function BudgetDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { preferredCurrency } = usePreferredCurrency();
  const { showToast } = useToast();

  const {
    budget,
    metrics,
    daysLeft,
    weeklySpending,
    subcategoryBreakdown,
    recentTransactions,
    isLoading,
  } = useBudgetDetail(id ?? "");

  const [showActions, setShowActions] = useState(false);

  const handleAction = useCallback(
    async (action: BudgetAction): Promise<void> => {
      if (!budget) return;

      try {
        switch (action) {
          case "edit":
            router.push(`/create-budget?id=${budget.id}`);
            break;
          case "pause":
            await pauseBudget(budget.id);
            showToast({
              type: "success",
              title: "Paused",
              message: "Budget paused",
            });
            break;
          case "resume":
            await resumeBudget(budget.id);
            showToast({
              type: "success",
              title: "Resumed",
              message: "Budget resumed",
            });
            break;
          case "delete":
            await deleteBudget(budget.id);
            showToast({
              type: "success",
              title: "Deleted",
              message: "Budget deleted",
            });
            router.back();
            break;
        }
      } catch (err) {
        showToast({
          type: "error",
          title: "Error",
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    },
    [budget, showToast]
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <View className="flex-1">
        <PageHeader
          title="Budget Detail"
          showBackButton={true}
          showDrawer={false}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={palette.nileGreen[500]} />
        </View>
      </View>
    );
  }

  // ── Budget not found ──
  if (!budget || !metrics) {
    return (
      <View className="flex-1">
        <PageHeader
          title="Budget Detail"
          showBackButton={true}
          showDrawer={false}
        />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-semibold text-slate-600 dark:text-slate-400 text-center">
            Budget not found
          </Text>
          <Text className="text-sm text-slate-400 dark:text-slate-500 mt-1 text-center">
            This budget may have been deleted.
          </Text>
        </View>
      </View>
    );
  }

  const effectiveCurrency = budget.currency ?? preferredCurrency;

  return (
    <View className="flex-1">
      <PageHeader
        title={budget.name}
        centerTitle
        showBackButton={true}
        showDrawer={false}
        rightAction={{
          icon: "ellipsis-horizontal",
          transparent: true,
          onPress: () => setShowActions(true),
        }}
      />

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Overview Card */}
        <BudgetDetailOverview
          metrics={metrics}
          currency={effectiveCurrency}
          daysLeft={daysLeft}
        />

        {/* Spending Trend Chart */}
        {weeklySpending.length > 0 ? (
          <BudgetSpendingTrendChart
            data={weeklySpending.map((w) => ({
              label: w.bucket.label,
              amount: w.amount,
            }))}
            currency={effectiveCurrency}
            weeklyAverage={budget.amount / Math.max(weeklySpending.length, 1)}
          />
        ) : null}

        {/* Subcategory Breakdown */}
        {budget.isCategoryBudget && (
          <SubcategoryBreakdown
            data={subcategoryBreakdown}
            currency={effectiveCurrency}
          />
        )}

        {/* Recent Transactions */}
        <BudgetRecentTransactions transactions={recentTransactions} />
      </ScrollView>

      {/* Actions Sheet — uses absolute overlay, not Modal */}
      <BudgetActionsSheet
        visible={showActions}
        isPaused={budget.isPaused}
        onClose={() => setShowActions(false)}
        onAction={handleAction}
      />
    </View>
  );
}
