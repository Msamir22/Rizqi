import {
  matchAccountCore,
  type AccountWithBankDetails,
  type MatchInput,
} from "../../services/sms-account-matcher";

jest.mock("@astik/db", () => ({
  database: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

describe("sms-account-matcher - matchAccountCore", () => {
  const baseDate = new Date("2026-01-01T00:00:00Z");

  // Base accounts setup
  const accBank1: AccountWithBankDetails = {
    id: "acc_bank1",
    name: "CIB Account",
    currency: "EGP",
    isDefault: false,
    createdAt: baseDate,
    type: "BANK_ACCOUNT",
    smsSenderName: "CIB",
    bankName: "Commercial International Bank",
    cardLast4: "1234",
  };

  const accBank2: AccountWithBankDetails = {
    id: "acc_bank2",
    name: "NBE Visa",
    currency: "USD",
    isDefault: true, // Used for Step 4
    createdAt: new Date(baseDate.getTime() + 1000), // Created later
    type: "CREDIT_CARD",
    smsSenderName: "NBE",
    cardLast4: "5678",
  };

  const accBank3: AccountWithBankDetails = {
    id: "acc_bank3",
    name: "Banque Misr",
    currency: "EGP",
    isDefault: false,
    createdAt: new Date(baseDate.getTime() - 1000), // Created first (for Step 5)
    type: "BANK_ACCOUNT", // "BANK_ACCOUNT" maps to Step 5 fallback
  };

  const accounts: AccountWithBankDetails[] = [accBank1, accBank2, accBank3];

  it("Step 1: Matches based on card last 4 AND sender match (highest confidence)", () => {
    const input: MatchInput = {
      senderAddress: "CIB-EGYPT", // Matches "CIB" bidirectionally
      cardLast4: "1234",
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank1");
    expect(result.matchReason).toBe("card_last4");
  });

  it("Step 1b: Matches based on card last 4 alone if sender doesn't match", () => {
    const input: MatchInput = {
      senderAddress: "UNKNOWN SENDER xyz",
      cardLast4: "1234", // Matches accBank1
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank1");
    expect(result.matchReason).toBe("card_last4");
  });

  it("Step 2: Matches based on sender alone (bank_details / account name)", () => {
    const input: MatchInput = {
      senderAddress: "NBE",
      // No card last 4
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank2");
    expect(result.matchReason).toBe("sms_sender");
  });

  it("Step 3: Matches based on bank registry name and currency", () => {
    const input: MatchInput = {
      senderAddress: "BANQUEMISR", // Known financial sender mapped to "Banque Misr"
      currency: "EGP",
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank3");
    expect(result.matchReason).toBe("bank_registry");
  });

  it("Step 4: Falls back to default account if NO other match and not a known bank", () => {
    const input: MatchInput = {
      senderAddress: "RANDOM_STORE",
      currency: "EGP",
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank2"); // accBank2 is default
    expect(result.matchReason).toBe("default");
  });

  it("Step 5: Falls back to the very first BANK account if no default exists", () => {
    // Remove the default account and ensure they are sorted by createdAt ASC like fetchAccountsWithDetails does
    const accountsNoDefault = [accBank3, accBank1];
    const input: MatchInput = {
      senderAddress: "RANDOM_STORE",
    };
    const result = matchAccountCore(input, accountsNoDefault);
    // accBank1 and accBank3 are both BANK_ACCOUNT, but sorted by createdAt ASC.
    // accBank3 was created before accBank1, so it should be picked first.
    expect(result.accountId).toBe("acc_bank3");
    expect(result.matchReason).toBe("first_bank");
  });

  it("Returns 'none' if empty account list, or no rules apply", () => {
    const fallbackAccounts: AccountWithBankDetails[] = [
      {
        id: "acc_cash",
        name: "Cash",
        currency: "EGP",
        isDefault: false,
        createdAt: baseDate,
        type: "CASH_ACCOUNT",
      },
    ];

    const input: MatchInput = {
      senderAddress: "UNKNOWN",
    };
    const result = matchAccountCore(input, fallbackAccounts);
    expect(result.matchReason).toBe("none");
  });
});
