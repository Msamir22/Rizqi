/**
 * Unit tests for formatDate() — verifies that Arabic mode produces a fully
 * localized string (Arabic month names + Arabic comma "،") instead of mixing
 * Arabic months with a Latin comma.
 */

import i18n from "@/i18n";
import { formatDate } from "@/utils/dateHelpers";

describe("formatDate", () => {
  // 2025-01-15 — January 15
  const date = new Date(2025, 0, 15);

  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  describe("English mode", () => {
    beforeAll(async () => {
      await i18n.changeLanguage("en");
    });

    test("MMM d, yyyy uses Latin comma", () => {
      expect(formatDate(date, "MMM d, yyyy")).toBe("Jan 15, 2025");
    });

    test("EEEE, MMM d uses Latin comma", () => {
      expect(formatDate(date, "EEEE, MMM d")).toBe("Wednesday, Jan 15");
    });

    test("MMMM yyyy", () => {
      expect(formatDate(date, "MMMM yyyy")).toBe("January 2025");
    });
  });

  describe("Arabic mode", () => {
    beforeAll(async () => {
      await i18n.changeLanguage("ar");
    });

    test("MMM d, yyyy uses Arabic month + Arabic comma", () => {
      const result = formatDate(date, "MMM d, yyyy");
      expect(result).toContain("يناير");
      expect(result).toContain("،");
      // Must NOT contain Latin comma
      expect(result).not.toMatch(/,/);
    });

    test("EEEE, MMM d uses Arabic day + Arabic comma", () => {
      const result = formatDate(date, "EEEE, MMM d");
      expect(result).toContain("الأربعاء");
      expect(result).toContain("يناير");
      expect(result).toContain("،");
      expect(result).not.toMatch(/,/);
    });
  });
});
