/**
 * Category Drill-down Card
 * Interactive donut chart with hierarchical category breakdown
 * L1 → L2 → L3 navigation with breadcrumbs
 */

import {
  DrilldownBreadcrumbs,
  DrilldownCategoryItem,
  CHART_COLORS,
  type BreadcrumbItem,
  type CategoryData,
} from "./drilldown";
import { palette } from "@/constants/colors";
import { useAllCategories } from "@/context/CategoriesContext";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useTheme } from "@/context/ThemeContext";
import { database, Transaction } from "@astik/db";
import { formatCurrency, getYearMonthBoundaries } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { PieChart } from "react-native-gifted-charts";

// =============================================================================
// Main Component
// =============================================================================

export function CategoryDrilldownCard(): React.JSX.Element {
  const { isDark } = useTheme();
  const { preferredCurrency } = usePreferredCurrency();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { categories, isLoading: categoriesLoading } = useAllCategories();
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "All Categories", level: 0 },
  ]);

  const isLoading = transactionsLoading || categoriesLoading;

  // Load transactions only (categories come from context)
  useEffect(() => {
    const { startDate, endDate } = getYearMonthBoundaries(
      currentYear,
      currentMonth
    );

    const subscription = database
      .get<Transaction>("transactions")
      .query(
        Q.where("deleted", false),
        Q.where("date", Q.gte(startDate)),
        Q.where("date", Q.lte(endDate)),
        Q.where("type", "EXPENSE")
      )
      .observe()
      .subscribe({
        next: (result) => {
          setTransactions(result);
          setTransactionsLoading(false);
        },
        error: (err) => console.error("Error loading transactions:", err),
      });

    return () => subscription.unsubscribe();
  }, [currentYear, currentMonth]);

  // Build category map with children info
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryData>();

    categories.forEach((cat) => {
      map.set(cat.id, {
        id: cat.id,
        name: cat.displayName,
        displayName: cat.displayName,
        amount: 0,
        percentage: 0,
        color: CHART_COLORS[map.size % CHART_COLORS.length],
        level: cat.level,
        parentId: cat.parentId ?? null,
        childrenIds: [],
      });
    });

    // Build children references
    categories.forEach((cat) => {
      if (cat.parentId) {
        const parent = map.get(cat.parentId);
        if (parent) {
          // childrenIds is mutable (string[]) — readonly on the interface
          // only prevents property reassignment, not array mutation.
          parent.childrenIds.push(cat.id);
        }
      }
    });

    return map;
  }, [categories]);

  // Calculate amounts for current level
  const currentLevelData = useMemo(() => {
    // Get categories at current level
    const levelCategories = Array.from(categoryMap.values()).filter((cat) => {
      if (currentParentId === null) {
        return cat.level === 1; // Root level - show L1 categories
      }
      return cat.parentId === currentParentId;
    });

    // Calculate amounts by aggregating transactions
    const amountsByCategory = new Map<string, number>();

    transactions.forEach((tx) => {
      if (!tx.categoryId) return;

      // Find the appropriate category at current level
      const catId = tx.categoryId;
      let cat = categoryMap.get(catId);

      // Walk up the hierarchy to find the category at current level
      while (cat) {
        if (currentParentId === null && cat.level === 1) {
          // At root, aggregate to L1
          const current = amountsByCategory.get(cat.id) ?? 0;
          amountsByCategory.set(cat.id, current + tx.amount);
          break;
        } else if (cat.parentId === currentParentId) {
          // Found category at current level
          const current = amountsByCategory.get(cat.id) ?? 0;
          amountsByCategory.set(cat.id, current + tx.amount);
          break;
        }

        // Move up to parent
        if (cat.parentId) {
          cat = categoryMap.get(cat.parentId);
        } else {
          break;
        }
      }
    });

    // Update category data with amounts
    const result: CategoryData[] = [];
    const total = Array.from(amountsByCategory.values()).reduce(
      (sum, a) => sum + a,
      0
    );

    levelCategories.forEach((cat, index) => {
      const amount = amountsByCategory.get(cat.id) ?? 0;
      if (amount > 0) {
        result.push({
          ...cat,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: CHART_COLORS[index % CHART_COLORS.length],
        });
      }
    });

    // Sort by amount descending
    return result.sort((a, b) => b.amount - a.amount);
  }, [transactions, categoryMap, currentParentId]);

  // Calculate total for current view
  const totalAmount = currentLevelData.reduce((sum, c) => sum + c.amount, 0);

  // Handle drill-down
  const handleDrillDown = (category: CategoryData): void => {
    if (category.childrenIds.length === 0) return;

    setCurrentParentId(category.id);
    setBreadcrumbs((prev) => [
      ...prev,
      { id: category.id, name: category.displayName, level: category.level },
    ]);
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbNav = (item: BreadcrumbItem): void => {
    setCurrentParentId(item.id);

    // Remove all breadcrumbs after the clicked one
    const index = breadcrumbs.findIndex((b) => b.id === item.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  // Prepare pie chart data
  const pieData = currentLevelData.map((cat) => ({
    value: cat.amount,
    color: cat.color,
    text: cat.percentage > 5 ? `${cat.percentage.toFixed(0)}%` : "",
    focused: false,
  }));

  return (
    <View className="rounded-2xl border p-4 mb-4 bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-bold text-slate-800 dark:text-white">
          Category Breakdown
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          This Month
        </Text>
      </View>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <DrilldownBreadcrumbs
          items={breadcrumbs}
          onNavigate={handleBreadcrumbNav}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <View className="h-[250px] items-center justify-center">
          <ActivityIndicator size="small" color={palette.nileGreen[500]} />
        </View>
      ) : currentLevelData.length === 0 ? (
        <View className="py-8 items-center">
          <Ionicons
            name="pie-chart-outline"
            size={40}
            color={isDark ? palette.slate[600] : palette.slate[300]}
          />
          <Text className="text-sm mt-3 text-slate-400 dark:text-slate-500">
            No spending data
          </Text>
        </View>
      ) : (
        <View>
          {/* Donut Chart */}
          <View className="items-center mb-4">
            <PieChart
              data={pieData}
              donut
              radius={80}
              innerRadius={50}
              innerCircleColor={
                isDark ? palette.slate[800] : palette.slate[100]
              }
              centerLabelComponent={() => (
                <View className="items-center">
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    Total
                  </Text>
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">
                    {formatCurrency({
                      amount: totalAmount,
                      currency: preferredCurrency,
                    })}
                  </Text>
                </View>
              )}
              showText
              textColor="white"
              textSize={10}
              focusOnPress
            />
          </View>

          {/* Category List */}
          <View className="border-t pt-3 border-slate-200 dark:border-slate-700">
            {currentLevelData.slice(0, 6).map((cat) => (
              <DrilldownCategoryItem
                key={cat.id}
                category={cat}
                onPress={() => handleDrillDown(cat)}
                hasChildren={cat.childrenIds.length > 0}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
