/**
 * LiveRatesSkeleton — loading placeholder for the horizontal rate pills.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

function RatePillSkeleton(): React.JSX.Element {
  return (
    <View className="h-9 rounded-full bg-slate-100 dark:bg-slate-800 px-3 flex-row items-center gap-x-2">
      <Skeleton width={16} height={16} borderRadius={8} />
      <Skeleton width={60} height={14} borderRadius={4} />
      <Skeleton width={50} height={14} borderRadius={4} />
    </View>
  );
}

export function LiveRatesSkeleton(): React.JSX.Element {
  return (
    <View className="my-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Skeleton width={90} height={18} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </View>
      <View className="flex-row gap-x-2">
        <RatePillSkeleton />
        <RatePillSkeleton />
        <RatePillSkeleton />
      </View>
    </View>
  );
}
