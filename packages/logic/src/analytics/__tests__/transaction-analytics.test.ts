/**
 * Unit Tests: Transaction Analytics
 *
 * Covers calculateMonthlyTotals, aggregateByCategory,
 * generateMonthlyChartData, and calculateComparison.
 */

import type {
  TransactionType,
  TransactionSource,
  CurrencyType,
  Transaction,
  Category,
} from "@astik/db";
import {
  calculateMonthlyTotals,
  aggregateByCategory,
  generateMonthlyChartData,
  calculateComparison,
  getMonthBoundaries,
  calculatePeriodStats,
  getComparisonPeriods,
} from "../transaction-analytics";
import type { MonthlyTotals, ComparisonResult } from "../types";

// =============================================================================
// Test Helpers
// =============================================================================

interface MockTransactionInput {
  amount: number;
  type: TransactionType;
  categoryId?: string;
  dateInMs?: number;
}

function createMockTransaction(input: MockTransactionInput): Transaction {
  return {
    amount: input.amount,
    type: input.type,
    categoryId: input.categoryId ?? "cat-1",
    dateInMs: input.dateInMs ?? Date.now(),
    source: "MANUAL" as TransactionSource,
    currency: "EGP" as CurrencyType,
  } as unknown as Transaction;
}

interface MockCategoryInput {
  id: string;
  displayName: string;
  level?: number;
  parentId?: string;
  color?: string;
}

function createMockCategory(input: MockCategoryInput): Category {
  return {
    id: input.id,
    displayName: input.displayName,
    level: input.level ?? 0,
    parentId: input.parentId,
    color: input.color ?? "#FF0000",
  } as unknown as Category;
}

// =============================================================================
// calculateMonthlyTotals
// =============================================================================

describe("calculateMonthlyTotals", () => {
  it("calculates correct totals for mixed transactions", () => {
    const transactions = [
      createMockTransaction({ amount: 500, type: "EXPENSE" }),
      createMockTransaction({ amount: 200, type: "EXPENSE" }),
      createMockTransaction({ amount: 1000, type: "INCOME" }),
    ];

    const result: MonthlyTotals = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(700);
    expect(result.totalIncome).toBe(1000);
    expect(result.netChange).toBe(300);
  });

  it("returns zeros for an empty array", () => {
    const result = calculateMonthlyTotals([]);

    expect(result.totalExpenses).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.netChange).toBe(0);
  });

  it("handles only expenses (no income)", () => {
    const transactions = [
      createMockTransaction({ amount: 100, type: "EXPENSE" }),
      createMockTransaction({ amount: 250, type: "EXPENSE" }),
    ];

    const result = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(350);
    expect(result.totalIncome).toBe(0);
    expect(result.netChange).toBe(-350);
  });

  it("handles only income (no expenses)", () => {
    const transactions = [
      createMockTransaction({ amount: 3000, type: "INCOME" }),
    ];

    const result = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(0);
    expect(result.totalIncome).toBe(3000);
    expect(result.netChange).toBe(3000);
  });

  it("handles a single transaction", () => {
    const transactions = [
      createMockTransaction({ amount: 42, type: "EXPENSE" }),
    ];

    const result = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(42);
    expect(result.totalIncome).toBe(0);
    expect(result.netChange).toBe(-42);
  });

  it("handles zero-amount transactions", () => {
    const transactions = [
      createMockTransaction({ amount: 0, type: "EXPENSE" }),
      createMockTransaction({ amount: 0, type: "INCOME" }),
    ];

    const result = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.netChange).toBe(0);
  });

  it("handles fractional amounts without losing precision", () => {
    const transactions = [
      createMockTransaction({ amount: 10.5, type: "EXPENSE" }),
      createMockTransaction({ amount: 20.75, type: "INCOME" }),
    ];

    const result = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(10.5);
    expect(result.totalIncome).toBe(20.75);
    expect(result.netChange).toBe(10.25);
  });

  it("handles large numbers", () => {
    const transactions = [
      createMockTransaction({ amount: 1_000_000, type: "INCOME" }),
      createMockTransaction({ amount: 999_999, type: "EXPENSE" }),
    ];

    const result = calculateMonthlyTotals(transactions);

    expect(result.totalExpenses).toBe(999_999);
    expect(result.totalIncome).toBe(1_000_000);
    expect(result.netChange).toBe(1);
  });
});

// =============================================================================
// calculateComparison
// =============================================================================

describe("calculateComparison", () => {
  it("calculates correct comparison for normal values", () => {
    const result: ComparisonResult = calculateComparison(1500, 1000);

    expect(result.currentTotal).toBe(1500);
    expect(result.previousTotal).toBe(1000);
    expect(result.absoluteChange).toBe(500);
    expect(result.percentageChange).toBe(50);
    expect(result.trend).toBe("up");
  });

  it("reports downward trend when current is less than previous", () => {
    const result = calculateComparison(800, 1000);

    expect(result.absoluteChange).toBe(-200);
    expect(result.percentageChange).toBe(-20);
    expect(result.trend).toBe("down");
  });

  it("reports stable trend when values are equal", () => {
    const result = calculateComparison(500, 500);

    expect(result.absoluteChange).toBe(0);
    expect(result.percentageChange).toBe(0);
    expect(result.trend).toBe("stable");
  });

  it("returns percentageChange as null when previousTotal is 0 and currentTotal > 0", () => {
    const result = calculateComparison(500, 0);

    expect(result.absoluteChange).toBe(500);
    expect(result.percentageChange).toBeNull();
    expect(result.trend).toBe("up");
  });

  it("returns percentageChange as 0 when both totals are 0", () => {
    const result = calculateComparison(0, 0);

    expect(result.absoluteChange).toBe(0);
    expect(result.percentageChange).toBe(0);
    expect(result.trend).toBe("stable");
  });

  it("handles 100% increase correctly", () => {
    const result = calculateComparison(2000, 1000);

    expect(result.percentageChange).toBe(100);
    expect(result.trend).toBe("up");
  });

  it("handles 100% decrease (current is 0, previous > 0)", () => {
    const result = calculateComparison(0, 1000);

    expect(result.absoluteChange).toBe(-1000);
    expect(result.percentageChange).toBe(-100);
    expect(result.trend).toBe("down");
  });

  it("rounds percentage change to nearest integer", () => {
    // 333 / 1000 = 33.3% increase
    const result = calculateComparison(1333, 1000);

    expect(result.percentageChange).toBe(33);
  });

  it("handles very small current values against large previous", () => {
    const result = calculateComparison(1, 10000);

    expect(result.absoluteChange).toBe(-9999);
    expect(result.percentageChange).toBe(-100); // rounds to -100
    expect(result.trend).toBe("down");
  });

  it("handles negative current total (unusual but valid input)", () => {
    const result = calculateComparison(-100, 200);

    expect(result.absoluteChange).toBe(-300);
    expect(result.percentageChange).toBe(-150);
    expect(result.trend).toBe("down");
  });
});

// =============================================================================
// aggregateByCategory
// =============================================================================

describe("aggregateByCategory", () => {
  it("groups expenses by category with correct amounts and percentages", () => {
    const transactions = [
      createMockTransaction({
        amount: 300,
        type: "EXPENSE",
        categoryId: "food",
      }),
      createMockTransaction({
        amount: 200,
        type: "EXPENSE",
        categoryId: "food",
      }),
      createMockTransaction({
        amount: 500,
        type: "EXPENSE",
        categoryId: "transport",
      }),
    ];

    const categories = [
      createMockCategory({ id: "food", displayName: "Food" }),
      createMockCategory({ id: "transport", displayName: "Transport" }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result).toHaveLength(2);
    // Both categories have 500, so check by looking up each
    const foodResult = result.find((r) => r.id === "food");
    const transportResult = result.find((r) => r.id === "transport");
    expect(foodResult!.amount).toBe(500);
    expect(foodResult!.percentage).toBe(50);
    expect(transportResult!.amount).toBe(500);
    expect(transportResult!.percentage).toBe(50);
  });

  it("returns empty array when there are no expenses", () => {
    const transactions = [
      createMockTransaction({
        amount: 1000,
        type: "INCOME",
        categoryId: "salary",
      }),
    ];

    const categories = [
      createMockCategory({ id: "salary", displayName: "Salary" }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result).toEqual([]);
  });

  it("returns empty array when transactions array is empty", () => {
    const categories = [
      createMockCategory({ id: "food", displayName: "Food" }),
    ];

    const result = aggregateByCategory([], categories);

    expect(result).toEqual([]);
  });

  it("returns empty array when categories array is empty", () => {
    const transactions = [
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        categoryId: "food",
      }),
    ];

    const result = aggregateByCategory(transactions, []);

    expect(result).toEqual([]);
  });

  it("handles single category with all expenses", () => {
    const transactions = [
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        categoryId: "food",
      }),
      createMockTransaction({
        amount: 200,
        type: "EXPENSE",
        categoryId: "food",
      }),
    ];

    const categories = [
      createMockCategory({ id: "food", displayName: "Food" }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(300);
    expect(result[0].percentage).toBe(100);
  });

  it("sorts results by amount descending", () => {
    const transactions = [
      createMockTransaction({ amount: 100, type: "EXPENSE", categoryId: "a" }),
      createMockTransaction({ amount: 500, type: "EXPENSE", categoryId: "b" }),
      createMockTransaction({ amount: 300, type: "EXPENSE", categoryId: "c" }),
    ];

    const categories = [
      createMockCategory({ id: "a", displayName: "A" }),
      createMockCategory({ id: "b", displayName: "B" }),
      createMockCategory({ id: "c", displayName: "C" }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("c");
    expect(result[2].id).toBe("a");
  });

  it("aggregates child category transactions into parent via BFS", () => {
    const transactions = [
      createMockTransaction({
        amount: 200,
        type: "EXPENSE",
        categoryId: "food-restaurants",
      }),
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        categoryId: "food-groceries",
      }),
      createMockTransaction({
        amount: 50,
        type: "EXPENSE",
        categoryId: "food",
      }),
    ];

    const categories = [
      createMockCategory({ id: "food", displayName: "Food", level: 0 }),
      createMockCategory({
        id: "food-restaurants",
        displayName: "Restaurants",
        level: 1,
        parentId: "food",
      }),
      createMockCategory({
        id: "food-groceries",
        displayName: "Groceries",
        level: 1,
        parentId: "food",
      }),
    ];

    const result = aggregateByCategory(transactions, categories);

    // Parent "food" should include its own (50) + children (200 + 100) = 350
    const foodCategory = result.find((r) => r.id === "food");
    expect(foodCategory).toBeDefined();
    expect(foodCategory!.amount).toBe(350);
  });

  it("ignores income transactions in category breakdown", () => {
    const transactions = [
      createMockTransaction({
        amount: 500,
        type: "EXPENSE",
        categoryId: "food",
      }),
      createMockTransaction({
        amount: 5000,
        type: "INCOME",
        categoryId: "salary",
      }),
    ];

    const categories = [
      createMockCategory({ id: "food", displayName: "Food" }),
      createMockCategory({ id: "salary", displayName: "Salary" }),
    ];

    const result = aggregateByCategory(transactions, categories);

    // Total expenses is only 500, so food = 100%
    const foodCategory = result.find((r) => r.id === "food");
    expect(foodCategory).toBeDefined();
    expect(foodCategory!.percentage).toBe(100);
  });

  it("preserves color and level from category", () => {
    const transactions = [
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        categoryId: "food",
      }),
    ];

    const categories = [
      createMockCategory({
        id: "food",
        displayName: "Food",
        level: 2,
        color: "#00FF00",
      }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result[0].color).toBe("#00FF00");
    expect(result[0].level).toBe(2);
    expect(result[0].name).toBe("Food");
  });
});

// =============================================================================
// generateMonthlyChartData
// =============================================================================

describe("generateMonthlyChartData", () => {
  it("generates correct number of data points", () => {
    const result = generateMonthlyChartData([], 6);

    expect(result).toHaveLength(6);
  });

  it("returns zero values when there are no transactions", () => {
    const result = generateMonthlyChartData([], 3);

    result.forEach((point) => {
      expect(point.value).toBe(0);
    });
  });

  it("uses three-letter month abbreviations as labels", () => {
    const validLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const result = generateMonthlyChartData([], 12);

    result.forEach((point) => {
      expect(validLabels).toContain(point.label);
    });
  });

  it("filters transactions by the specified type (default EXPENSE)", () => {
    const now = new Date();
    const currentMonthMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      15
    ).getTime();

    const transactions = [
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        dateInMs: currentMonthMs,
      }),
      createMockTransaction({
        amount: 500,
        type: "INCOME",
        dateInMs: currentMonthMs,
      }),
    ];

    const result = generateMonthlyChartData(transactions, 1, "EXPENSE");

    expect(result[0].value).toBe(100);
  });

  it("filters transactions by INCOME type when specified", () => {
    const now = new Date();
    const currentMonthMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      15
    ).getTime();

    const transactions = [
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        dateInMs: currentMonthMs,
      }),
      createMockTransaction({
        amount: 500,
        type: "INCOME",
        dateInMs: currentMonthMs,
      }),
    ];

    const result = generateMonthlyChartData(transactions, 1, "INCOME");

    expect(result[0].value).toBe(500);
  });

  it("sums multiple transactions in the same month", () => {
    const now = new Date();
    const currentMonthMs1 = new Date(
      now.getFullYear(),
      now.getMonth(),
      5
    ).getTime();
    const currentMonthMs2 = new Date(
      now.getFullYear(),
      now.getMonth(),
      20
    ).getTime();

    const transactions = [
      createMockTransaction({
        amount: 150,
        type: "EXPENSE",
        dateInMs: currentMonthMs1,
      }),
      createMockTransaction({
        amount: 250,
        type: "EXPENSE",
        dateInMs: currentMonthMs2,
      }),
    ];

    const result = generateMonthlyChartData(transactions, 1);

    expect(result[0].value).toBe(400);
  });

  it("assigns transactions to their correct month bucket", () => {
    const now = new Date();
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      15
    ).getTime();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).getTime();

    const transactions = [
      createMockTransaction({
        amount: 100,
        type: "EXPENSE",
        dateInMs: lastMonth,
      }),
      createMockTransaction({
        amount: 200,
        type: "EXPENSE",
        dateInMs: thisMonth,
      }),
    ];

    const result = generateMonthlyChartData(transactions, 2);

    // Last month first, then this month
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(200);
  });

  it("generates a single data point when months is 1", () => {
    const result = generateMonthlyChartData([], 1);

    expect(result).toHaveLength(1);
  });
});

// =============================================================================
// getMonthBoundaries
// =============================================================================

describe("getMonthBoundaries", () => {
  it("returns correct boundaries for January 2025", () => {
    const { startDate, endDate } = getMonthBoundaries(2025, 1);

    expect(new Date(startDate).getDate()).toBe(1);
    expect(new Date(startDate).getMonth()).toBe(0); // January
    expect(new Date(endDate).getDate()).toBe(31);
  });

  it("returns correct boundaries for February in a leap year", () => {
    const { startDate, endDate } = getMonthBoundaries(2024, 2);

    expect(new Date(startDate).getDate()).toBe(1);
    expect(new Date(endDate).getDate()).toBe(29);
  });

  it("returns correct boundaries for February in a non-leap year", () => {
    const { startDate: _startDate, endDate } = getMonthBoundaries(2025, 2);

    expect(new Date(endDate).getDate()).toBe(28);
  });

  it("end date includes the very last millisecond of the month", () => {
    const { endDate } = getMonthBoundaries(2025, 3);
    const end = new Date(endDate);

    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });
});

// =============================================================================
// calculatePeriodStats
// =============================================================================

describe("calculatePeriodStats", () => {
  it("filters transactions within the given period", () => {
    const jan15 = new Date(2025, 0, 15).getTime();
    const feb15 = new Date(2025, 1, 15).getTime();
    const mar15 = new Date(2025, 2, 15).getTime();

    const transactions = [
      createMockTransaction({ amount: 100, type: "EXPENSE", dateInMs: jan15 }),
      createMockTransaction({ amount: 200, type: "EXPENSE", dateInMs: feb15 }),
      createMockTransaction({ amount: 300, type: "EXPENSE", dateInMs: mar15 }),
    ];

    const filter = {
      startDate: new Date(2025, 1, 1).getTime(),
      endDate: new Date(2025, 1, 28, 23, 59, 59, 999).getTime(),
    };

    const result = calculatePeriodStats(transactions, filter);

    expect(result.totalExpenses).toBe(200);
    expect(result.totalIncome).toBe(0);
  });

  it("returns zeros when no transactions fall within the period", () => {
    const jan15 = new Date(2025, 0, 15).getTime();

    const transactions = [
      createMockTransaction({ amount: 100, type: "EXPENSE", dateInMs: jan15 }),
    ];

    const filter = {
      startDate: new Date(2025, 5, 1).getTime(),
      endDate: new Date(2025, 5, 30, 23, 59, 59, 999).getTime(),
    };

    const result = calculatePeriodStats(transactions, filter);

    expect(result.totalExpenses).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.netChange).toBe(0);
  });
});

// =============================================================================
// getComparisonPeriods
// =============================================================================

describe("getComparisonPeriods", () => {
  it("returns correct MoM comparison periods for mid-year month", () => {
    const { current, previous } = getComparisonPeriods("mom", 2025, 6);

    expect(new Date(current.startDate).getMonth()).toBe(5); // June (0-indexed)
    expect(new Date(previous.startDate).getMonth()).toBe(4); // May
  });

  it("handles MoM January correctly (wraps to December of previous year)", () => {
    const { current, previous } = getComparisonPeriods("mom", 2025, 1);

    expect(new Date(current.startDate).getFullYear()).toBe(2025);
    expect(new Date(previous.startDate).getFullYear()).toBe(2024);
    expect(new Date(previous.startDate).getMonth()).toBe(11); // December
  });

  it("returns correct YoY comparison periods", () => {
    const { current, previous } = getComparisonPeriods("yoy", 2025, 6);

    expect(new Date(current.startDate).getFullYear()).toBe(2025);
    expect(new Date(previous.startDate).getFullYear()).toBe(2024);
    expect(new Date(previous.startDate).getMonth()).toBe(5); // Same month (June)
  });
});
