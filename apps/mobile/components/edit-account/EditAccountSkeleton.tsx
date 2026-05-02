/**
 * EditAccountSkeleton — content-loading placeholder for edit-account.tsx.
 *
 * Replaces the previous `<ActivityIndicator>` per
 * `.claude/rules/skeleton-loading.md`. Mirrors the form layout users
 * will see once the account hydrates so the transition feels stable.
 *
 * Layout reference: `app/edit-account.tsx` EditAccountForm render.
 *
 * @module EditAccountSkeleton
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** A label + field row placeholder. */
function FormRowSkeleton(): React.JSX.Element {
  return (
    <View className="mb-5">
      <Skeleton width={100} height={12} borderRadius={4} />
      <View style={{ marginTop: 8 }}>
        <Skeleton width="100%" height={48} borderRadius={12} />
      </View>
    </View>
  );
}

/**
 * Form-shaped skeleton for the Edit Account screen.
 */
export function EditAccountSkeleton(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background dark:bg-background-dark"
      style={{ paddingTop: insets.top }}
    >
      {/* Header strip placeholder */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <Skeleton width={32} height={32} borderRadius={16} />
        <Skeleton width={120} height={20} borderRadius={4} />
        <Skeleton width={56} height={20} borderRadius={4} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View className="mb-6 items-center px-4">
          <View className="w-full rounded-[40px] items-center justify-center py-8 px-6 bg-nileGreen-50 dark:bg-nileGreen-900/30 border border-nileGreen-100 dark:border-nileGreen-800/50">
            <View className="mb-4">
              <Skeleton width={80} height={80} borderRadius={24} />
            </View>
            <View className="mb-2">
              <Skeleton width={160} height={22} borderRadius={4} />
            </View>
            <Skeleton width={100} height={14} borderRadius={4} />
          </View>
        </View>

        {/* Form rows */}
        <View className="px-4">
          <FormRowSkeleton />
          <FormRowSkeleton />
          <FormRowSkeleton />
          <FormRowSkeleton />

          {/* Default toggle row */}
          <View className="flex-row items-center justify-between py-4 px-1 mb-3">
            <View className="flex-row items-center flex-1">
              <Skeleton width={22} height={22} borderRadius={11} />
              <View className="ms-3 flex-1">
                <Skeleton width={130} height={16} borderRadius={4} />
                <View style={{ marginTop: 6 }}>
                  <Skeleton width="80%" height={12} borderRadius={4} />
                </View>
              </View>
            </View>
            <Skeleton width={48} height={28} borderRadius={14} />
          </View>

          {/* Danger zone */}
          <View className="mt-8 rounded-2xl border border-red-200 dark:border-red-800/30 bg-red-50/50 dark:bg-red-900/10 p-4">
            <Skeleton width={110} height={14} borderRadius={4} />
            <View style={{ marginTop: 8 }}>
              <Skeleton width="90%" height={14} borderRadius={4} />
            </View>
            <View style={{ marginTop: 16 }}>
              <Skeleton width="100%" height={44} borderRadius={12} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
