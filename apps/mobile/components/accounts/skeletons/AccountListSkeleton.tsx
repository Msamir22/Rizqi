/**
 * AccountListSkeleton — cold-start placeholder for the Accounts screen.
 *
 * Mirrors the live layout in `app/(tabs)/accounts.tsx`:
 *   - TotalBalanceCard placeholder
 *   - 3 × AccountCard placeholders matching `AccountCard.tsx`
 *
 * Replaces the brief "No accounts yet" flash that occurred on cold start
 * before WatermelonDB hydrated the list.
 *
 * @module AccountListSkeleton
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

/** A single AccountCard row placeholder mirroring AccountCard.tsx layout. */
function AccountCardSkeleton(): React.JSX.Element {
  return (
    <View className="mb-3 mx-5 rounded-2xl bg-white dark:bg-slate-800 border-l-[4px] border-slate-200 dark:border-slate-700">
      <View className="flex-row items-center p-4">
        {/* Icon circle */}
        <View className="me-4">
          <Skeleton width={48} height={48} borderRadius={16} />
        </View>

        {/* Name + subtitle */}
        <View className="flex-1">
          <Skeleton width={140} height={18} borderRadius={4} />
          <View style={{ marginTop: 6 }}>
            <Skeleton width={90} height={12} borderRadius={4} />
          </View>
        </View>

        {/* Balance */}
        <View className="items-end">
          <Skeleton width={80} height={20} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

/** Placeholder for the TotalBalanceCard at the top of the screen. */
function TotalBalanceCardSkeleton(): React.JSX.Element {
  return (
    <View className="p-6 rounded-3xl bg-white dark:bg-slate-800">
      <Skeleton width={110} height={14} borderRadius={4} />
      <View style={{ marginTop: 8 }}>
        <Skeleton width={180} height={32} borderRadius={4} />
      </View>
    </View>
  );
}

/**
 * Cold-start skeleton composition for the accounts list.
 */
export function AccountListSkeleton(): React.JSX.Element {
  return (
    <View className="flex-1">
      <View className="px-5 pb-6">
        <TotalBalanceCardSkeleton />
      </View>
      <AccountCardSkeleton />
      <AccountCardSkeleton />
      <AccountCardSkeleton />
    </View>
  );
}
