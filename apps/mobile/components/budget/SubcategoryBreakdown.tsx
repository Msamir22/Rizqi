/**
 * SubcategoryBreakdown Component
 *
 * Ranked list of subcategory spending within a budget.
 * Shows category name, amount, percentage, and thin progress bar.
 *
 * @module SubcategoryBreakdown
 */

import React from "react";
import { Text, View } from "react-native";
import type { SubcategorySpending } from "@/hooks/useBudgetDetail";
import type { CurrencyType } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubcategoryBreakdownProps {
  readonly data: readonly SubcategorySpending[];
  readonly currency: CurrencyType;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS: readonly string[] = [
  palette.nileGreen[500],
  palette.gold[600],
  palette.red[500],
  palette.blue[500],
  palette.violet[500],
  palette.slate[500],
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubcategoryBreakdown({
  data,
  currency,
}: SubcategoryBreakdownProps): React.JSX.Element {
  if (data.length === 0) return <></>;

  return (
    <View className="mb-6">
      <Text className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2 ms-[22px]">
        Top Subcategories
      </Text>
      <View className="rounded-3xl border p-5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        {data.map((item, index) => (
          <View
            key={item.categoryId}
            className={index < data.length - 1 ? "mb-5" : ""}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-2.5 h-2.5 rounded-full me-2"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <Text
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  numberOfLines={1}
                >
                  {item.categoryName}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-sm font-bold text-slate-800 dark:text-white me-2">
                  {formatCurrency({ amount: item.amount, currency })}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.round(item.percentage)}%
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(item.percentage, 100))}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
