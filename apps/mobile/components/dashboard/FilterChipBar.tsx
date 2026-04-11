/**
 * FilterChipBar — Reusable horizontal scrolling filter chip bar.
 *
 * Extracted from ThisMonth and UpcomingPayments to eliminate duplicated
 * filter pill markup (DRY — E2).
 */

import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface FilterChipBarProps<T extends string> {
  /** The list of option values to display as chips */
  options: readonly T[];
  /** The currently selected option */
  selected: T;
  /** Callback when an option is selected */
  onSelect: (option: T) => void;
  /** Maps each option value to a display label */
  labelMap: Record<T, string>;
  /** Additional className for the ScrollView container */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Renders a horizontal, scrollable bar of selectable filter chips.
 *
 * The selected chip is highlighted with nileGreen background; unselected chips
 * use a neutral slate style that adapts to dark mode.
 *
 * @example
 * <FilterChipBar
 *   options={["today", "this_week", "this_month"]}
 *   selected={selectedPeriod}
 *   onSelect={setSelectedPeriod}
 *   labelMap={{ today: "Today", this_week: "This Week", this_month: "This Month" }}
 * />
 */
function FilterChipBarComponent<T extends string>({
  options,
  selected,
  onSelect,
  labelMap,
  className,
}: FilterChipBarProps<T>): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className}
      contentContainerClassName="gap-2"
    >
      {options.map((option) => (
        <FilterChip
          key={option}
          label={labelMap[option]}
          isSelected={option === selected}
          onPress={() => onSelect(option)}
        />
      ))}
    </ScrollView>
  );
}

// =============================================================================
// FilterChip (internal)
// =============================================================================

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

const FilterChip = React.memo(function FilterChip({
  label,
  isSelected,
  onPress,
}: FilterChipProps): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border ${
        isSelected
          ? "bg-nileGreen-500 border-nileGreen-500"
          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          isSelected ? "text-white" : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// React.memo doesn't work directly with generics, so we cast
export const FilterChipBar = React.memo(
  FilterChipBarComponent
) as typeof FilterChipBarComponent;
