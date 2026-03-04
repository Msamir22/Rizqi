/**
 * Formats a raw numeric string with commas for thousands separators,
 * preserving existing decimal components.
 */
export function formatAmountInput(
  val: string,
  initialValue: string = ""
): string {
  if (!val) return initialValue;
  const parts = val.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * Parses user input into a clean numeric string, allowing up to one decimal point.
 */
export function parseAmountInput(text: string): string {
  let cleaned = text.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }
  return cleaned;
}
