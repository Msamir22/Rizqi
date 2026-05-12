import { BaseCategory } from "./base/base-category";

/** Supported icon libraries from @expo/vector-icons */
type IconLibrary =
  | "Ionicons"
  | "MaterialCommunityIcons"
  | "FontAwesome5"
  | "MaterialIcons";

interface IconConfig {
  iconName: string;
  iconLibrary: IconLibrary;
}

export class Category extends BaseCategory {
  get isUserCategory(): boolean {
    return !this.isSystem && this.userId !== null;
  }

  get isExpense(): boolean {
    return this.type === "EXPENSE";
  }

  get isIncome(): boolean {
    return this.type === "INCOME";
  }

  /** Returns typed icon configuration for use with CategoryIcon component */
  get iconConfig(): IconConfig {
    return {
      iconName: this.icon,
      iconLibrary: this.iconLibrary as IconLibrary,
    };
  }
}
