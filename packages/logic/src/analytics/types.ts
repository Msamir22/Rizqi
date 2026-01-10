/**
 * Analytics Types
 * Shared interfaces for transaction analytics across mobile and future web app
 */

/**
 * Monthly totals for expenses and income
 */
export interface MonthlyTotals {
  totalExpenses: number;
  totalIncome: number;
  netChange: number;
}

/**
 * Monthly summary with metadata
 */
export interface MonthlySummary extends MonthlyTotals {
  year: number;
  month: number;
  transactionCount: number;
}

/**
 * Category breakdown for pie/donut charts
 */
export interface CategoryBreakdown {
  id: string;
  name: string;
  level: number;
  amount: number;
  percentage: number;
  color?: string;
}

/**
 * Comparison result for MoM/YoY analytics
 */
export interface ComparisonResult {
  currentTotal: number;
  previousTotal: number;
  absoluteChange: number;
  percentageChange: number;
  trend: "up" | "down" | "stable";
}

/**
 * Chart data point for line/bar charts
 */
export interface ChartDataPoint {
  label: string; // e.g., "Jan", "Feb"
  value: number;
  frontColor?: string; // for bar charts
  dataPointColor?: string; // for line charts
}

/**
 * Period filter options
 */
export interface PeriodFilter {
  startDate: number;
  endDate: number;
}
