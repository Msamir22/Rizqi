/**
 * RecentTransactionsSkeleton — loading placeholder for the recent
 * transactions list on the dashboard.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

function TransactionItemSkeleton(): React.JSX.Element {
  return (
    <View className="flex-row items-center py-3">
      <Skeleton width={36} height={36} borderRadius={18} />
      <View className="flex-1 ms-3 gap-y-1.5">
        <Skeleton width="65%" height={15} borderRadius={4} />
        <Skeleton width="35%" height={12} borderRadius={4} />
      </View>
      <Skeleton width={80} height={15} borderRadius={4} />
    </View>
  );
}

export function RecentTransactionsSkeleton(): React.JSX.Element {
  return (
    <View className="my-4">
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Skeleton width={160} height={18} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </View>
      <View className="rounded-3xl border p-4 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
        <TransactionItemSkeleton />
        <TransactionItemSkeleton />
        <TransactionItemSkeleton />
      </View>
    </View>
  );
}
