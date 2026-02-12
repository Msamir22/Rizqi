import { database, type Category } from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Given a list of categories, determines which ones actually have children
 * in the database. Returns a `Set<string>` of category IDs that are parents.
 *
 * Uses a single optimized query: finds all categories whose `parent_id`
 * matches one of the provided IDs, then extracts the distinct parent IDs.
 */
export function useCategoriesWithChildren(categories: Category[]): Set<string> {
  const [parentIds, setParentIds] = useState<Set<string>>(new Set());

  // Stabilize the dependency: only re-run when the actual IDs change,
  // not when the array reference changes.
  const idsKey = useMemo(
    () =>
      categories
        .map((c) => c.id)
        .sort()
        .join(","),
    [categories]
  );

  // Keep sorted IDs in a ref so the effect can read them without
  // depending on the categories array reference.
  const categoryIdsRef = useRef<string[]>([]);
  categoryIdsRef.current = useMemo(
    () => categories.map((c) => c.id),
    [categories]
  );

  useEffect(() => {
    const ids = categoryIdsRef.current;

    if (ids.length === 0) {
      setParentIds(new Set());
      return;
    }

    const categoriesCollection = database.get<Category>("categories");

    const query = categoriesCollection.query(
      Q.where("parent_id", Q.oneOf(ids)),
      Q.where("deleted", false),
      Q.where("is_internal", false),
      Q.where("is_hidden", false)
    );

    const subscription = query.observe().subscribe({
      next: (children) => {
        const result = new Set<string>();
        for (const child of children) {
          if (child.parentId) {
            result.add(child.parentId);
          }
        }
        setParentIds(result);
      },
      error: (err: unknown) => {
        console.error("Error checking category children:", err);
        setParentIds(new Set());
      },
    });

    return () => subscription.unsubscribe();
  }, [idsKey]);

  return parentIds;
}
