import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { lightTheme, colors, palette } from "../../constants/colors";
import { BlurView } from "expo-blur";

export type FilterType = "All" | "Expenses" | "Income";

interface TransactionFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function TransactionFilters({
  activeFilter,
  onFilterChange,
}: TransactionFiltersProps) {
  const filters: FilterType[] = ["All", "Expenses", "Income"];

  return (
    <View style={styles.container}>
      {/* Search/Filter Container Glass */}
      <View style={styles.glassContainer}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={20} tint="light" style={styles.pillsContainer}>
            {filters.map((filter) =>
              renderPill(filter, activeFilter, onFilterChange)
            )}
          </BlurView>
        ) : (
          <View style={[styles.pillsContainer, styles.androidFallback]}>
            {filters.map((filter) =>
              renderPill(filter, activeFilter, onFilterChange)
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const renderPill = (
  filter: FilterType,
  activeFilter: FilterType,
  onFilterChange: (filter: FilterType) => void
) => {
  const isActive = activeFilter === filter;
  return (
    <TouchableOpacity
      key={filter}
      onPress={() => onFilterChange(filter)}
      style={[styles.pill, isActive ? styles.activePill : styles.inactivePill]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.pillText,
          isActive ? styles.activePillText : styles.inactivePillText,
        ]}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 8,
  },
  glassContainer: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "rgba(255, 255, 255, 0.1)", // Slight base tint
  },
  pillsContainer: {
    flexDirection: "row",
    padding: 6,
  },
  androidFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    backgroundColor: palette.nileGreen[600], // Strong brand color for active state
    shadowColor: palette.nileGreen[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  inactivePill: {
    backgroundColor: "transparent",
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  activePillText: {
    color: palette.slate[50],
  },
  inactivePillText: {
    color: palette.slate[700],
  },
});
