/**
 * Transaction Analytics
 * Shared calculation functions for transaction data analysis
 */

import { Category, Transaction, TransactionType } from "@astik/db";
import {
  CategoryBreakdown,
  ChartDataPoint,
  ComparisonResult,
  MonthlyTotals,
  PeriodFilter,
} from "./types";

export function getMonthBoundaries(year: number, month: number): PeriodFilter {
  // Calculate start and end of month
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  return { startDate: startOfMonth, endDate: endOfMonth };
}

/**
 * Calculate monthly totals from a list of transactions
 */
export function calculateMonthlyTotals(
  transactions: Transaction[]
): MonthlyTotals {
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "EXPENSE") {
        acc.totalExpenses += t.amount;
      } else {
        acc.totalIncome += t.amount;
      }
      return acc;
    },
    { totalExpenses: 0, totalIncome: 0 }
  );

  return {
    ...totals,
    netChange: totals.totalIncome - totals.totalExpenses,
  };
}

/**
 * Calculate totals for a specific period
 */
export function calculatePeriodStats(
  transactions: Transaction[],
  filter: PeriodFilter
): MonthlyTotals {
  const filtered = transactions.filter(
    (t) => t.dateInMs >= filter.startDate && t.dateInMs <= filter.endDate
  );
  return calculateMonthlyTotals(filtered);
}

/**
 * Build a map of parent category ID to array of child category IDs
 */
function buildCategoryChildrenMap(
  categories: Category[]
): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();

  for (const cat of categories) {
    if (cat.parentId) {
      const siblings = childrenMap.get(cat.parentId) || [];
      siblings.push(cat.id);
      childrenMap.set(cat.parentId, siblings);
    }
  }

  return childrenMap;
}

/**
 * Get all descendant category IDs for a given category using BFS
 */
function getCategoryDescendants(
  childrenMap: Map<string, string[]>,
  categoryId: string
): string[] {
  const descendants: string[] = [categoryId];
  const queue: string[] = [categoryId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = childrenMap.get(id) || [];
    for (const childId of children) {
      descendants.push(childId);
      queue.push(childId);
    }
  }

  return descendants;
}

/**
 * Group transactions by category and calculate breakdown
 */
export function aggregateByCategory(
  transactions: Transaction[],
  categories: Category[]
): CategoryBreakdown[] {
  // Only count expenses for category breakdown
  const expenses = transactions.filter((t) => t.type === "EXPENSE");
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

  if (totalExpenses === 0) {
    return [];
  }

  const breakdown: CategoryBreakdown[] = [];

  const childrenMap = buildCategoryChildrenMap(categories);

  for (const cat of categories) {
    const categoryDescendants = getCategoryDescendants(childrenMap, cat.id);
    const filteredTransactions = transactions.filter((t) =>
      categoryDescendants.includes(t.categoryId)
    );
    const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    breakdown.push({
      id: cat.id,
      name: cat.displayName,
      level: cat.level,
      amount: total,
      percentage: Math.round((total / totalExpenses) * 100),
      color: cat.color,
    });
  }

  // Sort by amount descending
  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Generate monthly chart data from transactions
 */
export function generateMonthlyChartData(
  transactions: Transaction[],
  months: number,
  type: TransactionType = "EXPENSE"
): ChartDataPoint[] {
  const now = new Date();
  const result: ChartDataPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const startOfMonth = new Date(year, month, 1).getTime();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    const monthTransactions = transactions.filter(
      (t) =>
        t.dateInMs >= startOfMonth &&
        t.dateInMs <= endOfMonth &&
        t.type === type
    );

    const total = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

    const monthNames = [
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

    result.push({
      label: monthNames[month],
      value: total,
    });
  }

  return result;
}

/**
 * Calculate comparison between two periods (MoM or YoY)
 */
export function calculateComparison(
  currentTotal: number,
  previousTotal: number
): ComparisonResult {
  const absoluteChange = currentTotal - previousTotal;

  let percentageChange: number | null = null;
  if (previousTotal > 0) {
    percentageChange = Math.round(
      ((currentTotal - previousTotal) / previousTotal) * 100
    );
  } else if (previousTotal === 0 && currentTotal === 0) {
    percentageChange = 0;
  }
  // When previousTotal is 0 but currentTotal > 0, percentageChange stays null
  // (growth rate from zero is undefined — UI should show "N/A" or just the absolute change)

  let trend: "up" | "down" | "stable" = "stable";
  if (absoluteChange > 0) {
    trend = "up";
  } else if (absoluteChange < 0) {
    trend = "down";
  }

  return {
    currentTotal,
    previousTotal,
    absoluteChange,
    percentageChange,
    trend,
  };
}

/**
 * Get period boundaries for a specific month
 */
export function getYearMonthBoundaries(
  year: number,
  month: number
): PeriodFilter {
  const startDate = new Date(year, month - 1, 1).getTime();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();
  return { startDate, endDate };
}

/**
 * Get period boundaries for comparison
 */
export function getComparisonPeriods(
  type: "mom" | "yoy",
  year: number,
  month: number
): { current: PeriodFilter; previous: PeriodFilter } {
  const current = getYearMonthBoundaries(year, month);

  let previous: PeriodFilter;
  if (type === "mom") {
    // Month over month: previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    previous = getYearMonthBoundaries(prevYear, prevMonth);
  } else {
    // Year over year: same month last year
    previous = getYearMonthBoundaries(year - 1, month);
  }

  return { current, previous };
}
