import { Category, database, TransactionType } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

interface UseCategoryChildrenResult {
  /** Child categories of the given parent */
  readonly children: Category[];
  /** Whether the query is still loading */
  readonly isLoading: boolean;
  /** Error if the query failed */
  readonly error: Error | null;
}

/**
 * Fetches child categories for a given parentId from WatermelonDB.
 * Returns an empty array when parentId is null.
 * Subscribes reactively — list updates automatically if categories change.
 */
export function useCategoryChildren(
  parentId: string | null,
  type?: TransactionType
): UseCategoryChildrenResult {
  const [children, setChildren] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!parentId) {
      setChildren([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const categoriesCollection = database.get<Category>("categories");

    const conditions = [
      Q.where("parent_id", parentId),
      Q.where("deleted", false),
      Q.where("is_internal", false),
      Q.where("is_hidden", false),
    ];

    if (type) {
      conditions.push(Q.where("type", type));
    }

    const query = categoriesCollection.query(
      Q.and(...conditions),
      Q.sortBy("sort_order", "asc")
    );

    const subscription = query.observe().subscribe({
      next: (result) => {
        setChildren(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        console.error("Error observing category children:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [parentId, type]);

  return { children, isLoading, error };
}
