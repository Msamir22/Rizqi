import type { ParsedSmsTransaction } from "@monyvi/logic";

let mockRegisteredHandler:
  | ((
      actionId: string,
      payload: TransactionNotificationPayload
    ) => Promise<void>)
  | null = null;

interface TransactionNotificationPayload {
  readonly type: "sms_transaction";
  readonly transactionData: ParsedSmsTransaction;
  readonly resolvedAccountId: string;
  readonly resolvedAccountName: string;
}

type NotificationActionHandler = (
  actionId: string,
  payload: TransactionNotificationPayload
) => Promise<void>;

interface SmsAtmTransferResult {
  readonly success: boolean;
}

const mockCreateTransaction = jest.fn<Promise<unknown>, [unknown]>();
const mockCreateSmsAtmTransfer = jest.fn<
  Promise<SmsAtmTransferResult>,
  [unknown]
>();
const mockHasExistingSmsBodyHash = jest.fn<Promise<boolean>, [string]>();

jest.mock("@/services/notification-service", () => ({
  ACTION_CONFIRM: "CONFIRM",
  registerNotificationActionHandler: jest.fn(
    (handler: NotificationActionHandler) => {
      mockRegisteredHandler = handler;
      return jest.fn();
    }
  ),
  showTransactionNotification: jest.fn(),
}));

jest.mock("@/services/sms-account-resolver", () => ({
  resolveAccountForSms: jest.fn(),
}));

jest.mock("@/services/sms-dedup-service", () => ({
  hasExistingSmsBodyHash: (smsBodyHash: string): Promise<boolean> =>
    mockHasExistingSmsBodyHash(smsBodyHash),
}));

jest.mock("@/services/transaction-service", () => ({
  createTransaction: (input: unknown): Promise<unknown> =>
    mockCreateTransaction(input),
}));

jest.mock("@/services/transfer-service", () => ({
  createSmsAtmTransfer: (input: unknown): Promise<SmsAtmTransferResult> =>
    mockCreateSmsAtmTransfer(input),
}));

import { initializeDetectionActionHandler } from "@/services/sms-live-detection-handler";

function createParsedSmsTransaction(): ParsedSmsTransaction {
  return {
    amount: 413,
    currency: "EGP",
    type: "EXPENSE",
    counterparty: "LIVE TEST MARKET",
    date: new Date("2026-05-03T12:00:00.000Z"),
    categoryId: "category-1",
    categoryDisplayName: "Shopping",
    confidence: 0.95,
    originLabel: "NBE",
    source: "SMS",
    smsBodyHash: "hash-1",
    senderDisplayName: "NBE",
    rawSmsBody: "Purchase EGP 413.00 at LIVE TEST MARKET",
  };
}

function createPayload(
  transactionData = createParsedSmsTransaction()
): TransactionNotificationPayload {
  return {
    type: "sms_transaction",
    transactionData,
    resolvedAccountId: "account-1",
    resolvedAccountName: "MainCIBAccount",
  };
}

describe("sms-live-detection-handler notification actions", () => {
  beforeEach(() => {
    mockRegisteredHandler = null;
    mockHasExistingSmsBodyHash.mockReset();
    mockHasExistingSmsBodyHash.mockResolvedValue(false);
    mockCreateTransaction.mockReset();
    mockCreateTransaction.mockResolvedValue({});
    mockCreateSmsAtmTransfer.mockReset();
    mockCreateSmsAtmTransfer.mockResolvedValue({ success: true });
  });

  it("passes the SMS body hash when confirming a regular SMS transaction", async () => {
    initializeDetectionActionHandler();

    await mockRegisteredHandler?.("CONFIRM", createPayload());

    expect(mockCreateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "SMS",
        smsBodyHash: "hash-1",
      })
    );
  });

  it("does not save again when an SMS hash already exists", async () => {
    mockHasExistingSmsBodyHash.mockResolvedValueOnce(true);
    initializeDetectionActionHandler();

    await mockRegisteredHandler?.("CONFIRM", createPayload());

    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(mockCreateSmsAtmTransfer).not.toHaveBeenCalled();
  });
});
