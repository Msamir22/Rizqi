/**
 * TotalNetWorthSkeleton — loading placeholder for TotalNetWorthCard
 *
 * Mirrors the gradient card with shimmer lines for label + amount.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import { palette } from "@/constants/colors";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View } from "react-native";

export function TotalNetWorthSkeleton(): React.JSX.Element {
  return (
    <View className="relative my-4 items-center justify-center">
      <LinearGradient
        colors={[palette.nileGreen[800], palette.nileGreen[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="relative min-h-[180px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 p-6"
      >
        <View className="z-10 items-center gap-2">
          <Skeleton width={140} height={14} borderRadius={4} />
          <View style={{ marginTop: 8 }}>
            <Skeleton width={220} height={42} borderRadius={8} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Skeleton width={110} height={16} borderRadius={4} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
