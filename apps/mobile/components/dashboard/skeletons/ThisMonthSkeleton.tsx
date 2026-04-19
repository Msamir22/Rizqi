/**
 * ThisMonthSkeleton — loading placeholder for the ThisMonth summary card
 * (ring gauge + stats).
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

export function ThisMonthSkeleton(): React.JSX.Element {
  return (
    <View className="my-4 rounded-2xl border p-4 overflow-hidden bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Skeleton width={110} height={20} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </View>

      {/* Ring + stats row */}
      <View className="flex-row items-center mb-4">
        {/* Ring gauge placeholder */}
        <Skeleton width={80} height={80} borderRadius={40} />

        {/* Stats placeholder */}
        <View className="flex-1 ms-5 gap-2">
          <Skeleton width="80%" height={14} borderRadius={4} />
          <Skeleton width="70%" height={14} borderRadius={4} />
          <Skeleton width="75%" height={14} borderRadius={4} />
        </View>
      </View>

      {/* Divider — matches ThisMonth's -mx-4 divider */}
      <View className="h-[1px] bg-slate-200 dark:bg-slate-700 -mx-4 mb-3" />

      {/* Period filter chips placeholder */}
      <View className="flex-row gap-x-2 -mx-4 px-4">
        <Skeleton width={68} height={30} borderRadius={15} />
        <Skeleton width={72} height={30} borderRadius={15} />
        <Skeleton width={80} height={30} borderRadius={15} />
        <Skeleton width={64} height={30} borderRadius={15} />
      </View>
    </View>
  );
}
