import type { Category } from "@astik/db";
import { useCallback, useRef, useState } from "react";

/**
 * Represents one level in the drill-down navigation stack.
 * `category` is null at the root (L1) level.
 */
export interface NavigationLevel {
  readonly category: Category | null;
  readonly label: string;
}

/** Direction of the most recent navigation transition */
export type NavigationDirection = "forward" | "backward";

interface UseCategoryNavigationResult {
  /** Full navigation stack (breadcrumb trail) */
  readonly stack: readonly NavigationLevel[];
  /** The deepest (current) level in the stack */
  readonly currentLevel: NavigationLevel;
  /** Current depth: 0 = root, 1 = L2, 2 = L3 */
  readonly depth: number;
  /** Search query for the current level */
  readonly searchQuery: string;
  /** Direction of the last navigation action (for animation) */
  readonly direction: NavigationDirection;
  /** Drill into a category's children */
  drillInto: (category: Category) => void;
  /** Go back one level */
  goBack: () => void;
  /** Jump to a specific level index in the stack (breadcrumb tap) */
  jumpToLevel: (index: number) => void;
  /** Reset to root — call when modal closes */
  reset: () => void;
  /** Update the search query */
  setSearchQuery: (query: string) => void;
}

const ROOT_LABEL = "All Categories";
const ROOT_LEVEL: NavigationLevel = { category: null, label: ROOT_LABEL };

/**
 * State machine for category drill-down navigation.
 *
 * Manages the breadcrumb stack, current depth, search query,
 * and navigation direction (for slide animations).
 *
 * @example
 * ```tsx
 * const nav = useCategoryNavigation();
 * // nav.depth === 0 → root
 * nav.drillInto(foodCategory);
 * // nav.depth === 1, nav.currentLevel.label === "Food & Drinks"
 * nav.goBack();
 * // nav.depth === 0 → root again
 * ```
 */
export function useCategoryNavigation(): UseCategoryNavigationResult {
  // Use ref + state combo to avoid stale closure issues
  // The ref holds the source of truth; the state triggers re-renders
  const stackRef = useRef<NavigationLevel[]>([ROOT_LEVEL]);
  const [stack, setStack] = useState<readonly NavigationLevel[]>([ROOT_LEVEL]);
  const [searchQuery, setSearchQueryState] = useState("");
  const [direction, setDirection] = useState<NavigationDirection>("forward");

  const updateStack = useCallback((newStack: NavigationLevel[]): void => {
    stackRef.current = newStack;
    setStack([...newStack]);
  }, []);

  const drillInto = useCallback(
    (category: Category): void => {
      const nextLevel: NavigationLevel = {
        category,
        label: category.displayName,
      };
      const newStack = [...stackRef.current, nextLevel];
      setDirection("forward");
      setSearchQueryState("");
      updateStack(newStack);
    },
    [updateStack]
  );

  const goBack = useCallback((): void => {
    if (stackRef.current.length <= 1) return;
    const newStack = stackRef.current.slice(0, -1);
    setDirection("backward");
    setSearchQueryState("");
    updateStack(newStack);
  }, [updateStack]);

  const jumpToLevel = useCallback(
    (index: number): void => {
      if (index < 0 || index >= stackRef.current.length) return;
      const newStack = stackRef.current.slice(0, index + 1);
      setDirection("backward");
      setSearchQueryState("");
      updateStack(newStack);
    },
    [updateStack]
  );

  const reset = useCallback((): void => {
    setDirection("forward");
    setSearchQueryState("");
    updateStack([ROOT_LEVEL]);
  }, [updateStack]);

  const setSearchQuery = useCallback((query: string): void => {
    setSearchQueryState(query);
  }, []);

  const currentLevel = stack[stack.length - 1];
  const depth = stack.length - 1;

  return {
    stack,
    currentLevel,
    depth,
    searchQuery,
    direction,
    drillInto,
    goBack,
    jumpToLevel,
    reset,
    setSearchQuery,
  };
}
