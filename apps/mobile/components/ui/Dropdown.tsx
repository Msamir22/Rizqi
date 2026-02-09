import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export interface DropdownItem<T> {
  value: T;
  label: string;
  icon?: string;
  iconType?: "emoji" | "ionicons";
  description?: string;
}

interface DropdownProps<T> {
  label: string;
  items: readonly DropdownItem<T>[];
  value: T;
  onChange: (value: T) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  placeholder?: string;
}

/**
 * A generic, reusable dropdown component with support for icons and descriptions.
 * Follows the project's premium design language.
 */
export function Dropdown<T extends string | number>({
  label,
  items,
  value,
  onChange,
  isOpen,
  onToggle,
  className = "",
  placeholder = "Select...",
}: DropdownProps<T>) {
  const { isDark } = useTheme();
  const selectedItem = items.find((item) => item.value === value);

  return (
    <View className={`mb-3 ${className}`}>
      <Text className="input-label mb-2">{label}</Text>

      <View className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden shadow-sm">
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          className="p-4"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              {selectedItem?.icon && (
                <View className="mr-3 w-8 items-center">
                  {selectedItem.iconType === "ionicons" ? (
                    <Ionicons
                      name={selectedItem.icon as any}
                      size={20}
                      color={
                        isDark ? palette.nileGreen[400] : palette.nileGreen[600]
                      }
                    />
                  ) : (
                    <Text className="text-xl">{selectedItem.icon}</Text>
                  )}
                </View>
              )}
              <Text className="text-base font-medium text-slate-900 dark:text-white">
                {selectedItem?.label || placeholder}
              </Text>
            </View>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={isDark ? palette.slate[400] : palette.slate[500]}
            />
          </View>
        </TouchableOpacity>

        {isOpen && (
          <View className="border-t border-slate-100 dark:border-slate-700 max-h-60">
            {items.map((item, index) => (
              <TouchableOpacity
                key={String(item.value)}
                onPress={() => {
                  onChange(item.value);
                  onToggle();
                }}
                activeOpacity={0.6}
                className={`flex-row items-center p-4 ${
                  index !== items.length - 1
                    ? "border-b border-slate-50 dark:border-slate-700/50"
                    : ""
                } ${
                  item.value === value
                    ? "bg-nileGreen-50/50 dark:bg-nileGreen-900/10"
                    : ""
                }`}
              >
                {item.icon && (
                  <View className="mr-3 w-8 items-center">
                    {item.iconType === "ionicons" ? (
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={
                          item.value === value
                            ? palette.nileGreen[600]
                            : isDark
                              ? palette.slate[400]
                              : palette.slate[500]
                        }
                      />
                    ) : (
                      <Text className="text-xl">{item.icon}</Text>
                    )}
                  </View>
                )}
                <View className="flex-1">
                  <Text
                    className={`text-base ${
                      item.value === value
                        ? "font-bold text-nileGreen-700 dark:text-nileGreen-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      {item.description}
                    </Text>
                  )}
                </View>
                {item.value === value && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={palette.nileGreen[600]}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
