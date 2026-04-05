/**
 * Stats Tab Screen
 * Analytics and insights about spending patterns.
 * Composition-only — all UI is delegated to extracted components.
 */

import { PageHeader } from "@/components/navigation/PageHeader";
import { CategoryDrilldownCard } from "@/components/stats/CategoryDrilldownCard";
import { MonthlyExpenseChart } from "@/components/stats/MonthlyExpenseChart";
import { QuickStats } from "@/components/stats/QuickStats";
import { TAB_BAR_HEIGHT } from "@/constants/ui";
import { useTranslation } from "react-i18next";
import React from "react";
import { ScrollView, View } from "react-native";

// =============================================================================
// Screen
// =============================================================================

export default function StatsScreen(): React.JSX.Element {
  const { t } = useTranslation("common");

  return (
    <View className="flex-1">
      <PageHeader title={t("stats")} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4">
          <QuickStats />
          <MonthlyExpenseChart />
          <CategoryDrilldownCard />
        </View>
      </ScrollView>
    </View>
  );
}
