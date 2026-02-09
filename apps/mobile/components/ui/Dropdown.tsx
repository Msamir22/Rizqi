import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { cssInterop } from "react-native-css-interop";
import { palette } from "@/constants/colors";

cssInterop(Ionicons, {
  className: {
    target: "style",
    nativeStyleToProp: { color: true },
  },
});

export interface DropdownItem<T> {
  value: T;
  label: string;
  icon?: string;
  iconType?: "emoji" | "ionicons";
  description?: string;
}

interface DropdownProps<T> {
  label: string;
  items: ReadonlyArray<DropdownItem<T>>;
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
}: DropdownProps<T>): React.JSX.Element {
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
                      name={selectedItem.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      className="text-nileGreen-600 dark:text-nileGreen-400"
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
              className="text-slate-500 dark:text-slate-400"
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
                        name={item.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        className={
                          item.value === value
                            ? "text-nileGreen-600"
                            : "text-slate-500 dark:text-slate-400"
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
                    style={{ color: palette.nileGreen[600] }}
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
