import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TextInput, View } from "react-native";

interface CategorySearchBarProps {
  /** Placeholder text (e.g. "Search Groceries") */
  readonly placeholder: string;
  /** Current search query */
  readonly value: string;
  /** Text change handler */
  readonly onChangeText: (text: string) => void;
}

/**
 * Search bar for filtering categories at the current drill-down level.
 * Placeholder text changes dynamically based on the current level name.
 */
export function CategorySearchBar({
  placeholder,
  value,
  onChangeText,
}: CategorySearchBarProps): React.JSX.Element {
  const { isDark } = useTheme();
  return (
    <View className="mx-4 mb-3 flex-row items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
      <Ionicons
        name="search-outline"
        size={18}
        color={isDark ? palette.slate[400] : palette.slate[500]}
        className="mr-2"
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        className="flex-1 text-sm text-slate-800 dark:text-slate-100"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Ionicons
          name="close-circle"
          size={18}
          color={isDark ? palette.slate[400] : palette.slate[500]}
          className="ml-1"
          onPress={() => onChangeText("")}
        />
      )}
    </View>
  );
}
