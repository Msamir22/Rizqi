import type { Category } from "@monyvi/db";
import type { CategoryTreeSource } from "@monyvi/logic";

export function toCategoryTreeSources(
  categories: readonly Category[]
): readonly CategoryTreeSource[] {
  return categories.filter(isCategoryTreeSource);
}

function isCategoryTreeSource(
  category: Category
): category is Category & { readonly type: CategoryTreeSource["type"] } {
  return category.type === "EXPENSE" || category.type === "INCOME";
}
