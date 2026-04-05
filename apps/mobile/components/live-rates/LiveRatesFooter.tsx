/**
 * Live Rates Footer
 *
 * Displays a sticky footer with clock icon and "Updated X min ago" timestamp.
 * Receives pre-formatted text from the hook.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presenter Component (pure, props-driven)
 * - SOLID: SRP — renders only the timestamp footer.
 *
 * @module LiveRatesFooter
 */

import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import React from "react";
import { Text, View } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface LiveRatesFooterProps {
  readonly lastUpdatedText: string;
}

// =============================================================================
// Component
// =============================================================================

export function LiveRatesFooter({
  lastUpdatedText,
}: LiveRatesFooterProps): React.JSX.Element {
  if (!lastUpdatedText) return <></>;

  return (
    <View className="py-4 items-center flex-row justify-center">
      <Ionicons name="time-outline" size={14} color={palette.slate[500]} />
      <Text className="ms-1.5 text-xs text-slate-500 dark:text-slate-400">
        {lastUpdatedText}
      </Text>
    </View>
  );
}
