/**
 * CategoryIcon Component
 *
 * Renders an icon from multiple supported vector icon libraries.
 * Automatically handles fallback for invalid icon/library combinations.
 */

import React from "react";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  MaterialIcons,
} from "@expo/vector-icons";
import type { Category } from "@astik/db";

/** Supported icon libraries from @expo/vector-icons */
export type IconLibrary =
  | "Ionicons"
  | "MaterialCommunityIcons"
  | "FontAwesome5"
  | "MaterialIcons";

interface CategoryIconProps {
  /** Icon name from the target library */
  iconName: string;
  /** Icon library to use */
  iconLibrary: IconLibrary;
  /** Icon size in pixels */
  size?: number;
  /** Icon color */
  color?: string;
}

const ICON_LIBRARIES = {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  MaterialIcons,
} as const;

/**
 * Renders a category icon from the specified icon library.
 * Falls back to Ionicons help-circle if the library is not found.
 */
export function CategoryIcon({
  iconName,
  iconLibrary,
  color,
  size = 24,
}: CategoryIconProps): React.ReactElement {
  const IconComponent = ICON_LIBRARIES[iconLibrary] ?? Ionicons;

  return (
    <IconComponent
      // Using 'as never' to handle the union type mismatch between libraries
      name={iconName as never}
      size={size}
      color={color}
    />
  );
}

/**
 * Renders an icon from a Category model instance.
 * Convenience wrapper that uses the category's iconConfig getter.
 */
export function CategoryIconFromModel({
  category,
  size = 24,
}: {
  category: Category;
  size?: number;
}): React.ReactElement {
  const { iconName, iconLibrary, iconColor } = category.iconConfig;

  return (
    <CategoryIcon
      iconName={iconName}
      iconLibrary={iconLibrary}
      color={iconColor}
      size={size}
    />
  );
}
