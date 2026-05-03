import { roundCurrency, roundForCurrency } from "../round-currency";

describe("roundCurrency", () => {
  it("rounds to 2 decimals by default", () => {
    expect(roundCurrency(1999.99)).toBe(1999.99);
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(1.004)).toBe(1);
  });

  it("eliminates IEEE-754 floating-point drift", () => {
    expect(roundCurrency(1999.99 + 0.1)).toBe(2000.09);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it("handles negative values", () => {
    expect(roundCurrency(-5.55)).toBe(-5.55);
    expect(roundCurrency(-1.999)).toBe(-2);
    expect(roundCurrency(-0.1 - 0.2)).toBe(-0.3);
  });

  it("handles zero", () => {
    expect(roundCurrency(0)).toBe(0);
    expect(roundCurrency(-0)).toBe(0);
  });

  it("accepts custom decimal places", () => {
    expect(roundCurrency(1.2345, 3)).toBe(1.235);
    expect(roundCurrency(1.2345, 0)).toBe(1);
    expect(roundCurrency(1.2345, 1)).toBe(1.2);
  });
});

describe("roundForCurrency", () => {
  it("uses 2 decimals for standard currencies", () => {
    expect(roundForCurrency(1.2345, "EGP")).toBe(1.23);
    expect(roundForCurrency(1.2345, "USD")).toBe(1.23);
    expect(roundForCurrency(1.2345, "EUR")).toBe(1.23);
  });

  it("uses 3 decimals for BHD, KWD, OMR", () => {
    expect(roundForCurrency(1.2345, "BHD")).toBe(1.235);
    expect(roundForCurrency(1.2345, "KWD")).toBe(1.235);
    expect(roundForCurrency(1.2345, "OMR")).toBe(1.235);
  });

  it("uses 8 decimals for BTC", () => {
    expect(roundForCurrency(0.123456789, "BTC")).toBe(0.12345679);
  });

  it("eliminates float drift for EGP", () => {
    expect(roundForCurrency(1999.99 + 0.1, "EGP")).toBe(2000.09);
  });

  it("eliminates float drift for BHD (3 decimals)", () => {
    expect(roundForCurrency(1.001 + 0.002, "BHD")).toBe(1.003);
  });
});
