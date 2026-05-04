import { resolveInitialTransactionAccountSelection } from "../../utils/account-selection";

describe("resolveInitialTransactionAccountSelection", () => {
  it("selects the default account for manual transaction entry", () => {
    const result = resolveInitialTransactionAccountSelection([
      { id: "bank-1", isDefault: false },
      { id: "cash-default", isDefault: true },
      { id: "wallet-1", isDefault: false },
    ]);

    expect(result.selectedAccountId).toBe("cash-default");
    expect(result.toAccountId).toBe("bank-1");
  });

  it("falls back to the first account when no default exists", () => {
    const result = resolveInitialTransactionAccountSelection([
      { id: "bank-1", isDefault: false },
      { id: "cash-1", isDefault: false },
    ]);

    expect(result.selectedAccountId).toBe("bank-1");
    expect(result.toAccountId).toBe("cash-1");
  });

  it("returns an empty transfer destination when only one account exists", () => {
    const result = resolveInitialTransactionAccountSelection([
      { id: "cash-default", isDefault: true },
    ]);

    expect(result.selectedAccountId).toBe("cash-default");
    expect(result.toAccountId).toBeNull();
  });

  it("returns empty selection when no accounts exist", () => {
    const result = resolveInitialTransactionAccountSelection([]);

    expect(result.selectedAccountId).toBeNull();
    expect(result.toAccountId).toBeNull();
  });
});
