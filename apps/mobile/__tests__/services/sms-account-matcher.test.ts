import {
  matchAccountCore,
  matchTransaction,
  matchTransactionsBatched,
  type AccountMatch,
  type AccountWithBankDetails,
  type MatchInput,
} from "../../services/sms-account-matcher";
import type { ReviewableTransaction } from "@monyvi/logic";

jest.mock("@monyvi/db", () => ({
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
    type: "BANK",
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
    type: "BANK",
    smsSenderName: "NBE",
    cardLast4: "5678",
  };

  const accBank3: AccountWithBankDetails = {
    id: "acc_bank3",
    name: "Banque Misr",
    currency: "EGP",
    isDefault: false,
    createdAt: new Date(baseDate.getTime() - 1000), // Created first (for Step 5)
    type: "BANK", // maps to Step 5 fallback
  };

  const accounts: AccountWithBankDetails[] = [accBank1, accBank2, accBank3];

  it("Step 1: Matches based on card last 4 AND sender match (highest confidence)", () => {
    const input: MatchInput = {
      senderDisplayName: "CIB-EGYPT", // Matches "CIB" bidirectionally
      cardLast4: "1234",
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank1");
    expect(result.matchReason).toBe("card_last4");
  });

  it("Step 1b: Matches based on card last 4 alone if sender doesn't match", () => {
    const input: MatchInput = {
      senderDisplayName: "UNKNOWN SENDER xyz",
      cardLast4: "1234", // Matches accBank1
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank1");
    expect(result.matchReason).toBe("card_last4");
  });

  it("Step 2: Matches based on sender alone (bank_details / account name)", () => {
    const input: MatchInput = {
      senderDisplayName: "NBE",
      // No card last 4
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank2");
    expect(result.matchReason).toBe("sms_sender");
  });

  it("Step 3: Matches based on bank registry name and currency", () => {
    const input: MatchInput = {
      senderDisplayName: "BANQUEMISR", // Known financial sender mapped to "Banque Misr"
      currency: "EGP",
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank3");
    expect(result.matchReason).toBe("bank_registry");
  });

  it("Step 4: Falls back to default account if NO other match and not a known bank", () => {
    const input: MatchInput = {
      senderDisplayName: "RANDOM_STORE",
      currency: "EGP",
    };
    const result = matchAccountCore(input, accounts);
    expect(result.accountId).toBe("acc_bank2"); // accBank2 is default
    expect(result.matchReason).toBe("default");
  });

  it("Step 5: Returns 'none' if no default and no match (first_bank fallback removed)", () => {
    // Remove the default account and ensure they are sorted by createdAt ASC like fetchAccountsWithDetails does
    const accountsNoDefault = [accBank3, accBank1];
    const input: MatchInput = {
      senderDisplayName: "RANDOM_STORE",
    };
    const result = matchAccountCore(input, accountsNoDefault);
    // first_bank fallback was removed — user must explicitly select
    expect(result.accountId).toBe(null);
    expect(result.matchReason).toBe("none");
  });

  it("Returns 'none' if empty account list, or no rules apply", () => {
    const fallbackAccounts: AccountWithBankDetails[] = [
      {
        id: "acc_cash",
        name: "Cash",
        currency: "EGP",
        isDefault: false,
        createdAt: baseDate,
        type: "CASH",
      },
    ];

    const input: MatchInput = {
      senderDisplayName: "UNKNOWN",
    };
    const result = matchAccountCore(input, fallbackAccounts);
    expect(result.matchReason).toBe("none");

    // Also verify empty account list returns "none"
    const emptyResult = matchAccountCore(input, []);
    expect(emptyResult.matchReason).toBe("none");
    expect(emptyResult.accountId).toBe(null);
  });
});

describe("sms-account-matcher - source-aware transaction matching", () => {
  const baseDate = new Date("2026-01-01T00:00:00Z");

  const cashDefault: AccountWithBankDetails = {
    id: "acc_cash_default",
    name: "Cash",
    currency: "EGP",
    isDefault: true,
    createdAt: baseDate,
    type: "CASH",
  };

  const bankDefault: AccountWithBankDetails = {
    id: "acc_bank_default",
    name: "CIB Main",
    currency: "EGP",
    isDefault: true,
    createdAt: new Date(baseDate.getTime() + 1000),
    type: "BANK",
  };

  const bankRegular: AccountWithBankDetails = {
    id: "acc_bank_regular",
    name: "NBE",
    currency: "EGP",
    isDefault: false,
    createdAt: new Date(baseDate.getTime() + 2000),
    type: "BANK",
  };

  function tx(
    overrides: Partial<ReviewableTransaction> = {}
  ): ReviewableTransaction {
    return {
      amount: 100,
      currency: "EGP",
      type: "EXPENSE",
      date: baseDate,
      categoryId: "cat-1",
      categoryDisplayName: "Other",
      confidence: 0.9,
      originLabel: "UNKNOWN",
      source: "SMS",
      ...overrides,
    };
  }

  it("keeps SMS fallback bank-scoped and ignores a default cash account", () => {
    const result = matchTransaction(tx(), [cashDefault, bankRegular]);

    expect(result.accountId).toBe(null);
    expect(result.matchReason).toBe("none");
  });

  it("allows SMS fallback to a default bank account", () => {
    const result = matchTransaction(tx(), [cashDefault, bankDefault]);

    expect(result.accountId).toBe("acc_bank_default");
    expect(result.matchReason).toBe("default");
  });

  it("keeps batched SMS review bank-scoped even when preloaded accounts include cash", async () => {
    const batches: Array<ReadonlyMap<number, AccountMatch>> = [];

    await matchTransactionsBatched(
      [tx()],
      "user-1",
      20,
      (batch) => batches.push(batch),
      [cashDefault, bankRegular]
    );

    expect(batches).toHaveLength(1);
    expect(batches[0].get(0)?.accountId).toBe(null);
    expect(batches[0].get(0)?.matchReason).toBe("none");
  });

  it("uses a valid AI account id for voice transactions", () => {
    const result = matchTransaction(
      tx({ source: "VOICE", accountId: "acc_bank_regular" }),
      [cashDefault, bankRegular]
    );

    expect(result.accountId).toBe("acc_bank_regular");
    expect(result.matchReason).toBe("voice_ai");
  });

  it("allows voice AI selection to target non-bank accounts", () => {
    const result = matchTransaction(
      tx({ source: "VOICE", accountId: "acc_cash_default" }),
      [cashDefault, bankRegular]
    );

    expect(result.accountId).toBe("acc_cash_default");
    expect(result.matchReason).toBe("voice_ai");
  });

  it("falls voice transactions back to the global default account", () => {
    const result = matchTransaction(tx({ source: "VOICE" }), [
      cashDefault,
      bankRegular,
    ]);

    expect(result.accountId).toBe("acc_cash_default");
    expect(result.matchReason).toBe("default");
  });

  it("requires review when voice has no valid AI account and no default account", () => {
    const result = matchTransaction(
      tx({ source: "VOICE", accountId: "missing-account" }),
      [bankRegular]
    );

    expect(result.accountId).toBe(null);
    expect(result.matchReason).toBe("none");
  });
});
