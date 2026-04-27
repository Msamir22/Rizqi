import React from "react";
import { View } from "react-native";

/**
 * Shared visual wrapper for the mock-phone content inside each pitch slide.
 *
 * Every slide (Voice / SMS / Offline / Live Market) renders its unique
 * illustrative content inside the same card chrome — rounded, padded, light-
 * or dark-themed. This component factors out that repeated shell so each
 * `Slide*` component only defines its own content.
 *
 * Architecture: Presentational / Composition — no state, no hooks.
 * SOLID: SRP — styles the mock card only.
 */
interface PitchMockCardProps {
  readonly children: React.ReactNode;
}

export function PitchMockCard({
  children,
}: PitchMockCardProps): React.ReactElement {
  return (
    <View className="w-full max-w-sm mt-8 overflow-hidden rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
      {children}
    </View>
  );
}
