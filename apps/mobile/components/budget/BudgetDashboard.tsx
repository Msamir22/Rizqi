/**
 * BudgetDashboard Component
 *
 * Container component that composes the budget dashboard:
 * - Period filter chips
 * - Global budget hero card (if any)
 * - Category budget list
 * - Empty state (when no budgets)
 *
 * Architecture & Design Rationale:
 * - Pattern: Container Component (composition)
 * - Why: Orchestrates layout of presentational budget components.
 * - SOLID: SRP — manages layout, delegates data to hook and rendering to sub-components.
 *
 * @module BudgetDashboard
 */

import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "@/constants/colors";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useBudgets, type BudgetWithMetrics } from "@/hooks/useBudgets";
import { PeriodFilterChips } from "./PeriodFilterChips";
import { BudgetHeroCard } from "./BudgetHeroCard";
import { BudgetCategoryCard } from "./BudgetCategoryCard";
import { BudgetEmptyState } from "./BudgetEmptyState";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetDashboard(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { preferredCurrency } = usePreferredCurrency();
  const {
    globalBudget,
    categoryBudgets,
    isLoading,
    periodFilter,
    setPeriodFilter,
    budgets,
  } = useBudgets();

  const handleCreateBudget = useCallback((): void => {
    router.push("/create-budget");
  }, []);

  const handleBudgetPress = useCallback((budgetId: string): void => {
    router.push(`/budget-detail?id=${budgetId}`);
  }, []);

  const renderCategoryItem = useCallback(
    ({ item }: { item: BudgetWithMetrics }) => (
      <BudgetCategoryCard
        data={item}
        currency={preferredCurrency}
        onPress={() => handleBudgetPress(item.budget.id)}
      />
    ),
    [preferredCurrency, handleBudgetPress]
  );

  const keyExtractor = useCallback(
    (item: BudgetWithMetrics) => item.budget.id,
    []
  );

  // Loading
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
      </View>
    );
  }

  // Empty state
  if (budgets.length === 0) {
    return <BudgetEmptyState onCreateBudget={handleCreateBudget} />;
  }

  return (
    <View className="flex-1">
      {/* Period Filter */}
      <PeriodFilterChips selected={periodFilter} onSelect={setPeriodFilter} />

      {/* Budget Content */}
      <FlatList
        data={categoryBudgets as BudgetWithMetrics[]}
        keyExtractor={keyExtractor}
        renderItem={renderCategoryItem}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 80,
        }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={
          globalBudget ? (
            <View className="px-5">
              <BudgetHeroCard
                data={globalBudget}
                currency={preferredCurrency}
                onPress={() => handleBudgetPress(globalBudget.budget.id)}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}
