/**
 * AccountsSectionSkeleton — loading placeholder for the dashboard
 * accounts carousel.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

/** A single account card placeholder */
function AccountCardSkeleton(): React.JSX.Element {
  return (
    <View className="w-[180px] h-[110px] rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 justify-between">
      <Skeleton width={48} height={14} borderRadius={4} />
      <View>
        <Skeleton width={120} height={22} borderRadius={4} />
        <View style={{ marginTop: 6 }}>
          <Skeleton width={80} height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

export function AccountsSectionSkeleton(): React.JSX.Element {
  return (
    <View className="my-4">
      <View className="flex-row items-center justify-between mb-3">
        <Skeleton width={110} height={18} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </View>
      <View className="flex-row gap-x-3">
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
      </View>
    </View>
  );
}
