/**
 * UpcomingPaymentsSkeleton — loading placeholder for the upcoming bills card.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

function PaymentItemSkeleton(): React.JSX.Element {
  return (
    <View className="flex-row items-center py-3">
      <Skeleton width={36} height={36} borderRadius={18} />
      <View className="flex-1 ms-3 gap-y-1.5">
        <Skeleton width="60%" height={14} borderRadius={4} />
        <Skeleton width="40%" height={12} borderRadius={4} />
      </View>
      <Skeleton width={70} height={16} borderRadius={4} />
    </View>
  );
}

export function UpcomingPaymentsSkeleton(): React.JSX.Element {
  return (
    <View className="my-4 rounded-2xl border p-4 overflow-hidden bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      <View className="flex-row items-center justify-between mb-3">
        <Skeleton width={140} height={20} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </View>
      <PaymentItemSkeleton />
      <PaymentItemSkeleton />
      <PaymentItemSkeleton />
    </View>
  );
}
