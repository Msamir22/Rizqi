/**
 * Unit tests for ai-parser-utils
 *
 * Tests all shared AI parser utility functions:
 * - normalizeType
 * - parseAiDate
 * - clampConfidence
 * - parseCategory
 * - buildCategoryMap
 */

import {
  normalizeType,
  parseAiDate,
  clampConfidence,
  parseCategory,
  buildCategoryMap,
  VALID_TYPES,
  DATE_ONLY_REGEX,
  type CategoryMap,
} from "../ai-parser-utils";
import type { Category } from "@astik/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockCategory(overrides: Partial<Category> = {}): Category {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    id: "cat-1",
    systemName: "food_and_drinks",
    displayName: "Food & Drinks",
    parentId: undefined,
    icon: "utensils",
    color: "#FF5733",
    sortOrder: 1,
    isSystem: true,
    ...overrides,
  } as Category;
}

function buildTestCategoryMap(): CategoryMap {
  const categories: Category[] = [
    makeMockCategory({
      id: "cat-food",
      systemName: "food_and_drinks",
      displayName: "Food & Drinks",
    }),
    makeMockCategory({
      id: "cat-transport",
      systemName: "transportation",
      displayName: "Transportation",
    }),
    makeMockCategory({
      id: "cat-other",
      systemName: "other",
      displayName: "Other",
    }),
  ];
  return buildCategoryMap(categories);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ai-parser-utils", () => {
  // =========================================================================
  // VALID_TYPES constant
  // =========================================================================
  describe("VALID_TYPES", () => {
    it("should contain EXPENSE and INCOME", () => {
      expect(VALID_TYPES.has("EXPENSE")).toBe(true);
      expect(VALID_TYPES.has("INCOME")).toBe(true);
    });

    it("should not contain TRANSFER or other types", () => {
      expect(VALID_TYPES.has("TRANSFER")).toBe(false);
      expect(VALID_TYPES.has("DEBIT")).toBe(false);
    });
  });

  // =========================================================================
  // DATE_ONLY_REGEX
  // =========================================================================
  describe("DATE_ONLY_REGEX", () => {
    it("should match YYYY-MM-DD format", () => {
      expect(DATE_ONLY_REGEX.test("2026-03-15")).toBe(true);
      expect(DATE_ONLY_REGEX.test("2024-01-01")).toBe(true);
    });

    it("should not match full ISO datetime", () => {
      expect(DATE_ONLY_REGEX.test("2026-03-15T10:30:00Z")).toBe(false);
    });

    it("should not match invalid formats", () => {
      expect(DATE_ONLY_REGEX.test("03-15-2026")).toBe(false);
      expect(DATE_ONLY_REGEX.test("not-a-date")).toBe(false);
    });
  });

  // =========================================================================
  // normalizeType
  // =========================================================================
  describe("normalizeType", () => {
    it("should return EXPENSE for 'EXPENSE'", () => {
      expect(normalizeType("EXPENSE")).toBe("EXPENSE");
    });

    it("should return INCOME for 'INCOME'", () => {
      expect(normalizeType("INCOME")).toBe("INCOME");
    });

    it("should normalize lowercase 'expense' to EXPENSE", () => {
      expect(normalizeType("expense")).toBe("EXPENSE");
    });

    it("should normalize lowercase 'income' to INCOME", () => {
      expect(normalizeType("income")).toBe("INCOME");
    });

    it("should normalize mixed case 'Income' to INCOME", () => {
      expect(normalizeType("Income")).toBe("INCOME");
    });

    it("should default unknown types to EXPENSE", () => {
      expect(normalizeType("DEBIT")).toBe("EXPENSE");
      expect(normalizeType("CREDIT")).toBe("EXPENSE");
      expect(normalizeType("TRANSFER")).toBe("EXPENSE");
      expect(normalizeType("")).toBe("EXPENSE");
    });
  });

  // =========================================================================
  // parseAiDate
  // =========================================================================
  describe("parseAiDate", () => {
    it("should parse valid YYYY-MM-DD as local date", () => {
      const result = parseAiDate("2026-03-15");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it("should parse full ISO datetime string", () => {
      const result = parseAiDate("2026-03-15T10:30:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
    });

    it("should fall back to current date for empty string", () => {
      const before = Date.now();
      const result = parseAiDate("");
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("should fall back to current date for whitespace-only string", () => {
      const before = Date.now();
      const result = parseAiDate("   ");
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("should fall back to current date for invalid date string", () => {
      const before = Date.now();
      const result = parseAiDate("not-a-date");
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("should handle date-only with leading/trailing whitespace", () => {
      const result = parseAiDate("  2026-01-01  ");
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });
  });

  // =========================================================================
  // clampConfidence
  // =========================================================================
  describe("clampConfidence", () => {
    it("should return value within [0,1] range unchanged", () => {
      expect(clampConfidence(0.5)).toBe(0.5);
      expect(clampConfidence(0)).toBe(0);
      expect(clampConfidence(1)).toBe(1);
    });

    it("should clamp values above 1 to 1", () => {
      expect(clampConfidence(1.5)).toBe(1);
      expect(clampConfidence(100)).toBe(1);
    });

    it("should clamp values below 0 to 0", () => {
      expect(clampConfidence(-0.5)).toBe(0);
      expect(clampConfidence(-100)).toBe(0);
    });

    it("should handle edge decimal values", () => {
      expect(clampConfidence(0.001)).toBe(0.001);
      expect(clampConfidence(0.999)).toBe(0.999);
    });
  });

  // =========================================================================
  // buildCategoryMap
  // =========================================================================
  describe("buildCategoryMap", () => {
    it("should build a map from Category array", () => {
      const categories: Category[] = [
        makeMockCategory({
          id: "cat-1",
          systemName: "food",
          displayName: "Food",
        }),
        makeMockCategory({
          id: "cat-2",
          systemName: "transport",
          displayName: "Transport",
        }),
      ];
      const map = buildCategoryMap(categories);

      expect(map.size).toBe(2);
      expect(map.get("food")).toEqual({ name: "Food", id: "cat-1" });
      expect(map.get("transport")).toEqual({ name: "Transport", id: "cat-2" });
    });

    it("should return empty map for empty array", () => {
      const map = buildCategoryMap([]);
      expect(map.size).toBe(0);
    });
  });

  // =========================================================================
  // parseCategory
  // =========================================================================
  describe("parseCategory", () => {
    let categoryMap: CategoryMap;

    beforeEach(() => {
      categoryMap = buildTestCategoryMap();
    });

    it("should return direct match for known category", () => {
      const result = parseCategory("food_and_drinks", categoryMap);
      expect(result).toEqual({
        id: "cat-food",
        displayName: "Food & Drinks",
      });
    });

    it("should return direct match for another known category", () => {
      const result = parseCategory("transportation", categoryMap);
      expect(result).toEqual({
        id: "cat-transport",
        displayName: "Transportation",
      });
    });

    it("should fall back to 'other' for unknown category", () => {
      const result = parseCategory("unknown_category", categoryMap);
      expect(result).toEqual({
        id: "cat-other",
        displayName: "Other",
      });
    });

    it("should fall back to 'other' for empty string", () => {
      const result = parseCategory("", categoryMap);
      expect(result).toEqual({
        id: "cat-other",
        displayName: "Other",
      });
    });

    it("should return null when neither category nor 'other' exist", () => {
      const emptyMap: CategoryMap = new Map();
      const result = parseCategory("food", emptyMap);
      expect(result).toBeNull();
    });

    it("should return null for unknown category when no 'other' fallback exists", () => {
      const mapWithoutOther: CategoryMap = new Map([
        ["food", { name: "Food", id: "cat-1" }],
      ]);
      const result = parseCategory("unknown", mapWithoutOther);
      expect(result).toBeNull();
    });
  });
});
