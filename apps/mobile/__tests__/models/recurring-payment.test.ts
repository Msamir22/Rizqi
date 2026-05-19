import { calculateDaysUntilDue } from "../../../../packages/db/src/models/RecurringPayment";

describe("RecurringPayment date helpers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-10T23:30:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calculates days until due from UTC calendar dates", () => {
    expect(calculateDaysUntilDue(new Date("2026-05-11T00:30:00.000Z"))).toBe(1);
  });

  it("fails fast for invalid due dates", () => {
    expect(() => calculateDaysUntilDue(new Date("invalid"))).toThrow(
      "Invalid recurring payment due date"
    );
  });
});
