/**
 * Seed System Categories
 * Seeds predefined system categories into WatermelonDB on first launch
 */

import { database, Category } from "@astik/db";

interface CategorySeed {
  systemName: string;
  displayName: string;
  icon: string;
  color: string;
  level: number;
  type: "EXPENSE" | "INCOME";
  sortOrder: number;
  parentSystemName?: string;
}

// System categories to seed
const SYSTEM_CATEGORIES: CategorySeed[] = [
  // ========== EXPENSE CATEGORIES (Level 1) ==========
  {
    systemName: "food",
    displayName: "Food & Dining",
    icon: "fast-food",
    color: "#F59E0B",
    level: 1,
    type: "EXPENSE",
    sortOrder: 1,
  },
  {
    systemName: "transport",
    displayName: "Transport",
    icon: "car",
    color: "#3B82F6",
    level: 1,
    type: "EXPENSE",
    sortOrder: 2,
  },
  {
    systemName: "shopping",
    displayName: "Shopping",
    icon: "cart",
    color: "#EC4899",
    level: 1,
    type: "EXPENSE",
    sortOrder: 3,
  },
  {
    systemName: "utilities",
    displayName: "Utilities",
    icon: "flash",
    color: "#8B5CF6",
    level: 1,
    type: "EXPENSE",
    sortOrder: 4,
  },
  {
    systemName: "entertainment",
    displayName: "Entertainment",
    icon: "game-controller",
    color: "#14B8A6",
    level: 1,
    type: "EXPENSE",
    sortOrder: 5,
  },
  {
    systemName: "health",
    displayName: "Health",
    icon: "medkit",
    color: "#EF4444",
    level: 1,
    type: "EXPENSE",
    sortOrder: 6,
  },
  {
    systemName: "education",
    displayName: "Education",
    icon: "school",
    color: "#F97316",
    level: 1,
    type: "EXPENSE",
    sortOrder: 7,
  },
  {
    systemName: "housing",
    displayName: "Housing",
    icon: "home",
    color: "#6366F1",
    level: 1,
    type: "EXPENSE",
    sortOrder: 8,
  },
  {
    systemName: "personal_care",
    displayName: "Personal Care",
    icon: "person",
    color: "#F472B6",
    level: 1,
    type: "EXPENSE",
    sortOrder: 9,
  },
  {
    systemName: "subscriptions",
    displayName: "Subscriptions",
    icon: "card",
    color: "#0EA5E9",
    level: 1,
    type: "EXPENSE",
    sortOrder: 10,
  },
  {
    systemName: "gifts",
    displayName: "Gifts",
    icon: "gift",
    color: "#A855F7",
    level: 1,
    type: "EXPENSE",
    sortOrder: 11,
  },
  {
    systemName: "travel",
    displayName: "Travel",
    icon: "airplane",
    color: "#06B6D4",
    level: 1,
    type: "EXPENSE",
    sortOrder: 12,
  },
  {
    systemName: "other_expense",
    displayName: "Other",
    icon: "ellipsis-horizontal",
    color: "#9CA3AF",
    level: 1,
    type: "EXPENSE",
    sortOrder: 99,
  },

  // ========== INCOME CATEGORIES (Level 1) ==========
  {
    systemName: "salary",
    displayName: "Salary",
    icon: "wallet",
    color: "#10B981",
    level: 1,
    type: "INCOME",
    sortOrder: 1,
  },
  {
    systemName: "freelance",
    displayName: "Freelance",
    icon: "briefcase",
    color: "#22C55E",
    level: 1,
    type: "INCOME",
    sortOrder: 2,
  },
  {
    systemName: "investments",
    displayName: "Investments",
    icon: "trending-up",
    color: "#059669",
    level: 1,
    type: "INCOME",
    sortOrder: 3,
  },
  {
    systemName: "rental_income",
    displayName: "Rental Income",
    icon: "home",
    color: "#0D9488",
    level: 1,
    type: "INCOME",
    sortOrder: 4,
  },
  {
    systemName: "business_income",
    displayName: "Business",
    icon: "business",
    color: "#14B8A6",
    level: 1,
    type: "INCOME",
    sortOrder: 5,
  },
  {
    systemName: "other_income",
    displayName: "Other Income",
    icon: "cash",
    color: "#34D399",
    level: 1,
    type: "INCOME",
    sortOrder: 99,
  },

  // ========== INTERNAL CATEGORIES (hidden from user) ==========
  {
    systemName: "transfer",
    displayName: "Transfer",
    icon: "swap-horizontal",
    color: "#6B7280",
    level: 1,
    type: "EXPENSE",
    sortOrder: 100,
  },
  {
    systemName: "debt_payment",
    displayName: "Debt Payment",
    icon: "receipt",
    color: "#6B7280",
    level: 1,
    type: "EXPENSE",
    sortOrder: 101,
  },
  {
    systemName: "debt_received",
    displayName: "Debt Received",
    icon: "receipt",
    color: "#6B7280",
    level: 1,
    type: "INCOME",
    sortOrder: 101,
  },
];

// Internal category names (hidden from user selection)
const INTERNAL_CATEGORIES = ["transfer", "debt_payment", "debt_received"];

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

    for (const seed of SYSTEM_CATEGORIES) {
      await categoriesCollection.create((category) => {
        category.systemName = seed.systemName;
        category.displayName = seed.displayName;
        category.icon = seed.icon;
        category.color = seed.color;
        category.level = seed.level;
        category.type = seed.type;
        category.sortOrder = seed.sortOrder;
        category.isSystem = true;
        category.isHidden = false;
        category.isInternal = INTERNAL_CATEGORIES.includes(seed.systemName);
        category.deleted = false;
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

    // Seed fresh
    for (const seed of SYSTEM_CATEGORIES) {
      await categoriesCollection.create((category) => {
        category.systemName = seed.systemName;
        category.displayName = seed.displayName;
        category.icon = seed.icon;
        category.color = seed.color;
        category.level = seed.level;
        category.type = seed.type;
        category.sortOrder = seed.sortOrder;
        category.isSystem = true;
        category.isHidden = false;
        category.isInternal = INTERNAL_CATEGORIES.includes(seed.systemName);
        category.deleted = false;
      });
    }
  });

  console.log(`Reseeded ${SYSTEM_CATEGORIES.length} categories`);
}
