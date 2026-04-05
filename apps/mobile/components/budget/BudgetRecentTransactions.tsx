/**
 * BudgetRecentTransactions Component
 *
 * Shows the last 6 matching transactions for the current budget period.
 *
 * @module BudgetRecentTransactions
 */

import React from "react";
import { Text, View } from "react-native";
import type { Transaction } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { palette } from "@/constants/colors";
import { useCategoryLookup } from "@/context/CategoriesContext";
import {
  CategoryIcon,
  type IconLibrary,
} from "@/components/common/CategoryIcon";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetRecentTransactionsProps {
  readonly transactions: readonly Transaction[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetRecentTransactions({
  transactions,
}: BudgetRecentTransactionsProps): React.JSX.Element {
  const categoryMap = useCategoryLookup();
  const { isDark } = useTheme();

  if (transactions.length === 0) return <></>;

  return (
    <View className="mb-6">
      <Text className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2 ml-[22px]">
        Recent Transactions
      </Text>
      <View className="rounded-3xl border p-5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        {transactions.map((tx, index) => {
          const category = categoryMap.get(tx.categoryId);
          return (
            <View
              key={tx.id}
              className={`flex-row items-center py-3 ${
                index < transactions.length - 1
                  ? "border-b border-slate-200/60 dark:border-slate-700"
                  : ""
              }`}
            >
              {/* Category icon */}
              <View className="w-10 h-10 rounded-xl items-center justify-center me-3 bg-slate-100 dark:bg-slate-700/50">
                {category ? (
                  <CategoryIcon
                    iconName={category.iconConfig.iconName}
                    iconLibrary={category.iconConfig.iconLibrary as IconLibrary}
                    size={18}
                    color={category.iconConfig.iconColor}
                  />
                ) : (
                  <Ionicons
                    name="receipt-outline"
                    size={18}
                    color={isDark ? palette.slate[400] : palette.slate[500]}
                  />
                )}
              </View>

              {/* Info */}
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold text-slate-800 dark:text-white"
                  numberOfLines={1}
                >
                  {tx.counterparty ?? category?.displayName ?? "Expense"}
                </Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {new Date(tx.date).toLocaleDateString()}
                </Text>
              </View>

              {/* Amount */}
              <Text className="text-sm font-bold text-red-500">
                -{formatCurrency({ amount: tx.amount, currency: tx.currency })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
