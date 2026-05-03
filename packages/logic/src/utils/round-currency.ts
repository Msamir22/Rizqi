import type { CurrencyType } from "@monyvi/db";

import { CURRENCY_PRECISION, DEFAULT_PRECISION } from "./currency";

export function roundCurrency(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor || 0;
}

export function roundForCurrency(
  value: number,
  currency: CurrencyType
): number {
  const decimals = CURRENCY_PRECISION[currency] ?? DEFAULT_PRECISION;
  return roundCurrency(value, decimals);
}
