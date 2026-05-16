import { palette } from "../../constants/colors";
import {
  type CategoryIconSource,
  getCategoryIconConfig,
} from "../../utils/category-icon-config";

function makeCategory(
  overrides: Partial<CategoryIconSource> & {
    readonly icon: string;
    readonly iconLibrary: string;
    readonly isExpense: boolean;
  }
): CategoryIconSource {
  const category: CategoryIconSource = {
    color: null,
    ...overrides,
  };
  return category;
}

describe("getCategoryIconConfig", () => {
  it("preserves a supported icon library and custom category color", () => {
    const category = makeCategory({
      icon: "cart-outline",
      iconLibrary: "MaterialCommunityIcons",
      color: palette.blue[500],
      isExpense: true,
    });

    expect(getCategoryIconConfig(category)).toEqual({
      iconName: "cart-outline",
      iconLibrary: "MaterialCommunityIcons",
      iconColor: palette.blue[500],
    });
  });

  it("falls back to Ionicons and expense color when the stored library is invalid", () => {
    const category = makeCategory({
      icon: "receipt-outline",
      iconLibrary: "UnknownIcons",
      isExpense: true,
    });

    expect(getCategoryIconConfig(category)).toEqual({
      iconName: "receipt-outline",
      iconLibrary: "Ionicons",
      iconColor: palette.red[500],
    });
  });

  it("uses the income fallback color for income categories without a custom color", () => {
    const category = makeCategory({
      icon: "cash-outline",
      iconLibrary: "Ionicons",
      isExpense: false,
    });

    expect(getCategoryIconConfig(category).iconColor).toBe(
      palette.nileGreen[500]
    );
  });
});
