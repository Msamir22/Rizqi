import { CategoryIcon, IconLibrary } from "@/components/common/CategoryIcon";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Category } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface CategoryListItemProps {
  /** The category to display */
  readonly category: Category;
  /** Whether this item has sub-categories (show chevron) */
  readonly hasChildren: boolean;
  /** Whether this is the currently selected category */
  readonly isSelected: boolean;
  /** Tap row body → select this category */
  readonly onSelect: () => void;
  /** Tap chevron → drill into children (only called if hasChildren) */
  readonly onDrillIn: () => void;
}

/**
 * Category list row with Split Touch Target pattern.
 *
 * - Categories WITH children: two distinct touch zones
 *   - Row body (icon + name): selects this category
 *   - Chevron button (right): drills into children
 * - Leaf categories (no children): full-width tap selects
 */
export const CategoryListItem = memo(function CategoryListItem({
  category,
  hasChildren,
  isSelected,
  onSelect,
  onDrillIn,
}: CategoryListItemProps): React.JSX.Element {
  const { isDark } = useTheme();
  const handleSelect = useCallback(() => {
    onSelect();
  }, [onSelect]);

  const handleDrillIn = useCallback(() => {
    onDrillIn();
  }, [onDrillIn]);

  return (
    <View
      className={`flex-row items-center rounded-2xl mb-2 overflow-hidden ${
        isSelected
          ? "bg-nileGreen-500/10 border border-nileGreen-500/30"
          : "bg-white dark:bg-slate-800/60"
      }`}
    >
      {/* Main row body — tap to SELECT */}
      <TouchableOpacity
        onPress={handleSelect}
        activeOpacity={0.7}
        className="flex-1 flex-row items-center px-4 py-3.5"
        accessibilityRole="button"
        accessibilityLabel={`Select ${category.displayName}`}
      >
        {/* Icon */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${category.color}20` }}
        >
          <CategoryIcon
            iconName={category.icon}
            iconLibrary={category.iconLibrary as IconLibrary}
            size={20}
            color={category.color}
          />
        </View>

        {/* Name */}
        <Text
          numberOfLines={1}
          className={`flex-1 text-base font-medium ${
            isSelected
              ? "text-nileGreen-700 dark:text-nileGreen-400 font-semibold"
              : "text-slate-800 dark:text-slate-100"
          }`}
        >
          {category.displayName}
        </Text>

        {/* Selected checkmark — always visible when selected */}
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[500]}
          />
        )}
      </TouchableOpacity>

      {/* Chevron button — tap to DRILL IN (only if has children) */}
      {hasChildren && (
        <TouchableOpacity
          onPress={handleDrillIn}
          activeOpacity={0.6}
          className="items-center min-w-12 min-h-12 justify-center px-4 py-3.5 border-l border-slate-200/50 dark:border-slate-700/50"
          accessibilityRole="button"
          accessibilityLabel={`View subcategories of ${category.displayName}`}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? palette.slate[400] : palette.slate[500]}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});
