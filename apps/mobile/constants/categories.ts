import { Category } from "@astik/logic";

export interface CategoryUI {
  id: Category;
  name: string;
  icon: string;
  color: string;
}

export const CATEGORY_UI: Record<Category, CategoryUI> = {
  Food: { id: "Food", name: "Food", icon: "fast-food", color: "#F59E0B" }, // Amber-500
  Transport: {
    id: "Transport",
    name: "Transport",
    icon: "car",
    color: "#3B82F6",
  }, // Blue-500
  Shopping: {
    id: "Shopping",
    name: "Shopping",
    icon: "cart",
    color: "#EC4899",
  }, // Pink-500
  Utilities: {
    id: "Utilities",
    name: "Utilities",
    icon: "flash",
    color: "#8B5CF6",
  }, // Violet-500
  Entertainment: {
    id: "Entertainment",
    name: "Entertainment",
    icon: "game-controller",
    color: "#14B8A6",
  }, // Teal-500
  Health: { id: "Health", name: "Health", icon: "medkit", color: "#EF4444" }, // Red-500
  Education: {
    id: "Education",
    name: "Education",
    icon: "school",
    color: "#F97316",
  }, // Orange-500
  Housing: { id: "Housing", name: "Housing", icon: "home", color: "#6366F1" }, // Indigo-500
  Transfer: {
    id: "Transfer",
    name: "Transfer",
    icon: "swap-horizontal",
    color: "#6B7280",
  }, // Gray-500
  Income: { id: "Income", name: "Income", icon: "wallet", color: "#10B981" }, // Emerald-500
  Other: {
    id: "Other",
    name: "Other",
    icon: "ellipsis-horizontal",
    color: "#9CA3AF",
  }, // Gray-400
};

export const CATEGORY_LIST = Object.values(CATEGORY_UI);
