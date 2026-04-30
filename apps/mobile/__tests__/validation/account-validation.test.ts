import {
  accountFormSchema,
  editAccountFormSchema,
  validateAccountForm,
  validateEditAccountForm,
} from "@/validation/account-validation";

const baseCreate = {
  name: "Cash",
  accountType: "CASH" as const,
  currency: "EGP",
  balance: "100",
  bankName: "",
  cardLast4: "",
  smsSenderName: "",
};

const baseEdit = {
  name: "Cash",
  balance: "100",
  bankName: "",
  cardLast4: "",
  smsSenderName: "",
};

describe("accountFormSchema (create)", () => {
  it("trims the name field via z.string().trim()", () => {
    const parsed = accountFormSchema.parse({ ...baseCreate, name: "  Cash  " });
    expect(parsed.name).toBe("Cash");
  });

  it("rejects multi-dot balance like 1.2.3", () => {
    const result = validateAccountForm({ ...baseCreate, balance: "1.2.3" });
    expect(result.isValid).toBe(false);
    expect(result.errors.balance).toBeDefined();
  });

  it("rejects negative balance on create", () => {
    const result = validateAccountForm({ ...baseCreate, balance: "-5" });
    expect(result.isValid).toBe(false);
    expect(result.errors.balance).toBeDefined();
  });

  it("rejects alpha balance like abc", () => {
    const result = validateAccountForm({ ...baseCreate, balance: "abc" });
    expect(result.isValid).toBe(false);
    expect(result.errors.balance).toBeDefined();
  });

  it("rejects whitespace-only name (after trim)", () => {
    const result = validateAccountForm({ ...baseCreate, name: "   " });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it("accepts a valid integer balance", () => {
    const result = validateAccountForm({ ...baseCreate, balance: "100" });
    expect(result.isValid).toBe(true);
  });

  it("accepts a valid decimal balance", () => {
    const result = validateAccountForm({ ...baseCreate, balance: "100.50" });
    expect(result.isValid).toBe(true);
  });
});

describe("editAccountFormSchema", () => {
  it("trims the name field via z.string().trim()", () => {
    const parsed = editAccountFormSchema.parse({
      ...baseEdit,
      name: "  Cash  ",
    });
    expect(parsed.name).toBe("Cash");
  });

  it("rejects multi-minus balance like -1-2", () => {
    const result = validateEditAccountForm({ ...baseEdit, balance: "-1-2" });
    expect(result.isValid).toBe(false);
    expect(result.errors.balance).toBeDefined();
  });

  it("rejects multi-dot balance like 1.2.3", () => {
    const result = validateEditAccountForm({ ...baseEdit, balance: "1.2.3" });
    expect(result.isValid).toBe(false);
    expect(result.errors.balance).toBeDefined();
  });

  it("accepts a valid negative balance (overdraft)", () => {
    const result = validateEditAccountForm({ ...baseEdit, balance: "-5" });
    expect(result.isValid).toBe(true);
  });

  it("accepts a valid negative decimal balance", () => {
    const result = validateEditAccountForm({ ...baseEdit, balance: "-12.50" });
    expect(result.isValid).toBe(true);
  });

  it("rejects a leading minus with no digits", () => {
    const result = validateEditAccountForm({ ...baseEdit, balance: "-" });
    expect(result.isValid).toBe(false);
    expect(result.errors.balance).toBeDefined();
  });
});
