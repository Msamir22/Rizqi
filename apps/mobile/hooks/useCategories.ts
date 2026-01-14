import { useState, useEffect } from "react";
import { database, Category, TransactionType } from "@astik/db";
import { Q } from "@nozbe/watermelondb";

interface UseCategoriesResult {
  categories: Category[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  isLoading: boolean;
  error: Error | null;
  getCategoryById: (id: string) => Category | undefined;
  refetch: () => void;
}

interface UseCategoriesOptions {
  topLevelOnly?: boolean;
  type?: TransactionType;
  includeHidden?: boolean;
}

/**
 * Hook to get categories reactively from WatermelonDB
 */
export function useCategories(
  options: UseCategoriesOptions = {}
): UseCategoriesResult {
  const { topLevelOnly = true, type, includeHidden = false } = options;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const categoriesCollection = database.get<Category>("categories");

    const conditions = [
      Q.where("deleted", false),
      Q.where("is_internal", false),
    ];

    if (topLevelOnly) {
      conditions.push(Q.where("level", 1));
    }

    if (type) {
      conditions.push(Q.where("type", type));
    }

    if (!includeHidden) {
      conditions.push(Q.where("is_hidden", false));
    }

    const query = categoriesCollection.query(
      Q.and(...conditions),
      Q.sortBy("sort_order", "asc")
    );

    const subscription = query.observe().subscribe({
      next: (result) => {
        setCategories(result);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("Error observing categories:", err);
        setError(err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [topLevelOnly, type, includeHidden, refreshKey]);

  // Filter expense and income categories
  const expenseCategories = categories.filter((c) => c.isExpense);
  const incomeCategories = categories.filter((c) => c.isIncome);

  // Lookup function
  const getCategoryById = (id: string): Category | undefined => {
    return categories.find((c) => c.id === id);
  };

  return {
    categories,
    expenseCategories,
    incomeCategories,
    isLoading,
    error,
    getCategoryById,
    refetch,
  };
}

/**
 * Hook to get a single category by ID or systemName
 */
export function useCategory(categoryId: string | null): {
  category: Category | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!categoryId) {
      setCategory(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const categoriesCollection = database.get<Category>("categories");

    const query = categoriesCollection.findAndObserve(categoryId);

    const subscription = query.subscribe({
      next: (result) => {
        setCategory(result);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("Error observing category:", err);
        setError(err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [categoryId]);

  return { category, isLoading, error };
}
