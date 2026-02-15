/**
 * Category Drill-down Card
 * Interactive donut chart with hierarchical category breakdown
 * L1 → L2 → L3 navigation with breadcrumbs
 */

import { database, Transaction } from "@astik/db";
import { useAllCategories } from "@/context/CategoriesContext";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// =============================================================================
// Types
// =============================================================================

interface CategoryData {
  id: string;
  name: string;
  displayName: string;
  amount: number;
  percentage: number;
  color: string;
  level: number;
  parentId: string | null;
  childrenIds: string[];
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
  level: number;
}

// =============================================================================
// Constants
// =============================================================================

const CHART_COLORS = [
  palette.nileGreen[500],
  palette.blue[500],
  palette.orange[500],
  palette.violet[500],
  palette.gold[400],
  palette.red[400],
  palette.nileGreen[600],
  palette.blue[600],
];

// =============================================================================
// Helper Functions
// =============================================================================

function getYearMonthBoundaries(
  year: number,
  month: number
): { startDate: number; endDate: number } {
  const startDate = new Date(year, month - 1, 1).getTime();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();
  return { startDate, endDate };
}

// =============================================================================
// Components
// =============================================================================

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}

function Breadcrumbs({
  items,
  onNavigate,
}: BreadcrumbsProps): React.JSX.Element {
  const { isDark } = useTheme();

  return (
    <View className="flex-row items-center flex-wrap mb-3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={item.id ?? "root"} className="flex-row items-center">
            <TouchableOpacity
              onPress={() => !isLast && onNavigate(item)}
              disabled={isLast}
            >
              <Text
                className={`text-sm ${
                  isLast
                    ? isDark
                      ? "text-white font-semibold"
                      : "text-slate-800 font-semibold"
                    : "text-nileGreen-500"
                }`}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
            {!isLast && (
              <Ionicons
                name="chevron-forward"
                size={14}
                color={isDark ? palette.slate[500] : palette.slate[400]}
                style={{ marginHorizontal: 4 }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

interface CategoryListItemProps {
  category: CategoryData;
  onPress: () => void;
  hasChildren: boolean;
}

function CategoryListItem({
  category,
  onPress,
  hasChildren,
}: CategoryListItemProps): React.JSX.Element {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!hasChildren}
      className="flex-row items-center py-2"
    >
      <View
        className="w-3 h-3 rounded-full mr-3"
        style={{ backgroundColor: category.color }}
      />
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-700"}`}
          numberOfLines={1}
        >
          {category.displayName}
        </Text>
      </View>
      <Text
        className={`text-sm font-semibold mr-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}
      >
        {formatCurrency({
          amount: category.amount,
          currency: "EGP",
        })}
      </Text>
      <Text
        className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
      >
        {category.percentage.toFixed(1)}%
      </Text>
      {hasChildren && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={isDark ? palette.slate[500] : palette.slate[400]}
          style={{ marginLeft: 4 }}
        />
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CategoryDrilldownCard(): React.JSX.Element {
  const { isDark } = useTheme();
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
          const current = amountsByCategory.get(cat.id) || 0;
          amountsByCategory.set(cat.id, current + tx.amount);
          break;
        } else if (cat.parentId === currentParentId) {
          // Found category at current level
          const current = amountsByCategory.get(cat.id) || 0;
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
      const amount = amountsByCategory.get(cat.id) || 0;
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

  const containerClass = isDark
    ? "bg-slate-800/50 border-slate-700"
    : "bg-slate-100/50 border-slate-200";

  return (
    <View className={`rounded-2xl border p-4 mb-4 ${containerClass}`}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-800"}`}
        >
          Category Breakdown
        </Text>
        <Text
          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          This Month
        </Text>
      </View>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbNav} />
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
          <Text
            className={`text-sm mt-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
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
                  <Text
                    className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Total
                  </Text>
                  <Text
                    className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}
                  >
                    {formatCurrency({
                      amount: totalAmount,
                      currency: "EGP",
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
          <View
            className={`border-t pt-3 ${isDark ? "border-slate-700" : "border-slate-200"}`}
          >
            {currentLevelData.slice(0, 6).map((cat) => (
              <CategoryListItem
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
