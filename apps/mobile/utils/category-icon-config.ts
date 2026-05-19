import { palette } from "@/constants/colors";
import type { IconLibrary } from "@/components/common/CategoryIcon";

export interface CategoryIconSource {
  readonly icon: string;
  readonly iconLibrary: string;
  readonly color?: string | null;
  readonly isExpense: boolean;
}

export interface CategoryIconConfig {
  readonly iconName: string;
  readonly iconLibrary: IconLibrary;
  readonly iconColor: string;
}

function toIconLibrary(iconLibrary: string): IconLibrary {
  switch (iconLibrary) {
    case "MaterialCommunityIcons":
    case "FontAwesome5":
    case "MaterialIcons":
    case "Ionicons":
      return iconLibrary;
    default:
      return "Ionicons";
  }
}

export function getCategoryIconConfig(
  category: CategoryIconSource
): CategoryIconConfig {
  return {
    iconName: category.icon,
    iconLibrary: toIconLibrary(category.iconLibrary),
    iconColor:
      category.color ??
      (category.isExpense ? palette.red[500] : palette.nileGreen[500]),
  };
}
