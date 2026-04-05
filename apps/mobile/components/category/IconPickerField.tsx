/**
 * IconPickerField Component
 *
 * A form field that integrates the IconPicker modal.
 * Shows the currently selected icon and opens picker on tap.
 */

import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { IconLibrary } from "@/constants/category-icons";
import { palette } from "@/constants/colors";
import { CategoryIcon } from "../common/CategoryIcon";
import { IconPicker } from "./IconPicker";

interface IconPickerFieldProps {
  /** Label for the field */
  label?: string;
  /** Currently selected icon name */
  iconName: string;
  /** Currently selected icon library */
  iconLibrary: IconLibrary;
  /** Color to display the icon with */
  iconColor?: string;
  /** Callback when icon selection changes */
  onChange: (iconName: string, iconLibrary: IconLibrary) => void;
  /** Whether the field is disabled (e.g., for system categories) */
  disabled?: boolean;
}

export function IconPickerField({
  label = "Icon",
  iconName,
  iconLibrary,
  iconColor = palette.nileGreen[500],
  onChange,
  disabled = false,
}: IconPickerFieldProps): React.ReactElement {
  const [isPickerVisible, setPickerVisible] = useState(false);

  const handleSelect = (name: string, library: IconLibrary): void => {
    onChange(name, library);
  };

  return (
    <View className="mb-4">
      {label && (
        <Text className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => !disabled && setPickerVisible(true)}
        disabled={disabled}
        className="flex-row items-center rounded-xl bg-slate-100 p-3 dark:bg-slate-800"
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        {/* Icon Preview */}
        <View
          className="me-3 h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <CategoryIcon
            iconName={iconName}
            iconLibrary={iconLibrary}
            size={24}
            color={iconColor}
          />
        </View>

        {/* Text */}
        <View className="flex-1">
          <Text className="text-base text-slate-800 dark:text-white">
            {iconName}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {iconLibrary}
          </Text>
        </View>

        {/* Chevron */}
        {!disabled && (
          <CategoryIcon
            iconName="chevron-forward"
            iconLibrary="Ionicons"
            size={20}
            color={palette.slate[400]}
          />
        )}
      </TouchableOpacity>

      {/* Picker Modal */}
      <IconPicker
        visible={isPickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleSelect}
        selectedIcon={iconName}
        previewColor={iconColor}
      />
    </View>
  );
}
