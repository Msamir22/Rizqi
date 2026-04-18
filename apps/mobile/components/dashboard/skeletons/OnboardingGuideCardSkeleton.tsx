/**
 * OnboardingGuideCardSkeleton — loading placeholder for the setup guide
 * card, matching the collapsed layout of OnboardingGuideCard.
 *
 * Mirrors:
 *   - Header row: rocket icon slot + "Setup Guide" label + "X/Y" pill
 *   - Progress bar
 *   - "Next: ..." single row
 */

import { Skeleton } from "@/components/ui/Skeleton";
import React from "react";
import { View } from "react-native";

export function OnboardingGuideCardSkeleton(): React.JSX.Element {
  return (
    <View className="rounded-xl my-4 overflow-hidden bg-slate-100 dark:bg-slate-800">
      {/* Header Row */}
      <View className="flex-row items-center justify-between px-4 pt-3.5">
        <View className="flex-row items-center gap-x-2">
          <Skeleton width={18} height={18} borderRadius={9} />
          <Skeleton width={90} height={14} borderRadius={4} />
          <Skeleton width={36} height={18} borderRadius={9} />
        </View>
        <Skeleton width={16} height={16} borderRadius={8} />
      </View>

      {/* Progress Bar */}
      <View className="mx-4 mt-3">
        <Skeleton width="100%" height={4} borderRadius={4} />
      </View>

      {/* Next Step Row */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-3.5">
        <Skeleton width="70%" height={14} borderRadius={4} />
        <Skeleton width={16} height={16} borderRadius={8} />
      </View>
    </View>
  );
}
