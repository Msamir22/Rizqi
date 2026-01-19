/**
 * Curated Category Icons
 *
 * A curated list of icons suitable for expense/income categories.
 * Organized by category type for easy browsing.
 */

/** Supported icon libraries from @expo/vector-icons */
export type IconLibrary =
  | "Ionicons"
  | "MaterialCommunityIcons"
  | "FontAwesome5"
  | "MaterialIcons";

export interface IconOption {
  name: string;
  library: IconLibrary;
}

/**
 * Curated icons for food & dining categories
 */
export const FOOD_ICONS: IconOption[] = [
  { name: "fast-food", library: "Ionicons" },
  { name: "restaurant", library: "Ionicons" },
  { name: "cafe", library: "Ionicons" },
  { name: "pizza", library: "Ionicons" },
  { name: "beer", library: "Ionicons" },
  { name: "wine", library: "Ionicons" },
  { name: "ice-cream", library: "Ionicons" },
  { name: "nutrition", library: "Ionicons" },
  { name: "basket", library: "Ionicons" },
];

/**
 * Curated icons for transportation categories
 */
export const TRANSPORT_ICONS: IconOption[] = [
  { name: "car", library: "Ionicons" },
  { name: "car-sport", library: "Ionicons" },
  { name: "bus", library: "Ionicons" },
  { name: "train", library: "Ionicons" },
  { name: "airplane", library: "Ionicons" },
  { name: "boat", library: "Ionicons" },
  { name: "bicycle", library: "Ionicons" },
  { name: "walk", library: "Ionicons" },
  { name: "navigate", library: "Ionicons" },
];

/**
 * Curated icons for shopping categories
 */
export const SHOPPING_ICONS: IconOption[] = [
  { name: "cart", library: "Ionicons" },
  { name: "bag", library: "Ionicons" },
  { name: "pricetag", library: "Ionicons" },
  { name: "shirt", library: "Ionicons" },
  { name: "watch", library: "Ionicons" },
  { name: "gift", library: "Ionicons" },
  { name: "diamond", library: "Ionicons" },
  { name: "phone-portrait", library: "Ionicons" },
  { name: "laptop", library: "Ionicons" },
];

/**
 * Curated icons for health & wellness categories
 */
export const HEALTH_ICONS: IconOption[] = [
  { name: "medkit", library: "Ionicons" },
  { name: "medical", library: "Ionicons" },
  { name: "bandage", library: "Ionicons" },
  { name: "fitness", library: "Ionicons" },
  { name: "heart", library: "Ionicons" },
  { name: "pulse", library: "Ionicons" },
  { name: "body", library: "Ionicons" },
];

/**
 * Curated icons for home & utilities categories
 */
export const HOME_ICONS: IconOption[] = [
  { name: "home", library: "Ionicons" },
  { name: "flash", library: "Ionicons" },
  { name: "water", library: "Ionicons" },
  { name: "flame", library: "Ionicons" },
  { name: "wifi", library: "Ionicons" },
  { name: "tv", library: "Ionicons" },
  { name: "bulb", library: "Ionicons" },
  { name: "bed", library: "Ionicons" },
  { name: "key", library: "Ionicons" },
];

/**
 * Curated icons for entertainment categories
 */
export const ENTERTAINMENT_ICONS: IconOption[] = [
  { name: "game-controller", library: "Ionicons" },
  { name: "musical-notes", library: "Ionicons" },
  { name: "film", library: "Ionicons" },
  { name: "ticket", library: "Ionicons" },
  { name: "videocam", library: "Ionicons" },
  { name: "headset", library: "Ionicons" },
  { name: "book", library: "Ionicons" },
  { name: "library", library: "Ionicons" },
];

/**
 * Curated icons for work & finance categories
 */
export const FINANCE_ICONS: IconOption[] = [
  { name: "wallet", library: "Ionicons" },
  { name: "cash", library: "Ionicons" },
  { name: "card", library: "Ionicons" },
  { name: "briefcase", library: "Ionicons" },
  { name: "business", library: "Ionicons" },
  { name: "trending-up", library: "Ionicons" },
  { name: "stats-chart", library: "Ionicons" },
  { name: "receipt", library: "Ionicons" },
  { name: "calculator", library: "Ionicons" },
];

/**
 * Curated icons for education categories
 */
export const EDUCATION_ICONS: IconOption[] = [
  { name: "school", library: "Ionicons" },
  { name: "book", library: "Ionicons" },
  { name: "reader", library: "Ionicons" },
  { name: "library", library: "Ionicons" },
  { name: "pencil", library: "Ionicons" },
  { name: "create", library: "Ionicons" },
];

/**
 * Curated icons for travel categories
 */
export const TRAVEL_ICONS: IconOption[] = [
  { name: "airplane", library: "Ionicons" },
  { name: "globe", library: "Ionicons" },
  { name: "map", library: "Ionicons" },
  { name: "compass", library: "Ionicons" },
  { name: "camera", library: "Ionicons" },
  { name: "sunny", library: "Ionicons" },
  { name: "umbrella", library: "Ionicons" },
];

/**
 * Curated icons for miscellaneous categories
 */
export const MISC_ICONS: IconOption[] = [
  { name: "ellipsis-horizontal", library: "Ionicons" },
  { name: "help-circle", library: "Ionicons" },
  { name: "settings", library: "Ionicons" },
  { name: "construct", library: "Ionicons" },
  { name: "brush", library: "Ionicons" },
  { name: "cut", library: "Ionicons" },
  { name: "trash", library: "Ionicons" },
  { name: "save", library: "Ionicons" },
  { name: "share", library: "Ionicons" },
  { name: "people", library: "Ionicons" },
  { name: "person", library: "Ionicons" },
  { name: "paw", library: "Ionicons" },
  { name: "happy", library: "Ionicons" },
  { name: "sparkles", library: "Ionicons" },
  { name: "star", library: "Ionicons" },
  { name: "flag", library: "Ionicons" },
];

/**
 * All curated icons grouped by category
 */
export const ICON_GROUPS = {
  "Food & Dining": FOOD_ICONS,
  Transport: TRANSPORT_ICONS,
  Shopping: SHOPPING_ICONS,
  "Health & Wellness": HEALTH_ICONS,
  "Home & Utilities": HOME_ICONS,
  Entertainment: ENTERTAINMENT_ICONS,
  "Work & Finance": FINANCE_ICONS,
  Education: EDUCATION_ICONS,
  Travel: TRAVEL_ICONS,
  Miscellaneous: MISC_ICONS,
} as const;

/**
 * Flat list of all curated icons for search
 */
export const ALL_ICONS: IconOption[] = [
  ...FOOD_ICONS,
  ...TRANSPORT_ICONS,
  ...SHOPPING_ICONS,
  ...HEALTH_ICONS,
  ...HOME_ICONS,
  ...ENTERTAINMENT_ICONS,
  ...FINANCE_ICONS,
  ...EDUCATION_ICONS,
  ...TRAVEL_ICONS,
  ...MISC_ICONS,
];
