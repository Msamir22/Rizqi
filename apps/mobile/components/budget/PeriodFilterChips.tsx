/**
 * PeriodFilterChips Component
 *
 * Horizontal row of filter chips (All | Weekly | Monthly | Custom)
 * with "All" selected by default. Used on the Budgets dashboard
 * to filter budgets by period type.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Presentational Component
 * - Why: Parent controls selected state via props.
 * - SOLID: SRP — renders filter chips only.
 *
 * @module PeriodFilterChips
 */

import React, { useCallback } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import type { BudgetPeriod } from "@astik/db";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodFilter = "ALL" | BudgetPeriod;

interface PeriodFilterChipsProps {
  /** Currently selected filter */
  readonly selected: PeriodFilter;
  /** Callback when a chip is tapped */
  readonly onSelect: (filter: PeriodFilter) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface ChipConfig {
  readonly key: PeriodFilter;
  readonly label: string;
}

const CHIPS: readonly ChipConfig[] = [
  { key: "ALL", label: "All" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "CUSTOM", label: "Custom" },
] as const;

const ACTIVE_BG_COLOR = palette.nileGreen[500];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeriodFilterChips({
  selected,
  onSelect,
}: PeriodFilterChipsProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 py-2"
    >
      {CHIPS.map((chip) => (
        <FilterChip
          key={chip.key}
          label={chip.label}
          isActive={selected === chip.key}
          onPress={() => onSelect(chip.key)}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// FilterChip (internal)
// ---------------------------------------------------------------------------

interface FilterChipProps {
  readonly label: string;
  readonly isActive: boolean;
  readonly onPress: () => void;
}

function FilterChip({
  label,
  isActive,
  onPress,
}: FilterChipProps): React.JSX.Element {
  const handlePress = useCallback((): void => {
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      activeOpacity={0.8}
      className={`rounded-full px-4 py-2 ${
        isActive ? "" : "bg-slate-100 dark:bg-slate-800"
      }`}
      style={isActive ? { backgroundColor: ACTIVE_BG_COLOR } : undefined}
    >
      <Text
        className={`text-sm font-semibold ${
          isActive ? "text-white" : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
