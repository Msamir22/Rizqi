import {
  sanitizeBalanceInput,
  sanitizeNonNegativeBalanceInput,
} from "@/utils/balance-input";

describe("sanitizeNonNegativeBalanceInput", () => {
  it("strips alpha and other non-digit non-dot characters", () => {
    expect(sanitizeNonNegativeBalanceInput("abc1d2.3xyz")).toBe("12.3");
  });

  it("collapses multiple dots, keeping only the first", () => {
    expect(sanitizeNonNegativeBalanceInput("1.2.3")).toBe("1.23");
  });

  it("strips a leading minus (negatives not allowed)", () => {
    expect(sanitizeNonNegativeBalanceInput("-100")).toBe("100");
  });

  it("preserves a valid integer unchanged", () => {
    expect(sanitizeNonNegativeBalanceInput("100")).toBe("100");
  });

  it("preserves a valid decimal unchanged", () => {
    expect(sanitizeNonNegativeBalanceInput("100.50")).toBe("100.50");
  });

  it("returns empty string for entirely-invalid input", () => {
    expect(sanitizeNonNegativeBalanceInput("abc")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeNonNegativeBalanceInput("")).toBe("");
  });
});

describe("sanitizeBalanceInput", () => {
  it("preserves a single leading minus", () => {
    expect(sanitizeBalanceInput("-100")).toBe("-100");
  });

  it("does NOT preserve a non-leading minus (e.g. -1-2)", () => {
    expect(sanitizeBalanceInput("-1-2")).toBe("-12");
  });

  it("does NOT preserve a non-leading minus on a positive (e.g. 1-2)", () => {
    expect(sanitizeBalanceInput("1-2")).toBe("12");
  });

  it("collapses multiple dots on a negative number", () => {
    expect(sanitizeBalanceInput("-1.2.3")).toBe("-1.23");
  });

  it("strips alpha but keeps minus + digits", () => {
    expect(sanitizeBalanceInput("-abc12.5xyz")).toBe("-12.5");
  });

  it("preserves a valid positive integer", () => {
    expect(sanitizeBalanceInput("100")).toBe("100");
  });

  it("preserves a valid negative decimal", () => {
    expect(sanitizeBalanceInput("-12.50")).toBe("-12.50");
  });
});
