import { CategoryIcon, IconLibrary } from "@/components/common/CategoryIcon";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import type { Category } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

interface CategoryPickerProps {
  selectedCategory: Category | null;
  categories: readonly Category[];
  onOpenPicker: () => void;
  onSelectCategory: (category: Category) => void;
  hideMainSelector?: boolean;
}

/**
 * Arranges categories into columns of 2 for a horizontal-scrollable 2-row grid.
 * Categories are sorted by usage_count descending before arrangement.
 */
function arrangeIntoColumns(categories: readonly Category[]): Category[][] {
  const sorted = [...categories].sort(
    (a, b) => (b.usageCount || 0) - (a.usageCount || 0)
  );

  const columns: Category[][] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const column: Category[] = [sorted[i]];
    if (sorted[i + 1]) {
      column.push(sorted[i + 1]);
    }
    columns.push(column);
  }
  return columns;
}

function CategoryChip({
  category,
  isSelected,
  onPress,
}: {
  category: Category;
  isSelected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center py-1.5 px-3 rounded-full border ${
        isSelected
          ? "bg-nileGreen-500/10 border-nileGreen-500/40 dark:bg-nileGreen-500/15 dark:border-nileGreen-500/30"
          : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50"
      }`}
    >
      <CategoryIcon
        iconName={category.icon}
        iconLibrary={category.iconLibrary as IconLibrary}
        size={12}
        color={category.color}
      />
      <Text
        numberOfLines={1}
        className={`ms-1.5 text-xs font-medium ${
          isSelected
            ? "text-nileGreen-700 dark:text-nileGreen-400"
            : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {category.displayName}
      </Text>
    </TouchableOpacity>
  );
}

export function CategoryPicker({
  selectedCategory,
  categories,
  onOpenPicker,
  onSelectCategory,
  hideMainSelector = false,
}: CategoryPickerProps): React.JSX.Element {
  const { isDark } = useTheme();
  const { t } = useTranslation("transactions");

  const columns = useMemo(() => arrangeIntoColumns(categories), [categories]);

  return (
    <View className={hideMainSelector ? "mb-3" : "mb-6"}>
      {!hideMainSelector && (
        <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
          {t("category")}
        </Text>
      )}

      {/* Main Selector */}
      {!hideMainSelector && (
        <TouchableOpacity
          onPress={onOpenPicker}
          activeOpacity={0.7}
          className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-3"
        >
          <View
            className="w-10 h-10 rounded-2xl items-center justify-center me-3 bg-slate-100 dark:bg-slate-700/50"
            style={{
              backgroundColor: selectedCategory?.color
                ? `${selectedCategory.color}20`
                : undefined,
            }}
          >
            {selectedCategory ? (
              <CategoryIcon
                iconName={selectedCategory.icon}
                iconLibrary={selectedCategory.iconLibrary as IconLibrary}
                size={20}
                color={selectedCategory.color}
              />
            ) : (
              <Ionicons
                name="grid-outline"
                size={20}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            )}
          </View>

          <Text className="flex-1 text-base font-semibold text-slate-900 dark:text-white">
            {selectedCategory?.displayName || t("select_category_label")}
          </Text>

          <Ionicons
            name="chevron-down"
            size={20}
            color={isDark ? palette.slate[500] : palette.slate[400]}
          />
        </TouchableOpacity>
      )}

      {/* Horizontal-scroll 2-row chip grid */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
        >
          {columns.map((column, colIdx) => (
            <View key={`col-${colIdx}`} className="gap-6">
              {column.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  category={cat}
                  isSelected={selectedCategory?.id === cat.id}
                  onPress={() => onSelectCategory(cat)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
