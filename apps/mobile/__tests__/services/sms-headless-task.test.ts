import type { ParsedSmsTransaction } from "@monyvi/logic";

const mockRegisterHeadlessTask = jest.fn<
  void,
  [string, () => () => Promise<void>]
>();
const mockProcessLiveSmsEvent = jest.fn<Promise<unknown>, unknown[]>();
const mockHandleDetectedSms = jest.fn<Promise<void>, [ParsedSmsTransaction]>();

jest.mock("react-native", () => ({
  AppRegistry: {
    registerHeadlessTask: (
      taskName: string,
      taskProvider: () => () => Promise<void>
    ): void => mockRegisterHeadlessTask(taskName, taskProvider),
  },
}));

jest.mock("@/services/sms-live-processor", () => ({
  processLiveSmsEvent: (...args: unknown[]): Promise<unknown> =>
    mockProcessLiveSmsEvent(...args),
}));

jest.mock("@/services/sms-live-detection-handler", () => ({
  handleDetectedSms: (parsed: ParsedSmsTransaction): Promise<void> =>
    mockHandleDetectedSms(parsed),
}));

import { registerSmsHeadlessTask } from "@/services/sms-headless-task";
import HeadlessJsTaskError from "react-native/Libraries/ReactNative/HeadlessJsTaskError";

function createParsedTransaction(): ParsedSmsTransaction {
  return {
    amount: 7.25,
    currency: "EGP",
    type: "EXPENSE",
    counterparty: "DOUBLE CONFIRM TEST",
    date: new Date("2026-05-10T12:00:00.000Z"),
    categoryId: "category-1",
    categoryDisplayName: "Shopping",
    confidence: 0.94,
    originLabel: "NBE",
    source: "SMS",
    smsBodyHash: "hash-headless",
    senderDisplayName: "NBE",
    rawSmsBody:
      "Purchase EGP 7.25 at DOUBLE CONFIRM TEST using card ending 1234",
  };
}

function getRegisteredTask(): (taskData: {
  readonly sender: string;
  readonly body: string;
  readonly timestamp: number;
}) => Promise<void> {
  registerSmsHeadlessTask();
  return mockRegisterHeadlessTask.mock.calls[0][1]();
}

describe("sms-headless-task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates killed-app SMS processing to the shared AI live processor", async () => {
    const parsed = createParsedTransaction();
    mockProcessLiveSmsEvent.mockResolvedValue({
      status: "parsed",
      smsBodyHash: "hash-headless",
      transactions: [parsed],
    });
    const task = getRegisteredTask();

    await task({
      sender: "NBE",
      body: "Purchase EGP 7.25 at DOUBLE CONFIRM TEST using card ending 1234",
      timestamp: 1778414400000,
    });

    expect(mockProcessLiveSmsEvent).toHaveBeenCalledWith({
      sender: "NBE",
      body: "Purchase EGP 7.25 at DOUBLE CONFIRM TEST using card ending 1234",
      timestamp: 1778414400000,
      deliveryMode: "headless",
    });
    expect(mockHandleDetectedSms).toHaveBeenCalledWith(parsed);
  });

  it("throws a HeadlessJsTaskError when AI parsing should be retried", async () => {
    mockProcessLiveSmsEvent.mockResolvedValue({
      status: "ai_failed",
      smsBodyHash: "hash-headless",
      transactions: [],
    });
    const task = getRegisteredTask();

    await expect(
      task({
        sender: "NBE",
        body: "Purchase EGP 7.25 at DOUBLE CONFIRM TEST using card ending 1234",
        timestamp: 1778414400000,
      })
    ).rejects.toBeInstanceOf(HeadlessJsTaskError);
    expect(mockHandleDetectedSms).not.toHaveBeenCalled();
  });

  it("does not retry permanent AI parsing failures", async () => {
    mockProcessLiveSmsEvent.mockResolvedValue({
      status: "ai_failed",
      smsBodyHash: "hash-headless",
      isRetryable: false,
      transactions: [],
    });
    const task = getRegisteredTask();

    await expect(
      task({
        sender: "NBE",
        body: "Purchase EGP 7.25 at DOUBLE CONFIRM TEST using card ending 1234",
        timestamp: 1778414400000,
      })
    ).resolves.toBeUndefined();
    expect(mockHandleDetectedSms).not.toHaveBeenCalled();
  });

  it("does not retry infrastructure failures", async () => {
    mockProcessLiveSmsEvent.mockResolvedValue({
      status: "infrastructure_error",
      transactions: [],
    });
    const task = getRegisteredTask();

    await expect(
      task({
        sender: "NBE",
        body: "Purchase EGP 7.25 at DOUBLE CONFIRM TEST using card ending 1234",
        timestamp: 1778414400000,
      })
    ).resolves.toBeUndefined();
    expect(mockHandleDetectedSms).not.toHaveBeenCalled();
  });
});
