import type { Category } from "@monyvi/db";
import type { SmsCandidate } from "@/services/ai-sms-parser-service";
import { parseSmsWithFixtureAi } from "@/services/testing/ai-sms-fixture-parser";
import { getFixtureById } from "@/services/dev/sms-fixtures";

function category(
  systemName: string,
  displayName: string,
  id = `cat-${systemName}`
): Category {
  const value: Category = { id, systemName, displayName };
  return value;
}

function candidateFromFixture(fixtureId: string): SmsCandidate {
  const fixture = getFixtureById(fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }

  return {
    message: {
      id: fixture.id,
      address: fixture.sender,
      body: fixture.body,
      date: fixture.timestamp ?? 1775658180000,
      read: false,
    },
    smsFingerprint: `fingerprint-${fixture.id}`,
  };
}

const context = {
  categories: [
    category("other", "Other"),
    category("shopping", "Shopping"),
    category("salary", "Salary"),
    category("bank_fees", "Bank Fees"),
  ],
  supportedCurrencies: ["EGP", "USD"],
};

describe("ai-sms-fixture-parser", () => {
  it("maps a known fixture to a deterministic parsed SMS transaction", async () => {
    const result = await parseSmsWithFixtureAi(
      [candidateFromFixture("nbe_debit_purchase")],
      context
    );

    expect(result.hasError).toBe(false);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      amount: 250,
      currency: "EGP",
      type: "EXPENSE",
      counterparty: "CARREFOUR CAIRO",
      categoryId: "cat-shopping",
      smsFingerprint: "fingerprint-nbe_debit_purchase",
      deduplicationHash: "fingerprint-nbe_debit_purchase",
    });
  });

  it("returns an ATM withdrawal transaction fixture with transfer metadata", async () => {
    const result = await parseSmsWithFixtureAi(
      [candidateFromFixture("qnb_atm_withdrawal")],
      context
    );

    expect(result.transactions[0]).toMatchObject({
      amount: 2000,
      isAtmWithdrawal: true,
      cardLast4: "5566",
      smsFingerprint: "fingerprint-qnb_atm_withdrawal",
    });
  });

  it("keeps multiple parsed rows for a multi-transaction fixture", async () => {
    const result = await parseSmsWithFixtureAi(
      [candidateFromFixture("multi_transaction_fee")],
      context
    );

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((tx) => tx.amount)).toEqual([850, 7.25]);
  });

  it("filters untrusted fixture output without treating it as a parser error", async () => {
    const result = await parseSmsWithFixtureAi(
      [candidateFromFixture("untrusted_offer")],
      context
    );

    expect(result).toEqual({ transactions: [], hasError: false });
  });

  it("returns retryable and permanent fixture failures for harness tests", async () => {
    await expect(
      parseSmsWithFixtureAi(
        [candidateFromFixture("retryable_ai_failure")],
        context
      )
    ).resolves.toMatchObject({
      transactions: [],
      hasError: true,
      isRetryable: true,
    });

    await expect(
      parseSmsWithFixtureAi(
        [candidateFromFixture("permanent_ai_failure")],
        context
      )
    ).resolves.toMatchObject({
      transactions: [],
      hasError: true,
      isRetryable: false,
    });
  });

  it("covers real emulator SMS bodies used by live and batch SMS E2E journeys", async () => {
    const result = await parseSmsWithFixtureAi(
      [
        candidateFromFixture("pr622_batch_duplicate_shop"),
        candidateFromFixture("background_live_sms_test"),
        candidateFromFixture("foreground_live_sms_test"),
        candidateFromFixture("background_confirm_market"),
        candidateFromFixture("closed_confirm_market"),
      ],
      context
    );

    expect(result.transactions.map((tx) => tx.counterparty)).toEqual([
      "PR622 BATCH DUPLICATE SHOP",
      "BACKGROUND LIVE SMS TEST",
      "FOREGROUND LIVE SMS TEST",
      "BACKGROUND CONFIRM MARKET",
      "CLOSED CONFIRM MARKET",
    ]);
    expect(result.transactions.map((tx) => tx.amount)).toEqual([
      33.33, 63.21, 64.32, 71.45, 72.56,
    ]);
  });
});
