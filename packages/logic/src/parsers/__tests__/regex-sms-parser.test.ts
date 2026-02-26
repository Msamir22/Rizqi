/**
 * Regex SMS Parser — Unit Tests
 *
 * Validates parsing accuracy for all 10 registered Egyptian financial
 * SMS senders. Tests cover:
 *   - Happy-path extraction (amount, type, category)
 *   - Comma-separated and decimal amounts
 *   - Arabic text passthrough (category keyword matching)
 *   - Non-financial / promotional SMS rejection
 *   - Unknown sender rejection
 *   - Transaction type accuracy (EXPENSE vs INCOME)
 *   - Category mapping accuracy (keyword > default fallback)
 *   - Amount edge cases (< 0.01 rejection, large values)
 *   - Date extraction (dd/MM, dd/MM/yy, dd/MM/yyyy, missing date)
 *   - CIB alternation pattern (amount vs amount2)
 *   - Counterparty extraction (best-effort lazy regex)
 *
 * Known Issues (tracked by tests):
 *   - Counterparty extraction uses lazy `+?` quantifier combined with
 *     optional group wrapping, which causes the regex engine to prefer
 *     matching zero characters. Tests document this as-is and flag it
 *     for future improvement (see "known regex limitation" comments).
 *
 * @module regex-sms-parser.test
 */

import { RegexSmsParser } from "../regex-sms-parser";
import type { ParsedSmsTransaction } from "../../types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const parser = new RegexSmsParser();

/**
 * Helper: assert a parsed result matches expected values.
 * Only checks fields that are provided (partial match).
 */
function expectParsed(
  result: ParsedSmsTransaction | null,
  expected: Partial<ParsedSmsTransaction>
): void {
  expect(result).not.toBeNull();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const r = result!;
  if (expected.amount !== undefined) {
    expect(r.amount).toBeCloseTo(expected.amount, 2);
  }
  if (expected.type !== undefined) {
    expect(r.type).toBe(expected.type);
  }
  if (expected.counterparty !== undefined) {
    expect(r.counterparty).toBe(expected.counterparty);
  }
  if (expected.senderDisplayName !== undefined) {
    expect(r.senderDisplayName).toBe(expected.senderDisplayName);
  }
  if (expected.senderConfigId !== undefined) {
    expect(r.senderConfigId).toBe(expected.senderConfigId);
  }
  if (expected.categorySystemName !== undefined) {
    expect(r.categorySystemName).toBe(expected.categorySystemName);
  }
  if (expected.currency !== undefined) {
    expect(r.currency).toBe(expected.currency);
  }
  // Date checks — compare day/month/year only
  if (expected.date !== undefined) {
    expect(r.date.getDate()).toBe(expected.date.getDate());
    expect(r.date.getMonth()).toBe(expected.date.getMonth());
    expect(r.date.getFullYear()).toBe(expected.date.getFullYear());
  }
}

// ===========================================================================
// 1. Instapay
// ===========================================================================

describe("Instapay", () => {
  it("parses a sent transfer with amount and type", () => {
    const result = parser.parse(
      "IPN transfer sent with amount of EGP 1,500.00 from Acc ...1234 to Mohamed Ali on 15/02",
      "Instapay"
    );
    expectParsed(result, {
      amount: 1500,
      type: "EXPENSE",
      senderConfigId: "instapay",
      senderDisplayName: "Instapay",
    });
  });

  it('parses a sent transfer with "EGP" after the amount', () => {
    const result = parser.parse(
      "IPN transfer sent with amount of 500 EGP from Acc ...5678 on 28/01",
      "IPN"
    );
    expectParsed(result, {
      amount: 500,
      type: "EXPENSE",
      senderConfigId: "instapay",
    });
  });

  it("parses a received transfer", () => {
    const result = parser.parse(
      "IPN transfer received with amount of EGP 2,000.00 to Acc ...5678 from Ahmed Hassan on 15/02",
      "IPN"
    );
    expectParsed(result, {
      amount: 2000,
      type: "INCOME",
      senderConfigId: "instapay",
    });
  });

  it("maps to 'transfers' category by default", () => {
    const result = parser.parse(
      "IPN transfer sent with amount of EGP 300.00 from Acc ...1234 to Amr Khaled on 10/03",
      "InstaPay"
    );
    expectParsed(result, {
      amount: 300,
      categorySystemName: "transfers",
    });
  });

  it("matches sender pattern variations (case-insensitive)", () => {
    const body =
      "IPN transfer sent with amount of EGP 100.00 from Acc ...1234 on 10/03";
    expect(parser.parse(body, "Instapay")).not.toBeNull();
    expect(parser.parse(body, "IPN")).not.toBeNull();
    expect(parser.parse(body, "InstaPay")).not.toBeNull();
  });
});

// ===========================================================================
// 2. NBE (National Bank of Egypt)
// ===========================================================================

describe("NBE", () => {
  it("parses a purchase: amount, type, sender", () => {
    const result = parser.parse(
      "Purchase of EGP 350.00 at Carrefour on card ending 1234 on 15/02/25",
      "NBE"
    );
    expectParsed(result, {
      amount: 350,
      type: "EXPENSE",
      senderConfigId: "nbe",
      senderDisplayName: "National Bank of Egypt",
    });
  });

  it("parses a debit transaction", () => {
    const result = parser.parse(
      "A debit transaction of EGP 1,200.00 has been made on your account",
      "NBEEG"
    );
    expectParsed(result, {
      amount: 1200,
      type: "EXPENSE",
      senderConfigId: "nbe",
    });
  });

  it("parses a credit deposit", () => {
    const result = parser.parse(
      "Credit of EGP 5,000.00 to your account ending 5678 on 15/02",
      "NBE"
    );
    expectParsed(result, {
      amount: 5000,
      type: "INCOME",
      senderConfigId: "nbe",
    });
  });

  it("parses salary deposit", () => {
    const result = parser.parse(
      "A credit/salary of EGP 12,500.00 has been deposited",
      "NBEbank"
    );
    expectParsed(result, {
      amount: 12500,
      type: "INCOME",
      categorySystemName: "banking",
    });
  });

  it("matches all sender pattern variations", () => {
    const body = "Debit of EGP 500 from your account ending 4321";
    expect(parser.parse(body, "nbe")).not.toBeNull();
    expect(parser.parse(body, "NBE")).not.toBeNull();
    expect(parser.parse(body, "NBEEG")).not.toBeNull();
    expect(parser.parse(body, "NationalBank")).not.toBeNull();
    expect(parser.parse(body, "NBEbank")).not.toBeNull();
  });
});

// ===========================================================================
// 3. CIB
// ===========================================================================

describe("CIB", () => {
  it("parses a POS purchase: amount, type, sender", () => {
    const result = parser.parse(
      "CIB: A POS purchase of EGP 1,247.50 at Amazon.eg was made on your card ending 9012 on 15/02/2025",
      "CIB"
    );
    expectParsed(result, {
      amount: 1247.5,
      type: "EXPENSE",
      senderConfigId: "cib",
      senderDisplayName: "CIB",
    });
  });

  it("parses a debit using the 'was debited' pattern (amount group)", () => {
    const result = parser.parse(
      "CIB: EGP 2,500.00 was debited from your account ending 3456",
      "CIBEgypt"
    );
    expectParsed(result, {
      amount: 2500,
      type: "EXPENSE",
      senderConfigId: "cib",
    });
  });

  it("parses a debit using the 'Debit of' pattern (amount2 group)", () => {
    const result = parser.parse(
      "CIB: Debit of EGP 800 from your account",
      "CIB"
    );
    expectParsed(result, {
      amount: 800,
      type: "EXPENSE",
      senderConfigId: "cib",
    });
  });

  it("parses a credit using 'was credited' pattern", () => {
    const result = parser.parse(
      "CIB: EGP 10,000.00 was credited to your account ending 7890",
      "CIB"
    );
    expectParsed(result, {
      amount: 10000,
      type: "INCOME",
      senderConfigId: "cib",
    });
  });

  it("maps Amazon purchase to 'online_shopping' via keyword", () => {
    const result = parser.parse(
      "CIB: A POS purchase of EGP 500.00 at Amazon.eg on your card ending 1111 on 01/03/25",
      "CIB"
    );
    expectParsed(result, {
      amount: 500,
      categorySystemName: "online_shopping",
    });
  });
});

// ===========================================================================
// 4. Vodafone Cash
// ===========================================================================

describe("Vodafone Cash", () => {
  it("parses a sent transfer: amount and type", () => {
    const result = parser.parse(
      "You have successfully sent EGP 500.00 to 01012345678",
      "VFCash"
    );
    expectParsed(result, {
      amount: 500,
      type: "EXPENSE",
      senderConfigId: "vodafone_cash",
      senderDisplayName: "Vodafone Cash",
    });
  });

  it("parses a received transfer", () => {
    const result = parser.parse(
      "You have received EGP 750.00 from 01098765432",
      "VODAFONE"
    );
    expectParsed(result, {
      amount: 750,
      type: "INCOME",
      senderConfigId: "vodafone_cash",
    });
  });

  it("parses a bill payment: amount and type", () => {
    const result = parser.parse(
      "Payment of EGP 200.00 for Electricity bill",
      "Vodafone Cash"
    );
    expectParsed(result, {
      amount: 200,
      type: "EXPENSE",
      categorySystemName: "electricity",
    });
  });

  // Both "Transferred EGP ..." and "Transfer of EGP ..." now match
  // thanks to the `transfer(?:red)?(?:\s+of)?` pattern fix.
  it("parses 'Transferred' wording", () => {
    const result = parser.parse(
      "Vodafone Cash: Transferred EGP 1,000 to Mohamed Ali",
      "VF"
    );
    expectParsed(result, {
      amount: 1000,
      type: "EXPENSE",
      senderConfigId: "vodafone_cash",
    });
  });

  it("parses 'Transfer of' wording", () => {
    const result = parser.parse(
      "Vodafone Cash: Transfer of EGP 1,000 to Mohamed Ali",
      "VF"
    );
    expectParsed(result, {
      amount: 1000,
      type: "EXPENSE",
      senderConfigId: "vodafone_cash",
    });
  });
});

// ===========================================================================
// 5. Fawry
// ===========================================================================

describe("Fawry", () => {
  it("parses a confirmed payment", () => {
    const result = parser.parse(
      "Your payment of EGP 150.00 for WE Internet bill has been confirmed. Ref: 12345678",
      "Fawry"
    );
    expectParsed(result, {
      amount: 150,
      type: "EXPENSE",
      senderConfigId: "fawry",
      senderDisplayName: "Fawry",
      categorySystemName: "internet",
    });
  });

  it("parses a paid shorthand with keyword → electricity", () => {
    const result = parser.parse(
      "Fawry: You paid EGP 350 for Electricity",
      "FAWRY"
    );
    expectParsed(result, {
      amount: 350,
      type: "EXPENSE",
      categorySystemName: "electricity",
    });
  });

  it("parses a refund as INCOME", () => {
    const result = parser.parse(
      "Your refund of EGP 200.00 has been processed",
      "FawryPay"
    );
    expectParsed(result, {
      amount: 200,
      type: "INCOME",
      senderConfigId: "fawry",
    });
  });

  it("falls back to 'bills' default category when no keyword match", () => {
    const result = parser.parse(
      "Your payment of EGP 100.00 for Other Service has been confirmed",
      "Fawry"
    );
    expectParsed(result, {
      amount: 100,
      categorySystemName: "bills",
    });
  });
});

// ===========================================================================
// 6. Etisalat Cash
// ===========================================================================

describe("Etisalat Cash", () => {
  it("parses a sent transfer", () => {
    const result = parser.parse("You sent EGP 300.00 to 01112345678", "ECash");
    expectParsed(result, {
      amount: 300,
      type: "EXPENSE",
      senderConfigId: "etisalat_cash",
      senderDisplayName: "Etisalat Cash",
    });
  });

  it("parses a received transfer", () => {
    const result = parser.parse(
      "You received EGP 400.00 from 01198765432",
      "ETISALAT"
    );
    expectParsed(result, {
      amount: 400,
      type: "INCOME",
      senderConfigId: "etisalat_cash",
    });
  });

  it("parses a bill payment for mobile → phone category", () => {
    const result = parser.parse(
      "Bill payment of EGP 250 for Mobile Recharge",
      "ET Cash"
    );
    expectParsed(result, {
      amount: 250,
      type: "EXPENSE",
      categorySystemName: "phone",
    });
  });

  it("matches all sender pattern variations", () => {
    const body = "You sent EGP 100.00 to 01000000000";
    expect(parser.parse(body, "Etisalat Cash")).not.toBeNull();
    expect(parser.parse(body, "ECash")).not.toBeNull();
    expect(parser.parse(body, "ETISALAT")).not.toBeNull();
    expect(parser.parse(body, "ET Cash")).not.toBeNull();
  });
});

// ===========================================================================
// 7. Orange Cash
// ===========================================================================

describe("Orange Cash", () => {
  it("parses a sent transfer", () => {
    const result = parser.parse(
      "You sent EGP 600.00 to 01234567890",
      "Orange Cash"
    );
    expectParsed(result, {
      amount: 600,
      type: "EXPENSE",
      senderConfigId: "orange_cash",
      senderDisplayName: "Orange Cash",
    });
  });

  it("parses a received transfer", () => {
    const result = parser.parse(
      "You received EGP 800.00 from 01298765432",
      "ORANGE"
    );
    expectParsed(result, {
      amount: 800,
      type: "INCOME",
      senderConfigId: "orange_cash",
    });
  });

  it("defaults to 'digital_wallets' category", () => {
    const result = parser.parse(
      "You sent EGP 50 to 01000000000",
      "OrangeMoney"
    );
    expectParsed(result, {
      amount: 50,
      categorySystemName: "digital_wallets",
    });
  });
});

// ===========================================================================
// 8. Banque Misr (BM)
// ===========================================================================

describe("Banque Misr", () => {
  it("parses a purchase: amount and type", () => {
    const result = parser.parse(
      "BM: Purchase of EGP 890.50 at Spinney's on card ending 5678 on 14/02/25",
      "BM"
    );
    expectParsed(result, {
      amount: 890.5,
      type: "EXPENSE",
      senderConfigId: "bm",
      senderDisplayName: "Banque Misr",
    });
  });

  it("parses an ATM withdrawal", () => {
    const result = parser.parse(
      "BM: ATM withdrawal of EGP 2,000",
      "Banque Misr"
    );
    expectParsed(result, {
      amount: 2000,
      type: "EXPENSE",
      senderConfigId: "bm",
    });
  });

  it("parses a credit deposit", () => {
    const result = parser.parse(
      "BM: Credit of EGP 15,000.00 to your account on 01/02/25",
      "BanqueMisr"
    );
    expectParsed(result, {
      amount: 15000,
      type: "INCOME",
      senderConfigId: "bm",
    });
  });
});

// ===========================================================================
// 9. QNB
// ===========================================================================

describe("QNB", () => {
  it("parses a purchase: amount and type", () => {
    const result = parser.parse(
      "QNB: Purchase of EGP 450.00 at Metro Market on 15/02/25",
      "QNB"
    );
    expectParsed(result, {
      amount: 450,
      type: "EXPENSE",
      senderConfigId: "qnb",
      senderDisplayName: "QNB",
    });
  });

  it("parses a debit", () => {
    const result = parser.parse(
      "QNB: Debit of EGP 1,500.00 from your account",
      "QNBALAHLI"
    );
    expectParsed(result, {
      amount: 1500,
      type: "EXPENSE",
      senderConfigId: "qnb",
    });
  });

  it("parses a credit", () => {
    const result = parser.parse(
      "QNB: Credit of EGP 8,000.00 to your account",
      "QNBAlahli"
    );
    expectParsed(result, {
      amount: 8000,
      type: "INCOME",
      senderConfigId: "qnb",
    });
  });

  it("maps grocery purchase to 'groceries' via keyword", () => {
    const result = parser.parse(
      "QNB: Purchase of EGP 320.00 at Supermarket Express on 10/01/25",
      "QNB"
    );
    expectParsed(result, {
      amount: 320,
      categorySystemName: "groceries",
    });
  });
});

// ===========================================================================
// 10. HSBC Egypt
// ===========================================================================

describe("HSBC Egypt", () => {
  it("parses a purchase: amount and type", () => {
    const result = parser.parse(
      "HSBC: A purchase of EGP 2,340.00 at IKEA was made on your card ending 3456",
      "HSBC"
    );
    expectParsed(result, {
      amount: 2340,
      type: "EXPENSE",
      senderConfigId: "hsbc",
      senderDisplayName: "HSBC Egypt",
    });
  });

  it("parses a debit/ATM withdrawal", () => {
    const result = parser.parse(
      "HSBC: Debit of EGP 5,000.00 from your account",
      "HSBCEgypt"
    );
    expectParsed(result, {
      amount: 5000,
      type: "EXPENSE",
      senderConfigId: "hsbc",
    });
  });

  it("parses a credit", () => {
    const result = parser.parse(
      "HSBC: Credit of EGP 20,000.00 to your account on 28/01/25",
      "HSBC EG"
    );
    expectParsed(result, {
      amount: 20000,
      type: "INCOME",
      senderConfigId: "hsbc",
    });
  });
});

// ===========================================================================
// Cross-Cutting: Amount Edge Cases
// ===========================================================================

describe("Amount Edge Cases", () => {
  it("parses comma-separated thousands (1,500.00)", () => {
    const result = parser.parse("Purchase of EGP 1,500.00 at TestShop", "NBE");
    expectParsed(result, { amount: 1500 });
  });

  it("parses large comma-separated amounts (100,000.00)", () => {
    const result = parser.parse(
      "Credit of EGP 100,000.00 to your account",
      "NBE"
    );
    expectParsed(result, { amount: 100000 });
  });

  it("parses integer amounts without decimals (500)", () => {
    const result = parser.parse("Debit of EGP 500 from your account", "NBE");
    expectParsed(result, { amount: 500 });
  });

  it("rejects amounts below 0.01", () => {
    const result = parser.parse("Purchase of EGP 0.00 at SomePlace", "NBE");
    expect(result).toBeNull();
  });

  it("parses small fractional amounts (0.50)", () => {
    const result = parser.parse(
      "Purchase of EGP 0.50 at VendingMachine",
      "NBE"
    );
    expectParsed(result, { amount: 0.5 });
  });
});

// ===========================================================================
// Cross-Cutting: Date Extraction
// ===========================================================================

describe("Date Extraction", () => {
  // NOTE: Date extraction for bank purchase patterns (NBE, CIB, etc.) does not
  // reliably capture the date because the lazy counterparty group `[^,\n]+?`
  // and the optional outer wrappers cause the date group to not fire. The
  // parser falls back to current date in these cases. This is a known
  // limitation of the lazy regex approach.

  it("falls back to current date when no date in SMS", () => {
    const result = parser.parse("Debit of EGP 400 from your account", "NBE");
    const now = new Date();
    expect(result).not.toBeNull();
    // Same day (can be flaky near midnight, but acceptable)
    expect(result!.date.getDate()).toBe(now.getDate());
    expect(result!.date.getMonth()).toBe(now.getMonth());
  });

  it("extracts date from bank purchase patterns", () => {
    // After regex fix, the date group now correctly captures from purchase SMS.
    const result = parser.parse(
      "Purchase of EGP 200.00 at Shop on card ending 1234 on 01/12/24",
      "NBE"
    );
    expect(result).not.toBeNull();
    expect(result!.date.getDate()).toBe(1);
    expect(result!.date.getMonth()).toBe(11); // December = 11 (0-indexed)
  });
});

// ===========================================================================
// Cross-Cutting: Category Keyword Mapping
// ===========================================================================

describe("Category Keyword Mapping", () => {
  it("maps 'Electricity' keyword → electricity category", () => {
    const result = parser.parse(
      "Your payment of EGP 150.00 for Electricity has been confirmed",
      "Fawry"
    );
    expectParsed(result, { amount: 150, categorySystemName: "electricity" });
  });

  it("maps 'Uber' keyword → ride_hailing category (via purchase)", () => {
    const result = parser.parse(
      "Purchase of EGP 85.00 at Uber on card ending 1234",
      "NBE"
    );
    expectParsed(result, { amount: 85, categorySystemName: "ride_hailing" });
  });

  it("maps 'Pharmacy' keyword → pharmacy category (via purchase)", () => {
    const result = parser.parse(
      "Purchase of EGP 120.00 at El-Ezaby Pharmacy on card ending 5678",
      "CIB"
    );
    expectParsed(result, { amount: 120, categorySystemName: "pharmacy" });
  });

  it("maps Arabic 'مطعم' (restaurant) keyword → restaurants category", () => {
    const result = parser.parse(
      "Purchase of EGP 250.00 at مطعم الكبير on card ending 9999",
      "NBE"
    );
    expectParsed(result, { amount: 250, categorySystemName: "restaurants" });
  });

  it("maps 'Netflix' keyword → subscriptions category", () => {
    const result = parser.parse(
      "Purchase of EGP 199.00 at Netflix on card ending 2222",
      "HSBC"
    );
    expectParsed(result, { amount: 199, categorySystemName: "subscriptions" });
  });

  it("maps Arabic 'بنزين' (fuel) keyword → fuel category", () => {
    const result = parser.parse(
      "Purchase of EGP 300.00 at محطة بنزين on card ending 8888",
      "QNB"
    );
    expectParsed(result, { amount: 300, categorySystemName: "fuel" });
  });

  it("falls back to sender default when no keyword matches", () => {
    const result = parser.parse(
      "Purchase of EGP 50.00 at UnknownPlace on card ending 0000",
      "NBE"
    );
    expectParsed(result, { amount: 50, categorySystemName: "banking" });
  });

  it("falls back to 'digital_wallets' for Vodafone with no keyword", () => {
    const result = parser.parse(
      "You have successfully sent EGP 100.00 to 01000000000",
      "VFCash"
    );
    expectParsed(result, {
      amount: 100,
      categorySystemName: "digital_wallets",
    });
  });
});

// ===========================================================================
// Cross-Cutting: Rejection Cases (False Positive Prevention)
// ===========================================================================

describe("Rejection: Non-Financial SMS", () => {
  it("rejects unknown sender", () => {
    const result = parser.parse(
      "Purchase of EGP 500 at someplace",
      "UnknownBank"
    );
    expect(result).toBeNull();
  });

  it("rejects promotional SMS with 'offer' keyword", () => {
    const result = parser.parse(
      "Special offer! Get EGP 500 cashback on your next purchase of EGP 1,000",
      "NBE"
    );
    expect(result).toBeNull();
  });

  it("rejects promotional SMS with 'congratulations' keyword", () => {
    const result = parser.parse(
      "Congratulations! You won EGP 5,000 in our draw. Purchase of EGP 100 required.",
      "CIB"
    );
    expect(result).toBeNull();
  });

  it("rejects promotional SMS with 'click here' keyword", () => {
    const result = parser.parse(
      "Activate now! Click here to purchase EGP 200 worth of rewards.",
      "NBE"
    );
    expect(result).toBeNull();
  });

  it("rejects promotional SMS with Arabic 'عرض خاص' keyword", () => {
    const result = parser.parse(
      "عرض خاص: Purchase of EGP 100.00 for limited deal",
      "NBE"
    );
    expect(result).toBeNull();
  });

  it("rejects SMS body that does not match any template pattern", () => {
    const result = parser.parse("Your account balance is EGP 15,000.00", "NBE");
    expect(result).toBeNull();
  });

  it("rejects SMS with matching pattern but zero amount", () => {
    const result = parser.parse("Purchase of EGP 0.00 at SomeMerchant", "NBE");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// Cross-Cutting: Output Shape Validation
// ===========================================================================

describe("Output Shape", () => {
  it("always returns currency as 'EGP'", () => {
    const result = parser.parse(
      "Purchase of EGP 100.00 at TestShop on card ending 1234 on 01/01/25",
      "NBE"
    );
    expectParsed(result, { amount: 100, currency: "EGP" });
  });

  it("always returns smsBodyHash as empty string (computed later)", () => {
    const result = parser.parse("Purchase of EGP 100.00 at TestShop", "NBE");
    expect(result).not.toBeNull();
    expect(result!.smsBodyHash).toBe("");
  });

  it("always returns confidence as 0.85", () => {
    const result = parser.parse("Purchase of EGP 100.00 at TestShop", "NBE");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(0.85);
  });

  it("stores the raw SMS body", () => {
    const body = "Purchase of EGP 100.00 at TestShop";
    const result = parser.parse(body, "NBE");
    expect(result).not.toBeNull();
    expect(result!.rawSmsBody).toBe(body);
  });

  it("stores the sender address as-is", () => {
    const result = parser.parse("Purchase of EGP 100.00 at TestShop", "NBE");
    expect(result).not.toBeNull();
    expect(result!.senderAddress).toBe("NBE");
  });
});

// ===========================================================================
// Counterparty Extraction — Known Limitations
// ===========================================================================

describe("Counterparty Extraction", () => {
  it("extracts counterparty from purchase patterns", () => {
    const result = parser.parse(
      "Purchase of EGP 350.00 at Carrefour on card ending 1234 on 15/02/25",
      "NBE"
    );
    expect(result).not.toBeNull();
    expect(result!.counterparty).toBe("Carrefour");
  });

  it("extracts counterparty from Fawry for-pattern", () => {
    const result = parser.parse(
      "Your payment of EGP 150.00 for WE Internet bill has been confirmed",
      "Fawry"
    );
    expect(result).not.toBeNull();
    expect(result!.counterparty).toBe("WE Internet bill");
  });
});
