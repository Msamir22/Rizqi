/**
 * Currency Row
 *
 * Individual currency row in the Live Rates currency list.
 * Displays flag emoji, bold code, currency name, formatted rate, and change badge.
 * Display-only (no onPress handler).
 *
 * Architecture & Design Rationale:
 * - Pattern: Composable Component (Atomic Design Level 2 — Molecule)
 * - SOLID: SRP — renders one currency row. Reused N times in CurrencySection.
 *
 * @module CurrencyRow
 */

import { palette } from "@/constants/colors";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

// =============================================================================
// Constants
// =============================================================================

const ROW_HEIGHT = 48;

// =============================================================================
// Types
// =============================================================================

interface CurrencyRowProps {
  readonly flag: string;
  readonly code: string;
  readonly name: string;
  readonly rate: string;
  readonly changePercent: number;
}

// =============================================================================
// Component
// =============================================================================

export function CurrencyRow({
  flag,
  code,
  name,
  rate,
  changePercent,
}: CurrencyRowProps): React.JSX.Element {
  const roundedChange = Number(changePercent.toFixed(2));
  const isUp = roundedChange > 0;
  const isFlat = roundedChange === 0;
  const changeColor = isFlat
    ? "text-slate-500 dark:text-slate-400"
    : isUp
      ? "text-nileGreen-500"
      : "text-red-500";

  const changeLabel = `${Math.abs(roundedChange).toFixed(2)}%`;

  const trendIcon = isFlat ? null : isUp ? "arrow-drop-up" : "arrow-drop-down";
  const trendIconColor = isFlat
    ? palette.slate[400]
    : isUp
      ? palette.nileGreen[500]
      : palette.red[500];

  return (
    <View
      className="flex-row items-center px-2 border-b border-slate-100 dark:border-slate-800"
      style={{ height: ROW_HEIGHT }}
    >
      {/* Flag */}
      <Text className="text-lg me-2.5">{flag}</Text>

      {/* Code + Name */}
      <View className="flex-1">
        <Text className="text-sm font-bold text-slate-800 dark:text-white">
          {code}
        </Text>
        <Text
          className="text-[11px] text-slate-500 dark:text-slate-400"
          numberOfLines={1}
        >
          {name}
        </Text>
      </View>

      {/* Rate + Change */}
      <View className="items-end">
        <Text className="text-sm font-semibold text-slate-800 dark:text-white">
          {rate}
        </Text>
        <View className="flex-row items-center">
          {trendIcon && (
            <MaterialIcons
              name={trendIcon}
              size={20}
              color={trendIconColor}
              style={{ marginRight: -2, marginLeft: -3 }}
            />
          )}
          <Text className={`text-[11px] font-medium ${changeColor}`}>
            {changeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
