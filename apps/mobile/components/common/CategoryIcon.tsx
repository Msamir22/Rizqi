/**
 * CategoryIcon Component
 *
 * Renders an icon from multiple supported vector icon libraries.
 * Automatically handles fallback for invalid icon/library combinations.
 */

import type { Category } from "@monyvi/db";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import React from "react";

/** Supported icon libraries from @expo/vector-icons */
export type IconLibrary =
  | "Ionicons"
  | "MaterialCommunityIcons"
  | "FontAwesome5"
  | "MaterialIcons";

/** Standard props for @expo/vector-icons components */
interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

/** Generic type for an icon component */
type IconComponentType = React.ComponentType<IconProps>;

interface CategoryIconProps {
  /** Icon name from the target library */
  iconName: string;
  /** Icon library to use */
  iconLibrary: IconLibrary;
  /** Icon size in pixels */
  size?: number;
  /** Icon color (supports Tailwind via className) */
  color?: string;
}

const ICON_LIBRARIES: Record<IconLibrary, IconComponentType> = {
  Ionicons: Ionicons as unknown as IconComponentType,
  MaterialCommunityIcons:
    MaterialCommunityIcons as unknown as IconComponentType,
  FontAwesome5: FontAwesome5 as unknown as IconComponentType,
  MaterialIcons: MaterialIcons as unknown as IconComponentType,
};

// Duplicate interface removed - merged at top

/**
 * Renders a category icon from the specified icon library.
 * Falls back to Ionicons help-circle if the library is not found.
 */
export function CategoryIcon({
  iconName,
  iconLibrary,
  color,
  size = 24,
}: CategoryIconProps): React.JSX.Element {
  const IconComponent = ICON_LIBRARIES[iconLibrary] || ICON_LIBRARIES.Ionicons;

  return <IconComponent name={iconName} size={size} color={color} />;
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
}): React.JSX.Element {
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
