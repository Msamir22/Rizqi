/**
 * Date utility functions for transaction grouping
 * Extracted from useTransactionsGrouping hook for reusability and SRP compliance
 */

export function getStartOfDay(d: number | Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getEndOfDay(d: number | Date): number {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function getStartOfWeek(d: Date, startOnMonday = true): number {
  const date = new Date(d);
  const day = date.getDay();
  const dayIndex = startOnMonday ? (day === 0 ? 6 : day - 1) : day;
  date.setDate(date.getDate() - dayIndex);
  return getStartOfDay(date);
}

export function getEndOfWeek(d: Date, startOnMonday = true): number {
  const start = new Date(getStartOfWeek(d, startOnMonday));
  start.setDate(start.getDate() + 6);
  return getEndOfDay(start);
}

export function getStartOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function getEndOfMonth(d: Date): number {
  return new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  ).getTime();
}

/**
 * Get the same day of the month in the next month.
 * Handles month-end overflow (e.g., Jan 31 → Feb 28).
 */
export function getNextMonthSameDay(date: Date): Date {
  const next = new Date(date);
  const currentDay = next.getDate();
  next.setMonth(next.getMonth() + 1);

  // If the day overflowed (e.g., Jan 31 → Mar 3), clamp to last day of target month
  if (next.getDate() !== currentDay) {
    next.setDate(0); // sets to last day of the previous month (i.e. the target month)
  }

  return next;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getDueText(date: Date): string {
  const days = getDaysUntil(date);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

const SHORT_MONTHS = [
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

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type DateFormat = "MMM d, yyyy" | "EEEE, MMM d" | "MMM d" | "MMMM yyyy";

export function formatDate(date: Date, format: DateFormat): string {
  switch (format) {
    case "MMM d, yyyy":
      return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    case "EEEE, MMM d":
      return `${DAYS[date.getDay()]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
    case "MMM d":
      return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
    case "MMMM yyyy":
      return `${FULL_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    default:
      return date.toDateString();
  }
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
