/**
 * Seed System Categories
 * Seeds predefined system categories into WatermelonDB on first launch
 * Matches the categories defined in Supabase migration 002_complete_schema.sql
 */

import { database, Category } from "@astik/db";

type CategoryNature = "WANT" | "NEED" | "MUST" | undefined;

interface CategorySeed {
  systemName: string;
  displayName: string;
  icon: string;
  color: string;
  level: number;
  nature: CategoryNature;
  type: "EXPENSE" | "INCOME" | undefined;
  sortOrder: number;
  parentSystemName?: string;
  isInternal?: boolean;
}

// System categories to seed - matches Supabase schema
const SYSTEM_CATEGORIES: CategorySeed[] = [
  // ==========================================================================
  // LEVEL 1: EXPENSE CATEGORIES
  // ==========================================================================
  {
    systemName: "food_drinks",
    displayName: "Food & Drinks",
    icon: "fast-food",
    color: "#F59E0B",
    level: 1,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 1,
  },
  {
    systemName: "transportation",
    displayName: "Transportation",
    icon: "car",
    color: "#3B82F6",
    level: 1,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 2,
  },
  {
    systemName: "vehicle",
    displayName: "Vehicle",
    icon: "car-sport",
    color: "#8B5CF6",
    level: 1,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
  },
  {
    systemName: "shopping",
    displayName: "Shopping",
    icon: "cart",
    color: "#EC4899",
    level: 1,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 4,
  },
  {
    systemName: "health_medical",
    displayName: "Health & Medical",
    icon: "medkit",
    color: "#EF4444",
    level: 1,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 5,
  },
  {
    systemName: "utilities_bills",
    displayName: "Utilities & Bills",
    icon: "flash",
    color: "#6366F1",
    level: 1,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 6,
  },
  {
    systemName: "entertainment",
    displayName: "Entertainment",
    icon: "game-controller",
    color: "#14B8A6",
    level: 1,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 7,
  },
  {
    systemName: "charity",
    displayName: "Charity",
    icon: "heart",
    color: "#F472B6",
    level: 1,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 8,
  },
  {
    systemName: "education",
    displayName: "Education",
    icon: "school",
    color: "#F97316",
    level: 1,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 9,
  },
  {
    systemName: "housing",
    displayName: "Housing",
    icon: "home",
    color: "#A855F7",
    level: 1,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 10,
  },
  {
    systemName: "travel",
    displayName: "Travel",
    icon: "airplane",
    color: "#06B6D4",
    level: 1,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 11,
  },

  // ==========================================================================
  // LEVEL 1: INCOME CATEGORY
  // ==========================================================================
  {
    systemName: "income",
    displayName: "Salary / Income",
    icon: "wallet",
    color: "#10B981",
    level: 1,
    nature: undefined,
    type: "INCOME",
    sortOrder: 12,
  },

  // ==========================================================================
  // LEVEL 1: MIXED CATEGORIES (DEBT/LOANS)
  // ==========================================================================
  {
    systemName: "debt_loans",
    displayName: "Debt / Loans",
    icon: "swap-horizontal",
    color: "#6B7280",
    level: 1,
    nature: undefined,
    type: undefined,
    sortOrder: 13,
  },

  // ==========================================================================
  // LEVEL 1: FALLBACK CATEGORY
  // ==========================================================================
  {
    systemName: "other",
    displayName: "Other",
    icon: "ellipsis-horizontal",
    color: "#9CA3AF",
    level: 1,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
  },

  // ==========================================================================
  // LEVEL 1: INTERNAL CATEGORIES (hidden from user selection)
  // ==========================================================================
  {
    systemName: "asset_purchase",
    displayName: "Asset Purchase",
    icon: "cube",
    color: "#374151",
    level: 1,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 100,
    isInternal: true,
  },
  {
    systemName: "asset_sale",
    displayName: "Asset Sale",
    icon: "cash",
    color: "#374151",
    level: 1,
    nature: undefined,
    type: "INCOME",
    sortOrder: 101,
    isInternal: true,
  },

  // ==========================================================================
  // LEVEL 2: FOOD & DRINKS SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "groceries",
    displayName: "Groceries",
    icon: "basket",
    color: "#FCD34D",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "food_drinks",
  },
  {
    systemName: "restaurant",
    displayName: "Restaurant",
    icon: "restaurant",
    color: "#FBBF24",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "food_drinks",
  },
  {
    systemName: "coffee_tea",
    displayName: "Coffee & Tea",
    icon: "cafe",
    color: "#B45309",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "food_drinks",
  },
  {
    systemName: "snacks",
    displayName: "Snacks",
    icon: "pizza",
    color: "#D97706",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 4,
    parentSystemName: "food_drinks",
  },
  {
    systemName: "drinks",
    displayName: "Drinks",
    icon: "beer",
    color: "#F59E0B",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 5,
    parentSystemName: "food_drinks",
  },
  {
    systemName: "food_other",
    displayName: "Other",
    icon: "fast-food",
    color: "#92400E",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "food_drinks",
  },

  // ==========================================================================
  // LEVEL 2: TRANSPORTATION SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "public_transport",
    displayName: "Public Transport",
    icon: "bus",
    color: "#60A5FA",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "transportation",
  },
  {
    systemName: "private_transport",
    displayName: "Private Transport",
    icon: "car",
    color: "#3B82F6",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "transportation",
  },
  {
    systemName: "transport_other",
    displayName: "Other",
    icon: "walk",
    color: "#1D4ED8",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "transportation",
  },

  // ==========================================================================
  // LEVEL 2: VEHICLE SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "fuel",
    displayName: "Fuel",
    icon: "flame",
    color: "#A78BFA",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "vehicle",
  },
  {
    systemName: "parking",
    displayName: "Parking",
    icon: "location",
    color: "#8B5CF6",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "vehicle",
  },
  {
    systemName: "rental",
    displayName: "Rental",
    icon: "key",
    color: "#7C3AED",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "vehicle",
  },
  {
    systemName: "license_fees",
    displayName: "License Fees",
    icon: "document-text",
    color: "#6D28D9",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 4,
    parentSystemName: "vehicle",
  },
  {
    systemName: "vehicle_tax",
    displayName: "Tax",
    icon: "receipt",
    color: "#5B21B6",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 5,
    parentSystemName: "vehicle",
  },
  {
    systemName: "traffic_fine",
    displayName: "Traffic Fine",
    icon: "warning",
    color: "#4C1D95",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 6,
    parentSystemName: "vehicle",
  },
  {
    systemName: "vehicle_buy",
    displayName: "Buy",
    icon: "car-sport",
    color: "#C4B5FD",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 7,
    parentSystemName: "vehicle",
  },
  {
    systemName: "vehicle_sell",
    displayName: "Sell",
    icon: "cash",
    color: "#DDD6FE",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 8,
    parentSystemName: "vehicle",
  },
  {
    systemName: "vehicle_maintenance",
    displayName: "Maintenance",
    icon: "construct",
    color: "#9333EA",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 9,
    parentSystemName: "vehicle",
  },
  {
    systemName: "vehicle_other",
    displayName: "Other",
    icon: "car",
    color: "#581C87",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "vehicle",
  },

  // ==========================================================================
  // LEVEL 2: SHOPPING SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "clothes",
    displayName: "Clothes",
    icon: "shirt",
    color: "#F472B6",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "shopping",
  },
  {
    systemName: "electronics_appliances",
    displayName: "Electronics & Appliances",
    icon: "phone-portrait",
    color: "#EC4899",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "shopping",
  },
  {
    systemName: "accessories",
    displayName: "Accessories",
    icon: "watch",
    color: "#DB2777",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "shopping",
  },
  {
    systemName: "footwear",
    displayName: "Footwear",
    icon: "footsteps",
    color: "#BE185D",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 4,
    parentSystemName: "shopping",
  },
  {
    systemName: "bags",
    displayName: "Bags",
    icon: "briefcase",
    color: "#9D174D",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 5,
    parentSystemName: "shopping",
  },
  {
    systemName: "kids_baby",
    displayName: "Kids & Baby",
    icon: "happy",
    color: "#831843",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 6,
    parentSystemName: "shopping",
  },
  {
    systemName: "beauty",
    displayName: "Beauty",
    icon: "sparkles",
    color: "#FBCFE8",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 7,
    parentSystemName: "shopping",
  },
  {
    systemName: "home_garden",
    displayName: "Home & Garden",
    icon: "home",
    color: "#F9A8D4",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 8,
    parentSystemName: "shopping",
  },
  {
    systemName: "pets",
    displayName: "Pets",
    icon: "paw",
    color: "#F0ABFC",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 9,
    parentSystemName: "shopping",
  },
  {
    systemName: "sports_fitness",
    displayName: "Sports & Fitness",
    icon: "fitness",
    color: "#E879F9",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 10,
    parentSystemName: "shopping",
  },
  {
    systemName: "toys_games",
    displayName: "Toys & Games",
    icon: "game-controller",
    color: "#D946EF",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 11,
    parentSystemName: "shopping",
  },
  {
    systemName: "wedding",
    displayName: "Wedding",
    icon: "heart",
    color: "#C026D3",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 13,
    parentSystemName: "shopping",
  },
  {
    systemName: "detergents",
    displayName: "Detergents",
    icon: "water",
    color: "#A21CAF",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 14,
    parentSystemName: "shopping",
  },
  {
    systemName: "decorations",
    displayName: "Decorations",
    icon: "color-palette",
    color: "#86198F",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 15,
    parentSystemName: "shopping",
  },
  {
    systemName: "personal_care",
    displayName: "Personal Care",
    icon: "person",
    color: "#701A75",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 16,
    parentSystemName: "shopping",
  },
  {
    systemName: "shopping_other",
    displayName: "Other",
    icon: "bag",
    color: "#4A044E",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "shopping",
  },

  // ==========================================================================
  // LEVEL 2: HEALTH & MEDICAL SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "doctor",
    displayName: "Doctor",
    icon: "person",
    color: "#FCA5A5",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "health_medical",
  },
  {
    systemName: "medicine",
    displayName: "Medicine",
    icon: "medical",
    color: "#F87171",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "health_medical",
  },
  {
    systemName: "surgery",
    displayName: "Surgery",
    icon: "bandage",
    color: "#EF4444",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "health_medical",
  },
  {
    systemName: "dental",
    displayName: "Dental",
    icon: "happy",
    color: "#DC2626",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 4,
    parentSystemName: "health_medical",
  },
  {
    systemName: "health_other",
    displayName: "Other",
    icon: "medkit",
    color: "#B91C1C",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "health_medical",
  },

  // ==========================================================================
  // LEVEL 2: UTILITIES & BILLS SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "electricity",
    displayName: "Electricity",
    icon: "flash",
    color: "#818CF8",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "water",
    displayName: "Water",
    icon: "water",
    color: "#6366F1",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "internet",
    displayName: "Internet",
    icon: "wifi",
    color: "#4F46E5",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "phone",
    displayName: "Phone",
    icon: "call",
    color: "#4338CA",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 4,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "gas",
    displayName: "Gas",
    icon: "flame",
    color: "#3730A3",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 5,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "trash",
    displayName: "Trash",
    icon: "trash",
    color: "#312E81",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 6,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "online_subscription",
    displayName: "Online Subscription",
    icon: "globe",
    color: "#A5B4FC",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 7,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "streaming",
    displayName: "Streaming",
    icon: "tv",
    color: "#C7D2FE",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 8,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "taxes",
    displayName: "Taxes",
    icon: "document",
    color: "#E0E7FF",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 9,
    parentSystemName: "utilities_bills",
  },
  {
    systemName: "utilities_other",
    displayName: "Other",
    icon: "document-text",
    color: "#1E1B4B",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "utilities_bills",
  },

  // ==========================================================================
  // LEVEL 2: ENTERTAINMENT SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "trips_holidays",
    displayName: "Trips & Holidays",
    icon: "sunny",
    color: "#5EEAD4",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "entertainment",
  },
  {
    systemName: "events",
    displayName: "Events",
    icon: "calendar",
    color: "#2DD4BF",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "entertainment",
  },
  {
    systemName: "tickets",
    displayName: "Tickets",
    icon: "ticket",
    color: "#14B8A6",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "entertainment",
  },
  {
    systemName: "entertainment_other",
    displayName: "Other",
    icon: "happy",
    color: "#0D9488",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "entertainment",
  },

  // ==========================================================================
  // LEVEL 2: CHARITY SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "donations",
    displayName: "Donations",
    icon: "gift",
    color: "#FDA4AF",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "charity",
  },
  {
    systemName: "fundraising",
    displayName: "Fundraising",
    icon: "people",
    color: "#FB7185",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "charity",
  },
  {
    systemName: "charity_gifts",
    displayName: "Gifts",
    icon: "gift",
    color: "#F43F5E",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "charity",
  },
  {
    systemName: "charity_other",
    displayName: "Other",
    icon: "heart",
    color: "#E11D48",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "charity",
  },

  // ==========================================================================
  // LEVEL 2: EDUCATION SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "books",
    displayName: "Books",
    icon: "book",
    color: "#FDBA74",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "education",
  },
  {
    systemName: "tuition",
    displayName: "Tuition",
    icon: "school",
    color: "#FB923C",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "education",
  },
  {
    systemName: "education_fees",
    displayName: "Fees",
    icon: "card",
    color: "#F97316",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "education",
  },
  {
    systemName: "education_other",
    displayName: "Other",
    icon: "school",
    color: "#EA580C",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "education",
  },

  // ==========================================================================
  // LEVEL 2: HOUSING SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "rent",
    displayName: "Rent",
    icon: "home",
    color: "#C4B5FD",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "housing",
  },
  {
    systemName: "housing_maintenance",
    displayName: "Maintenance & Repairs",
    icon: "hammer",
    color: "#A78BFA",
    level: 2,
    nature: "NEED",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "housing",
  },
  {
    systemName: "housing_tax",
    displayName: "Tax",
    icon: "document",
    color: "#8B5CF6",
    level: 2,
    nature: "MUST",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "housing",
  },
  {
    systemName: "housing_buy",
    displayName: "Buy",
    icon: "business",
    color: "#7C3AED",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 4,
    parentSystemName: "housing",
  },
  {
    systemName: "housing_sell",
    displayName: "Sell",
    icon: "cash",
    color: "#6D28D9",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 5,
    parentSystemName: "housing",
  },
  {
    systemName: "housing_other",
    displayName: "Other",
    icon: "home",
    color: "#5B21B6",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "housing",
  },

  // ==========================================================================
  // LEVEL 2: TRAVEL SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "vacation",
    displayName: "Vacation",
    icon: "sunny",
    color: "#22D3EE",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "travel",
  },
  {
    systemName: "business_travel",
    displayName: "Business Travel",
    icon: "briefcase",
    color: "#06B6D4",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 2,
    parentSystemName: "travel",
  },
  {
    systemName: "holiday",
    displayName: "Holiday",
    icon: "gift",
    color: "#0891B2",
    level: 2,
    nature: "WANT",
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "travel",
  },
  {
    systemName: "travel_other",
    displayName: "Other",
    icon: "airplane",
    color: "#0E7490",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 99,
    parentSystemName: "travel",
  },

  // ==========================================================================
  // LEVEL 2: INCOME SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "salary",
    displayName: "Salary",
    icon: "wallet",
    color: "#10B981",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 1,
    parentSystemName: "income",
  },
  {
    systemName: "bonus",
    displayName: "Bonus",
    icon: "gift",
    color: "#059669",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 2,
    parentSystemName: "income",
  },
  {
    systemName: "commission",
    displayName: "Commission",
    icon: "cash",
    color: "#047857",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 3,
    parentSystemName: "income",
  },
  {
    systemName: "refund",
    displayName: "Refund",
    icon: "return-down-back",
    color: "#065F46",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 4,
    parentSystemName: "income",
  },
  {
    systemName: "loan_income",
    displayName: "Loan",
    icon: "cash",
    color: "#064E3B",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 5,
    parentSystemName: "income",
  },
  {
    systemName: "gift_income",
    displayName: "Gift",
    icon: "gift",
    color: "#22C55E",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 6,
    parentSystemName: "income",
  },
  {
    systemName: "check",
    displayName: "Check",
    icon: "document-text",
    color: "#16A34A",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 7,
    parentSystemName: "income",
  },
  {
    systemName: "rental_income",
    displayName: "Rental Income",
    icon: "home",
    color: "#15803D",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 8,
    parentSystemName: "income",
  },
  {
    systemName: "freelance",
    displayName: "Freelance",
    icon: "laptop",
    color: "#166534",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 9,
    parentSystemName: "income",
  },
  {
    systemName: "business_income",
    displayName: "Business Income",
    icon: "business",
    color: "#14532D",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 10,
    parentSystemName: "income",
  },
  {
    systemName: "income_other",
    displayName: "Other",
    icon: "wallet",
    color: "#34D399",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 99,
    parentSystemName: "income",
  },

  // ==========================================================================
  // LEVEL 2: DEBT / LOANS SUBCATEGORIES
  // ==========================================================================
  {
    systemName: "lent_money",
    displayName: "Lent Money",
    icon: "arrow-up",
    color: "#9CA3AF",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "debt_loans",
  },
  {
    systemName: "borrowed_money",
    displayName: "Borrowed Money",
    icon: "arrow-down",
    color: "#6B7280",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 2,
    parentSystemName: "debt_loans",
  },
  {
    systemName: "debt_repayment_paid",
    displayName: "Debt Repayment (Paid)",
    icon: "checkmark-done",
    color: "#4B5563",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 3,
    parentSystemName: "debt_loans",
  },
  {
    systemName: "debt_repayment_received",
    displayName: "Debt Repayment (Received)",
    icon: "checkmark-done",
    color: "#374151",
    level: 2,
    nature: undefined,
    type: "INCOME",
    sortOrder: 4,
    parentSystemName: "debt_loans",
  },
  {
    systemName: "debt_other",
    displayName: "Other",
    icon: "swap-horizontal",
    color: "#1F2937",
    level: 2,
    nature: undefined,
    type: undefined,
    sortOrder: 99,
    parentSystemName: "debt_loans",
  },

  // ==========================================================================
  // LEVEL 2: OTHER (FALLBACK) SUBCATEGORY
  // ==========================================================================
  {
    systemName: "uncategorized",
    displayName: "Other",
    icon: "help",
    color: "#D1D5DB",
    level: 2,
    nature: undefined,
    type: "EXPENSE",
    sortOrder: 1,
    parentSystemName: "other",
  },
];

// Internal category names (hidden from user selection)
const INTERNAL_CATEGORIES = ["asset_purchase", "asset_sale"];

/**
 * Check if categories have been seeded
 */
async function areCategoriesSeeded(): Promise<boolean> {
  const categoriesCollection = database.get<Category>("categories");
  const count = await categoriesCollection.query().fetchCount();
  return count > 0;
}

/**
 * Seed system categories into WatermelonDB
 * Only runs if categories table is empty
 */
export async function seedCategories(): Promise<void> {
  const alreadySeeded = await areCategoriesSeeded();
  if (alreadySeeded) {
    console.log("Categories already seeded, skipping...");
    return;
  }

  console.log("Seeding system categories...");

  await database.write(async () => {
    const categoriesCollection = database.get<Category>("categories");

    // First pass: Create L1 categories and build a map
    const l1Categories = SYSTEM_CATEGORIES.filter((c) => c.level === 1);
    const categoryIdMap: Record<string, string> = {};

    for (const seed of l1Categories) {
      const created = await categoriesCollection.create((category) => {
        category.systemName = seed.systemName;
        category.displayName = seed.displayName;
        category.icon = seed.icon;
        category.color = seed.color;
        category.level = seed.level;
        category.nature = seed.nature;
        category.type = seed.type;
        category.sortOrder = seed.sortOrder;
        category.isSystem = true;
        category.isHidden = false;
        category.isInternal =
          seed.isInternal ?? INTERNAL_CATEGORIES.includes(seed.systemName);
        category.deleted = false;
      });
      categoryIdMap[seed.systemName] = created.id;
    }

    // Second pass: Create L2 categories with parent references
    const l2Categories = SYSTEM_CATEGORIES.filter((c) => c.level === 2);

    for (const seed of l2Categories) {
      const parentId = seed.parentSystemName
        ? categoryIdMap[seed.parentSystemName]
        : undefined;

      await categoriesCollection.create((category) => {
        category.systemName = seed.systemName;
        category.displayName = seed.displayName;
        category.icon = seed.icon;
        category.color = seed.color;
        category.level = seed.level;
        category.nature = seed.nature;
        category.type = seed.type;
        category.sortOrder = seed.sortOrder;
        category.isSystem = true;
        category.isHidden = false;
        category.isInternal = false;
        category.deleted = false;
        if (parentId) {
          category.parentId = parentId;
        }
      });
    }
  });

  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories`);
}

/**
 * Force reseed categories (for development/testing)
 * Deletes all categories and reseeds
 */
export async function reseedCategories(): Promise<void> {
  console.log("Reseeding categories...");

  await database.write(async () => {
    const categoriesCollection = database.get<Category>("categories");
    const allCategories = await categoriesCollection.query().fetch();

    // Delete all existing categories
    for (const cat of allCategories) {
      await cat.destroyPermanently();
    }
  });

  // Reset seeding state by calling seedCategories with empty check bypassed
  await database.write(async () => {
    const categoriesCollection = database.get<Category>("categories");
    const categoryIdMap: Record<string, string> = {};

    // First pass: Create L1 categories
    const l1Categories = SYSTEM_CATEGORIES.filter((c) => c.level === 1);
    for (const seed of l1Categories) {
      const created = await categoriesCollection.create((category) => {
        category.systemName = seed.systemName;
        category.displayName = seed.displayName;
        category.icon = seed.icon;
        category.color = seed.color;
        category.level = seed.level;
        category.nature = seed.nature;
        category.type = seed.type;
        category.sortOrder = seed.sortOrder;
        category.isSystem = true;
        category.isHidden = false;
        category.isInternal =
          seed.isInternal ?? INTERNAL_CATEGORIES.includes(seed.systemName);
        category.deleted = false;
      });
      categoryIdMap[seed.systemName] = created.id;
    }

    // Second pass: Create L2 categories
    const l2Categories = SYSTEM_CATEGORIES.filter((c) => c.level === 2);
    for (const seed of l2Categories) {
      const parentId = seed.parentSystemName
        ? categoryIdMap[seed.parentSystemName]
        : undefined;

      await categoriesCollection.create((category) => {
        category.systemName = seed.systemName;
        category.displayName = seed.displayName;
        category.icon = seed.icon;
        category.color = seed.color;
        category.level = seed.level;
        category.nature = seed.nature;
        category.type = seed.type;
        category.sortOrder = seed.sortOrder;
        category.isSystem = true;
        category.isHidden = false;
        category.isInternal = false;
        category.deleted = false;
        if (parentId) {
          category.parentId = parentId;
        }
      });
    }
  });

  console.log(`Reseeded ${SYSTEM_CATEGORIES.length} categories`);
}
