/**
 * BudgetDashboard Component
 *
 * Container component that composes the budget dashboard:
 * - Period filter chips
 * - Global budget hero card (if any)
 * - Category budget list with section header
 * - Bottom summary bar (safe to spend + daily limit)
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
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { palette } from "@/constants/colors";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useBudgets, type BudgetWithMetrics } from "@/hooks/useBudgets";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency } from "@astik/logic";
import { PeriodFilterChips } from "./PeriodFilterChips";
import { BudgetHeroCard } from "./BudgetHeroCard";
import { BudgetCategoryCard } from "./BudgetCategoryCard";
import { BudgetEmptyState } from "./BudgetEmptyState";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetDashboard(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { t } = useTranslation("budgets");
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

  // S-01: Compute safe-to-spend and daily limit from global budget
  const safeToSpend = globalBudget
    ? Math.max(0, globalBudget.metrics.remaining)
    : 0;
  const dailyLimit =
    globalBudget && globalBudget.daysLeft > 0
      ? safeToSpend / globalBudget.daysLeft
      : 0;

  return (
    <View className="flex-1">
      {/* Period Filter */}
      <PeriodFilterChips selected={periodFilter} onSelect={setPeriodFilter} />

      {/* Budget Content or Empty State */}
      {budgets.length === 0 ? (
        <BudgetEmptyState onCreateBudget={handleCreateBudget} />
      ) : (
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
            <>
              {/* Hero Card */}
              {globalBudget ? (
                <View className="px-5 mt-6 mb-2">
                  <BudgetHeroCard
                    data={globalBudget}
                    currency={preferredCurrency}
                    onPress={() => handleBudgetPress(globalBudget.budget.id)}
                  />
                </View>
              ) : null}

              {/* S-04: CATEGORIES section header */}
              {categoryBudgets.length > 0 && (
                <View className="flex-row items-center justify-between px-5 mb-3 mt-2">
                  <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                    {t("categories")}
                  </Text>
                  <Ionicons
                    name="options-outline"
                    size={16}
                    color={isDark ? palette.slate[500] : palette.slate[400]}
                  />
                </View>
              )}
            </>
          }
        />
      )}

      {/* S-01: Bottom summary bar */}
      {globalBudget && (
        <View
          className="flex-row items-center justify-center border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="items-center flex-1">
            <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              {t("safe_to_spend")}
            </Text>
            <Text
              className="text-base font-bold"
              style={{ color: palette.nileGreen[500] }}
            >
              {formatCurrency({
                amount: safeToSpend,
                currency: preferredCurrency,
                maximumFractionDigits: 0,
              })}
            </Text>
          </View>

          {/* Vertical divider */}
          <View className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-4" />

          <View className="items-center flex-1">
            <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              {t("daily_limit")}
            </Text>
            <Text className="text-base font-bold text-slate-800 dark:text-white">
              {formatCurrency({
                amount: dailyLimit,
                currency: preferredCurrency,
                maximumFractionDigits: 0,
              })}
            </Text>
          </View>
        </View>
      )}

      {/* FAB - Create Budget */}
      {budgets.length > 0 && (
        <TouchableOpacity
          onPress={handleCreateBudget}
          className="absolute end-5 bg-nileGreen-500 w-14 h-14 rounded-full items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t("accessibility_create_budget")}
          accessibilityHint={t("accessibility_create_budget_hint")}
          // NativeWind v4 shadow limitation — requires inline style on interactive components
          style={{
            bottom: globalBudget
              ? insets.bottom + 85 // Above bottom summary bar
              : insets.bottom + 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
