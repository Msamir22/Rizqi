/**
 * BudgetHeroCard Component
 *
 * Prominent hero card for the Global budget displaying a centered
 * circular progress ring with budget name and subtitle.
 * Matches Mockup 1 (Budget Dashboard) from approved designs.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - SOLID: SRP — renders only the global budget visualization.
 *
 * @module BudgetHeroCard
 */

import React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { CircularProgress } from "./CircularProgress";
import type { BudgetWithMetrics } from "@/hooks/useBudgets";
import { formatCurrency } from "@astik/logic";
import type { CurrencyType } from "@astik/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetHeroCardProps {
  /** Global budget with computed spending metrics */
  readonly data: BudgetWithMetrics;
  /** Preferred user currency */
  readonly currency: CurrencyType;
  /** Callback when the card is tapped */
  readonly onPress: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_SHADOW: ViewStyle = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetHeroCard({
  data,
  currency,
  onPress,
}: BudgetHeroCardProps): React.JSX.Element {
  const { t } = useTranslation("budgets");
  const { budget, metrics, daysLeft } = data;
  const effectiveCurrency = budget.currency ?? currency;
  const isPaused = budget.status === "PAUSED";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="rounded-3xl border p-6 mb-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      style={[CARD_SHADOW, isPaused ? { opacity: 0.55 } : undefined]}
    >
      {/* S-02: Centered vertical stack layout matching mockup */}
      <View className="items-center">
        {/* Paused badge */}
        {isPaused && (
          <View className="bg-slate-500 rounded-full px-3 py-1 mb-3">
            <Text className="text-xs font-medium text-white">
              {t("paused")}
            </Text>
          </View>
        )}

        {/* Large centered circular progress ring */}
        <CircularProgress
          percentage={metrics.percentage}
          status={metrics.status}
          size={160}
          strokeWidth={12}
          label={t("spent")}
        />

        {/* Budget name */}
        <Text className="text-lg font-bold text-slate-800 dark:text-white mt-4">
          {budget.name}
        </Text>

        {/* Subtitle: limit · days remaining */}
        <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {formatCurrency({
            amount: metrics.limit,
            currency: effectiveCurrency,
          })}{" "}
          {t("limit_label")} · {t("days_remaining", { count: daysLeft })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
