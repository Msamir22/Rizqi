import { CategoryIcon, IconLibrary } from "@/components/common/CategoryIcon";
import { palette } from "@/constants/colors";
import { Category } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface CategoryPickerProps {
  selectedCategory: Category | null;
  categories: Category[]; // Should be filtered by type (income/expense)
  onOpenPicker: () => void;
  recentCategories?: Category[];
  onSelectRecent: (category: Category) => void;
}

export function CategoryPicker({
  selectedCategory,
  onOpenPicker,
  recentCategories = [],
  onSelectRecent,
}: CategoryPickerProps): React.JSX.Element {
  return (
    <View className="mb-6">
      <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
        Category
      </Text>

      {/* Main Selector */}
      <TouchableOpacity
        onPress={onOpenPicker}
        activeOpacity={0.7}
        className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-3"
      >
        <View
          className="w-10 h-10 rounded-2xl items-center justify-center mr-3 bg-slate-100 dark:bg-slate-700/50"
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
              className="text-slate-500 dark:text-slate-400"
              color={palette.slate[500]}
            />
          )}
        </View>

        <Text className="flex-1 text-base font-semibold text-slate-900 dark:text-white">
          {selectedCategory?.displayName || "Select Category"}
        </Text>

        <Ionicons
          name="chevron-down"
          size={20}
          className="text-slate-400"
          color={palette.slate[400]}
        />
      </TouchableOpacity>

      {/* Recent Chips */}
      {recentCategories.length > 0 && (
        <View className="flex-row gap-2 flex-wrap px-1">
          {recentCategories.slice(0, 4).map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => onSelectRecent(cat)}
              className="flex-row items-center bg-slate-100 dark:bg-slate-800/50 py-1.5 px-3 rounded-full border border-slate-200 dark:border-slate-700/50"
            >
              <CategoryIcon
                iconName={cat.icon}
                iconLibrary={cat.iconLibrary as IconLibrary}
                size={12}
                color={cat.color}
              />
              <Text className="ml-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {cat.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
