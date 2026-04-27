/**
 * DashboardSkeleton — full dashboard loading placeholder.
 *
 * Composed of every section skeleton in the same vertical order as the
 * real dashboard. Shown at app start before WatermelonDB is ready so
 * users see the actual content shape immediately instead of a blank
 * spinner.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { ScrollView, View } from "react-native";

import { AccountsSectionSkeleton } from "./AccountsSectionSkeleton";
import { LiveRatesSkeleton } from "./LiveRatesSkeleton";
import { RecentTransactionsSkeleton } from "./RecentTransactionsSkeleton";
import { ThisMonthSkeleton } from "./ThisMonthSkeleton";
import { TotalNetWorthSkeleton } from "./TotalNetWorthSkeleton";
import { UpcomingPaymentsSkeleton } from "./UpcomingPaymentsSkeleton";

/**
 * Placeholder for the TopNav — three pill-shaped shimmers matching the
 * menu / currency chip / settings actions, plus a greeting shimmer line
 * beneath, mirroring `app/(tabs)/index.tsx`.
 */
function TopNavSkeleton(): React.JSX.Element {
  return (
    <View>
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-x-3">
          <Skeleton width={28} height={28} borderRadius={14} />
          <Skeleton width={72} height={20} borderRadius={4} />
        </View>
        <View className="flex-row items-center gap-x-2">
          <Skeleton width={72} height={28} borderRadius={14} />
          <Skeleton width={28} height={28} borderRadius={14} />
          <Skeleton width={28} height={28} borderRadius={14} />
        </View>
      </View>
      <View className="mb-4">
        <Skeleton width={200} height={18} borderRadius={4} />
      </View>
    </View>
  );
}

export function DashboardSkeleton(): React.JSX.Element {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-5 pt-[10px]">
        <TopNavSkeleton />
        <TotalNetWorthSkeleton />
        <LiveRatesSkeleton />
        <AccountsSectionSkeleton />
        <ThisMonthSkeleton />
        <UpcomingPaymentsSkeleton />
        <RecentTransactionsSkeleton />
      </View>
    </ScrollView>
  );
}
