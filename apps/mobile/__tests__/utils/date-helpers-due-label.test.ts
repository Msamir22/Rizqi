jest.mock("../../i18n", () => ({
  __esModule: true,
  default: {
    language: "en",
    t: (key: string, values?: { readonly count?: number }) => {
      if (key === "common:due_today") return "Due today";
      if (key === "common:due_tomorrow") return "Due tomorrow";
      if (key === "common:due_in_days") return `Due in ${values?.count} days`;
      if (key === "common:due_overdue") {
        return `${values?.count} days overdue`;
      }
      return key;
    },
  },
}));

import { getDueText } from "../../utils/dateHelpers";

describe("getDueText", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-15T18:30:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("labels a payment due today using calendar days, not the current time", () => {
    expect(getDueText(new Date("2026-05-15T02:00:00.000Z"))).toBe(
      "Due today"
    );
  });

  it("labels tomorrow, future, and overdue payments correctly", () => {
    expect(getDueText(new Date("2026-05-16T01:00:00.000Z"))).toBe(
      "Due tomorrow"
    );
    expect(getDueText(new Date("2026-05-20T12:00:00.000Z"))).toBe(
      "Due in 5 days"
    );
    expect(getDueText(new Date("2026-05-13T12:00:00.000Z"))).toBe(
      "2 days overdue"
    );
  });
});
