import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { palette } from "../../constants/colors";

export type FilterType = "All" | "Expenses" | "Income";

interface TransactionFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function TransactionFilters({
  activeFilter,
  onFilterChange,
}: TransactionFiltersProps): ReactNode {
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
): ReactNode => {
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
  activePill: {
    backgroundColor: palette.nileGreen[600], // Strong brand color for active state
    shadowColor: palette.nileGreen[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  activePillText: {
    color: palette.slate[50],
  },
  androidFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  container: {
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  glassContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden", // Slight base tint
  },
  inactivePill: {
    backgroundColor: "transparent",
  },
  inactivePillText: {
    color: palette.slate[700],
  },
  pill: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 10,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pillsContainer: {
    flexDirection: "row",
    padding: 6,
  },
});
