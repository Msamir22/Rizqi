/**
 * Unit tests for purity conversion and display utilities.
 *
 * Covers:
 * - karatToFraction / fractionToKarat: gold karat conversions, rounding, boundaries
 * - finenessToFraction / fractionToFineness: millesimal fineness conversions, boundaries
 * - formatPurityForDisplay: metal-type-aware formatting
 * - getPurityOptionsForMetal: returns correct preset arrays
 * - userInputToFraction / fractionToUserValue: metal-type dispatch
 *
 * @module purity-utils.test
 */

import {
  karatToFraction,
  fractionToKarat,
  finenessToFraction,
  fractionToFineness,
  formatPurityForDisplay,
  getPurityOptionsForMetal,
  userInputToFraction,
  fractionToUserValue,
  GOLD_PURITY_OPTIONS,
  FINENESS_OPTIONS,
} from "../purity-utils";
import type { MetalType } from "@astik/db";

// =============================================================================
// karatToFraction
// =============================================================================

describe("karatToFraction", () => {
  it("converts 24K to 1.0", () => {
    expect(karatToFraction(24)).toBe(1.0);
  });

  it("converts 21K to 0.875", () => {
    expect(karatToFraction(21)).toBe(0.875);
  });

  it("converts 18K to 0.75", () => {
    expect(karatToFraction(18)).toBe(0.75);
  });

  it("converts 14K correctly", () => {
    expect(karatToFraction(14)).toBeCloseTo(14 / 24, 10);
  });

  it("converts 10K correctly", () => {
    expect(karatToFraction(10)).toBeCloseTo(10 / 24, 10);
  });

  it("converts 1K to the minimum fraction", () => {
    expect(karatToFraction(1)).toBeCloseTo(1 / 24, 10);
  });

  // -------------------------------------------------------------------------
  // Boundary validation
  // -------------------------------------------------------------------------

  it("throws for karat value 0", () => {
    expect(() => karatToFraction(0)).toThrow("Invalid karat value: 0");
  });

  it("throws for negative karat value", () => {
    expect(() => karatToFraction(-1)).toThrow("Invalid karat value: -1");
  });

  it("throws for karat value above 24", () => {
    expect(() => karatToFraction(25)).toThrow("Invalid karat value: 25");
  });

  it("does not throw for boundary value 1", () => {
    expect(() => karatToFraction(1)).not.toThrow();
  });

  it("does not throw for boundary value 24", () => {
    expect(() => karatToFraction(24)).not.toThrow();
  });
});

// =============================================================================
// fractionToKarat
// =============================================================================

describe("fractionToKarat", () => {
  it("converts 1.0 to 24K", () => {
    expect(fractionToKarat(1.0)).toBe(24);
  });

  it("converts 0.875 to 21K", () => {
    expect(fractionToKarat(0.875)).toBe(21);
  });

  it("converts 0.75 to 18K", () => {
    expect(fractionToKarat(0.75)).toBe(18);
  });

  it("converts 0 to 0K", () => {
    expect(fractionToKarat(0)).toBe(0);
  });

  it("rounds to the nearest karat", () => {
    // 0.88 * 24 = 21.12 -> rounds to 21
    expect(fractionToKarat(0.88)).toBe(21);
  });

  it("rounds up when closer to the upper karat", () => {
    // 0.9 * 24 = 21.6 -> rounds to 22
    expect(fractionToKarat(0.9)).toBe(22);
  });

  // -------------------------------------------------------------------------
  // Boundary validation
  // -------------------------------------------------------------------------

  it("throws for fraction below 0", () => {
    expect(() => fractionToKarat(-0.01)).toThrow("Invalid fraction value");
  });

  it("throws for fraction above 1", () => {
    expect(() => fractionToKarat(1.01)).toThrow("Invalid fraction value");
  });

  it("does not throw for boundary value 0", () => {
    expect(() => fractionToKarat(0)).not.toThrow();
  });

  it("does not throw for boundary value 1", () => {
    expect(() => fractionToKarat(1)).not.toThrow();
  });
});

// =============================================================================
// finenessToFraction
// =============================================================================

describe("finenessToFraction", () => {
  it("converts 999 to 0.999", () => {
    expect(finenessToFraction(999)).toBe(0.999);
  });

  it("converts 925 (Sterling) to 0.925", () => {
    expect(finenessToFraction(925)).toBe(0.925);
  });

  it("converts 950 to 0.95", () => {
    expect(finenessToFraction(950)).toBe(0.95);
  });

  it("converts 1000 to 1.0", () => {
    expect(finenessToFraction(1000)).toBe(1.0);
  });

  it("converts 1 (minimum) to 0.001", () => {
    expect(finenessToFraction(1)).toBe(0.001);
  });

  // -------------------------------------------------------------------------
  // Boundary validation
  // -------------------------------------------------------------------------

  it("throws for fineness value 0", () => {
    expect(() => finenessToFraction(0)).toThrow("Invalid fineness value: 0");
  });

  it("throws for negative fineness", () => {
    expect(() => finenessToFraction(-100)).toThrow(
      "Invalid fineness value: -100"
    );
  });

  it("throws for fineness above 1000", () => {
    expect(() => finenessToFraction(1001)).toThrow(
      "Invalid fineness value: 1001"
    );
  });

  it("does not throw for boundary value 1", () => {
    expect(() => finenessToFraction(1)).not.toThrow();
  });

  it("does not throw for boundary value 1000", () => {
    expect(() => finenessToFraction(1000)).not.toThrow();
  });
});

// =============================================================================
// fractionToFineness
// =============================================================================

describe("fractionToFineness", () => {
  it("converts 0.999 to 999", () => {
    expect(fractionToFineness(0.999)).toBe(999);
  });

  it("converts 0.925 to 925", () => {
    expect(fractionToFineness(0.925)).toBe(925);
  });

  it("converts 1.0 to 1000", () => {
    expect(fractionToFineness(1.0)).toBe(1000);
  });

  it("converts 0 to 0", () => {
    expect(fractionToFineness(0)).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    // 0.9256 * 1000 = 925.6 -> rounds to 926
    expect(fractionToFineness(0.9256)).toBe(926);
  });

  // -------------------------------------------------------------------------
  // Boundary validation
  // -------------------------------------------------------------------------

  it("throws for fraction below 0", () => {
    expect(() => fractionToFineness(-0.01)).toThrow("Invalid fraction value");
  });

  it("throws for fraction above 1", () => {
    expect(() => fractionToFineness(1.01)).toThrow("Invalid fraction value");
  });

  it("does not throw for boundary value 0", () => {
    expect(() => fractionToFineness(0)).not.toThrow();
  });

  it("does not throw for boundary value 1", () => {
    expect(() => fractionToFineness(1)).not.toThrow();
  });
});

// =============================================================================
// formatPurityForDisplay
// =============================================================================

describe("formatPurityForDisplay", () => {
  it("formats gold purity as karat string", () => {
    expect(formatPurityForDisplay("GOLD", 0.875)).toBe("21K");
  });

  it("formats 24K gold", () => {
    expect(formatPurityForDisplay("GOLD", 1.0)).toBe("24K");
  });

  it("formats silver purity as fineness string", () => {
    expect(formatPurityForDisplay("SILVER", 0.925)).toBe("925");
  });

  it("formats platinum purity as fineness string", () => {
    expect(formatPurityForDisplay("PLATINUM", 0.95)).toBe("950");
  });

  it("formats palladium purity as fineness string", () => {
    expect(formatPurityForDisplay("PALLADIUM", 0.999)).toBe("999");
  });

  it("formats unknown metal type as percentage", () => {
    expect(formatPurityForDisplay("COPPER" as MetalType, 0.75)).toBe("75%");
  });

  it("formats zero fraction for gold as 0K", () => {
    expect(formatPurityForDisplay("GOLD", 0)).toBe("0K");
  });

  it("formats zero fraction for silver as 0", () => {
    expect(formatPurityForDisplay("SILVER", 0)).toBe("0");
  });
});

// =============================================================================
// getPurityOptionsForMetal
// =============================================================================

describe("getPurityOptionsForMetal", () => {
  it("returns gold purity options for GOLD", () => {
    expect(getPurityOptionsForMetal("GOLD")).toBe(GOLD_PURITY_OPTIONS);
  });

  it("returns fineness options for SILVER", () => {
    expect(getPurityOptionsForMetal("SILVER")).toBe(FINENESS_OPTIONS);
  });

  it("returns fineness options for PLATINUM", () => {
    expect(getPurityOptionsForMetal("PLATINUM")).toBe(FINENESS_OPTIONS);
  });

  it("returns fineness options for PALLADIUM", () => {
    expect(getPurityOptionsForMetal("PALLADIUM")).toBe(FINENESS_OPTIONS);
  });
});

// =============================================================================
// userInputToFraction
// =============================================================================

describe("userInputToFraction", () => {
  it("converts gold karat input to fraction", () => {
    expect(userInputToFraction("GOLD", 21)).toBe(0.875);
  });

  it("converts silver fineness input to fraction", () => {
    expect(userInputToFraction("SILVER", 925)).toBe(0.925);
  });

  it("converts platinum fineness input to fraction", () => {
    expect(userInputToFraction("PLATINUM", 950)).toBe(0.95);
  });

  it("converts palladium fineness input to fraction", () => {
    expect(userInputToFraction("PALLADIUM", 999)).toBe(0.999);
  });
});

// =============================================================================
// fractionToUserValue
// =============================================================================

describe("fractionToUserValue", () => {
  it("converts gold fraction to karat", () => {
    expect(fractionToUserValue("GOLD", 0.875)).toBe(21);
  });

  it("converts silver fraction to fineness", () => {
    expect(fractionToUserValue("SILVER", 0.925)).toBe(925);
  });

  it("converts platinum fraction to fineness", () => {
    expect(fractionToUserValue("PLATINUM", 0.95)).toBe(950);
  });

  it("converts palladium fraction to fineness", () => {
    expect(fractionToUserValue("PALLADIUM", 0.999)).toBe(999);
  });
});

// =============================================================================
// Constants integrity
// =============================================================================

describe("GOLD_PURITY_OPTIONS", () => {
  it("contains 6 preset options", () => {
    expect(GOLD_PURITY_OPTIONS).toHaveLength(6);
  });

  it("has 24K as the first and purest option", () => {
    expect(GOLD_PURITY_OPTIONS[0]).toEqual({
      karat: 24,
      fraction: 1.0,
      label: "24K (Pure)",
    });
  });

  it("has consistent karat-to-fraction values", () => {
    for (const option of GOLD_PURITY_OPTIONS) {
      expect(option.fraction).toBeCloseTo(option.karat / 24, 10);
    }
  });
});

describe("FINENESS_OPTIONS", () => {
  it("contains 6 preset options", () => {
    expect(FINENESS_OPTIONS).toHaveLength(6);
  });

  it("has 999 (Fine) as the first and purest option", () => {
    expect(FINENESS_OPTIONS[0]).toEqual({
      fineness: 999,
      fraction: 0.999,
      label: "999 (Fine)",
    });
  });

  it("has consistent fineness-to-fraction values", () => {
    for (const option of FINENESS_OPTIONS) {
      expect(option.fraction).toBeCloseTo(option.fineness / 1000, 10);
    }
  });
});
