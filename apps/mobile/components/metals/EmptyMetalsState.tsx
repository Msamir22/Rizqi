/**
 * EmptyMetalsState Component
 *
 * Full-page empty state shown when the user has no metal holdings.
 * Displays an illustration with a CTA to add the first holding.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Decoupled from data layer; parent decides when to show it.
 * - SOLID: SRP — renders only the empty state UI.
 *
 * @module EmptyMetalsState
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Image, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmptyMetalsStateProps {
  /** Callback when the user taps "Add to Savings" */
  readonly onAddHolding: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EMPTY_ILLUSTRATION = require("@/assets/images/empty-metals.png") as number;

const ILLUSTRATION_SIZE = { width: 200, height: 140 };

const ADD_BUTTON_SHADOW: ViewStyle = {
  shadowColor: palette.gold[600],
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Empty state displayed when the user has no metal holdings.
 * Shows an illustration, heading, description, and a prominent CTA button.
 */
export function EmptyMetalsState({
  onAddHolding,
}: EmptyMetalsStateProps): React.JSX.Element {
  const handlePress = useCallback((): void => {
    onAddHolding();
  }, [onAddHolding]);

  return (
    <View className="flex-1 items-center justify-center px-8 pb-20">
      {/* Illustration */}
      <Image
        source={EMPTY_ILLUSTRATION}
        style={ILLUSTRATION_SIZE}
        resizeMode="contain"
        accessibilityLabel="Empty metals illustration"
      />

      {/* Heading */}
      <Text className="mt-6 text-xl font-bold text-slate-800 dark:text-white text-center">
        Start Tracking Your Metals
      </Text>

      {/* Description */}
      <Text className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center leading-5">
        Add your gold and silver holdings to track their value in real-time.
      </Text>

      {/* CTA Button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        className="mt-8 flex-row items-center rounded-2xl px-8 py-4"
        style={{
          backgroundColor: palette.gold[600],
          ...ADD_BUTTON_SHADOW,
        }}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={palette.slate[50]}
        />
        <Text className="ml-2 text-base font-bold text-white">
          Add to Savings
        </Text>
      </TouchableOpacity>
    </View>
  );
}
