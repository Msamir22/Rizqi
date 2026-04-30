/**
 * Balance input sanitizers
 *
 * Live-cleaners for balance TextField inputs that allow at most one decimal
 * point and (optionally) a single leading minus. Keep these in sync with the
 * regex refines in `validation/account-validation.ts` so the UI cannot accept
 * a value the schema would later reject.
 *
 * @module balance-input
 */

/**
 * Strip everything except digits and the FIRST `.`. Rejects negatives — used
 * by the create-account screen where overdraft input is not allowed.
 */
export function sanitizeNonNegativeBalanceInput(input: string): string {
  const digitsAndDot = input.replace(/[^0-9.]/g, "");
  const firstDot = digitsAndDot.indexOf(".");
  if (firstDot === -1) return digitsAndDot;
  return (
    digitsAndDot.slice(0, firstDot + 1) +
    digitsAndDot.slice(firstDot + 1).replace(/\./g, "")
  );
}

/**
 * Same as `sanitizeNonNegativeBalanceInput` but additionally preserves a
 * single leading `-`. Used by the edit-account screen where overdraft (negative)
 * balances are valid.
 */
export function sanitizeBalanceInput(input: string): string {
  const isNegative = input.startsWith("-");
  const body = sanitizeNonNegativeBalanceInput(
    isNegative ? input.slice(1) : input
  );
  return isNegative ? `-${body}` : body;
}
