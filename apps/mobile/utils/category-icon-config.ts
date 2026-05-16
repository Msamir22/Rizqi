import type { Category } from "@monyvi/db";
import { palette } from "@/constants/colors";
import type { IconLibrary } from "@/components/common/CategoryIcon";

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

export function getCategoryIconConfig(category: Category): CategoryIconConfig {
  return {
    iconName: category.icon,
    iconLibrary: toIconLibrary(category.iconLibrary),
    iconColor:
      category.color ??
      (category.isExpense ? palette.red[500] : palette.nileGreen[500]),
  };
}
