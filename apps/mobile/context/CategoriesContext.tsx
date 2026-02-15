/**
 * CategoriesContext — Global category data provider.
 *
 * Loads ALL non-deleted categories via a single WatermelonDB observation
 * and exposes them as a Map<string, Category> for O(1) lookups.
 * Any category update (add, rename, reorder) propagates automatically.
 */

import { Category, database } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoriesContextValue {
  /** Full array of all non-deleted categories, sorted by sort_order. */
  readonly categories: readonly Category[];
  /** O(1) lookup map: category ID → Category model. */
  readonly categoryMap: ReadonlyMap<string, Category>;
  /** True while the initial observation result hasn't arrived yet. */
  readonly isLoading: boolean;
}

interface CategoriesProviderProps {
  readonly children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CategoriesProvider({
  children,
}: CategoriesProviderProps): React.JSX.Element {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = database
      .get<Category>("categories")
      .query(Q.where("deleted", false), Q.sortBy("sort_order", Q.asc))
      .observe()
      .subscribe({
        next: (result) => {
          setCategories(result);
          setIsLoading(false);
        },
        error: (err) => {
          console.error("CategoriesProvider: observation error", err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const value = useMemo<CategoriesContextValue>(
    () => ({ categories, categoryMap, isLoading }),
    [categories, categoryMap, isLoading]
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns a Map<string, Category> for O(1) lookups by category ID.
 *
 * @example
 * const categoryMap = useCategoryLookup();
 * const cat = categoryMap.get(transaction.categoryId);
 */
export function useCategoryLookup(): ReadonlyMap<string, Category> {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error(
      "useCategoryLookup must be used within a CategoriesProvider"
    );
  }
  return context.categoryMap;
}

/**
 * Returns the full categories array (all non-deleted, sorted by sort_order).
 * Use this when you need list iteration, not individual lookups.
 */
export function useAllCategories(): {
  readonly categories: readonly Category[];
  readonly isLoading: boolean;
} {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error(
      "useAllCategories must be used within a CategoriesProvider"
    );
  }
  return { categories: context.categories, isLoading: context.isLoading };
}
