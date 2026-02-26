/**
 * sms-sync-service.test.ts — T020
 *
 * Tests the `scanAndParseSms` and `cleanupStaleScanState` functions from
 * sms-sync-service.ts.
 *
 * Mock Strategy:
 *   - `sms-reader-service` is mocked to return controlled SMS messages
 *   - `@astik/logic` is partially mocked (RegexSmsParser + computeSmsHash)
 *   - `@react-native-async-storage/async-storage` is mocked for scan guard
 *   - `InteractionManager` is mocked via react-native
 */

import type { ParsedSmsTransaction, SmsMessage } from "@astik/logic";

// ---------------------------------------------------------------------------
// Mock: AsyncStorage (inline factory to avoid hoisting issues)
// ---------------------------------------------------------------------------

jest.mock("@react-native-async-storage/async-storage", () => {
  const setItem = jest.fn((): Promise<void> => Promise.resolve());
  const getItem = jest.fn((): Promise<string | null> => Promise.resolve(null));
  const removeItem = jest.fn((): Promise<void> => Promise.resolve());
  return {
    __esModule: true,
    default: { setItem, getItem, removeItem },
    __mocks: { setItem, getItem, removeItem },
  };
});

/** Shape of the mocked AsyncStorage module for typed access. */
interface AsyncStorageMockModule {
  __esModule: boolean;
  default: {
    setItem: jest.Mock;
    getItem: jest.Mock;
    removeItem: jest.Mock;
  };
  __mocks: {
    setItem: jest.Mock;
    getItem: jest.Mock;
    removeItem: jest.Mock;
  };
}

/** Typed access to the AsyncStorage mock fns for assertions. */
function getAsyncStorageMocks(): {
  setItem: jest.Mock;
  getItem: jest.Mock;
  removeItem: jest.Mock;
} {
  return jest.requireMock<AsyncStorageMockModule>(
    "@react-native-async-storage/async-storage"
  ).__mocks;
}

// ---------------------------------------------------------------------------
// Mock: react-native (InteractionManager + Platform)
// ---------------------------------------------------------------------------

jest.mock("react-native", () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((cb: () => void) => {
      cb();
      return { cancel: jest.fn() };
    }),
  },
  Platform: { OS: "android" },
}));

// ---------------------------------------------------------------------------
// Mock: sms-reader-service
// ---------------------------------------------------------------------------

const mockReadSmsInbox = jest.fn<Promise<readonly SmsMessage[]>, []>(() =>
  Promise.resolve([])
);

jest.mock("@/services/sms-reader-service", () => ({
  readSmsInbox: (...args: unknown[]) => mockReadSmsInbox(...(args as [])),
}));

// ---------------------------------------------------------------------------
// Mock: @astik/logic (RegexSmsParser + computeSmsHash)
// ---------------------------------------------------------------------------

const mockParse = jest.fn<ParsedSmsTransaction | null, [string, string]>(
  () => null
);
const mockComputeSmsHash = jest.fn<Promise<string>, [string]>((body: string) =>
  Promise.resolve(`hash-${body.slice(0, 10)}`)
);

jest.mock("@astik/logic", () => ({
  RegexSmsParser: jest.fn().mockImplementation(() => ({
    parse: mockParse,
  })),
  computeSmsHash: (...args: unknown[]) =>
    mockComputeSmsHash(...(args as [string])),
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import {
  scanAndParseSms,
  cleanupStaleScanState,
} from "@/services/sms-sync-service";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createSmsMessage(overrides: Partial<SmsMessage> = {}): SmsMessage {
  return {
    id: `sms-${Date.now()}-${Math.random()}`,
    address: "NBE",
    body: "Purchase of EGP 100.00 at TestShop on card ending 1234",
    date: Date.now(),
    read: true,
    ...overrides,
  };
}

function createParsedTransaction(
  overrides: Partial<ParsedSmsTransaction> = {}
): ParsedSmsTransaction {
  return {
    amount: 100,
    currency: "EGP",
    type: "EXPENSE",
    counterparty: "TestShop",
    date: new Date(),
    smsBodyHash: "",
    senderAddress: "NBE",
    senderDisplayName: "NBE",
    senderConfigId: "nbe",
    categorySystemName: "bank_fees",
    rawSmsBody: "Purchase of EGP 100.00 at TestShop",
    confidence: 0.85,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sms-sync-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadSmsInbox.mockResolvedValue([]);
    mockParse.mockReturnValue(null);
    mockComputeSmsHash.mockImplementation((body: string) =>
      Promise.resolve(`hash-${body.slice(0, 10)}`)
    );
  });

  // =========================================================================
  // scanAndParseSms — Core Pipeline
  // =========================================================================
  describe("scanAndParseSms", () => {
    it("should return empty result for an empty inbox", async () => {
      mockReadSmsInbox.mockResolvedValue([]);

      const result = await scanAndParseSms();

      expect(result.transactions).toHaveLength(0);
      expect(result.totalScanned).toBe(0);
      expect(result.totalFound).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should parse financial SMS and include in results", async () => {
      const sms1 = createSmsMessage({
        body: "Purchase of EGP 100.00 at Carrefour",
      });
      const sms2 = createSmsMessage({
        address: "VF",
        body: "Sent EGP 500 to 01012345678",
      });
      mockReadSmsInbox.mockResolvedValue([sms1, sms2]);

      const parsed1 = createParsedTransaction({
        amount: 100,
        counterparty: "Carrefour",
        rawSmsBody: sms1.body,
      });
      const parsed2 = createParsedTransaction({
        amount: 500,
        type: "EXPENSE",
        senderAddress: "VF",
        rawSmsBody: sms2.body,
      });
      mockParse.mockReturnValueOnce(parsed1).mockReturnValueOnce(parsed2);

      const result = await scanAndParseSms();

      expect(result.totalScanned).toBe(2);
      expect(result.totalFound).toBe(2);
      expect(result.transactions).toHaveLength(2);
    });

    it("should skip SMS that do not match any parser pattern", async () => {
      const financial = createSmsMessage({
        body: "Purchase of EGP 200 at Shop",
      });
      const promo = createSmsMessage({
        address: "UNKNOWN",
        body: "Click here for a special offer!",
      });
      mockReadSmsInbox.mockResolvedValue([financial, promo]);

      const parsed = createParsedTransaction({ amount: 200 });
      mockParse
        .mockReturnValueOnce(parsed) // financial → parsed
        .mockReturnValueOnce(null); // promo → null

      const result = await scanAndParseSms();

      expect(result.totalScanned).toBe(2);
      expect(result.totalFound).toBe(1);
      expect(result.transactions).toHaveLength(1);
    });

    it("should deduplicate against existing hashes", async () => {
      const sms1 = createSmsMessage({ body: "Debit EGP 100" });
      const sms2 = createSmsMessage({ body: "Debit EGP 200" });
      mockReadSmsInbox.mockResolvedValue([sms1, sms2]);

      mockParse
        .mockReturnValueOnce(createParsedTransaction({ amount: 100 }))
        .mockReturnValueOnce(createParsedTransaction({ amount: 200 }));

      // hash for sms1 matches an existing hash
      mockComputeSmsHash
        .mockResolvedValueOnce("existing-hash-1")
        .mockResolvedValueOnce("new-hash-2");

      const existingHashes = new Set(["existing-hash-1"]);

      const result = await scanAndParseSms(undefined, { existingHashes });

      expect(result.totalFound).toBe(1);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].smsBodyHash).toBe("new-hash-2");
    });

    it("should enrich transactions with computed hash and SMS date", async () => {
      const smsDate = new Date("2026-01-15T10:30:00Z").getTime();
      const sms = createSmsMessage({ body: "Credit EGP 500", date: smsDate });
      mockReadSmsInbox.mockResolvedValue([sms]);

      mockParse.mockReturnValueOnce(
        createParsedTransaction({ amount: 500, smsBodyHash: "" })
      );
      mockComputeSmsHash.mockResolvedValueOnce("computed-hash-abc");

      const result = await scanAndParseSms();

      expect(result.transactions).toHaveLength(1);
      const tx = result.transactions[0];
      expect(tx.smsBodyHash).toBe("computed-hash-abc");
      expect(tx.date.getTime()).toBe(smsDate);
    });

    it("should pass maxCount and minDate to readSmsInbox", async () => {
      mockReadSmsInbox.mockResolvedValue([]);

      const minDate = Date.now() - 86_400_000;
      await scanAndParseSms(undefined, { maxCount: 100, minDate });

      expect(mockReadSmsInbox).toHaveBeenCalledWith({
        maxCount: 100,
        minDate,
      });
    });

    it("should use default maxCount (5000) when not specified", async () => {
      mockReadSmsInbox.mockResolvedValue([]);

      await scanAndParseSms();

      expect(mockReadSmsInbox).toHaveBeenCalledWith(
        expect.objectContaining({ maxCount: 5000 })
      );
    });
  });

  // =========================================================================
  // scanAndParseSms — Progress Callback
  // =========================================================================
  describe("progress callback", () => {
    it("should invoke onProgress after each batch", async () => {
      // Create 3 SMS; batchSize=2 → 2 progress calls (batch of 2 + batch of 1)
      const messages = [
        createSmsMessage({ body: "SMS 1" }),
        createSmsMessage({ body: "SMS 2" }),
        createSmsMessage({ body: "SMS 3" }),
      ];
      mockReadSmsInbox.mockResolvedValue(messages);
      mockParse.mockReturnValue(null);

      const onProgress = jest.fn();
      await scanAndParseSms(onProgress, { batchSize: 2 });

      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it("should report accurate progress values", async () => {
      const sms1 = createSmsMessage({
        address: "NBE",
        body: "Purchase EGP 100 at Shop",
      });
      const sms2 = createSmsMessage({ address: "CIB", body: "Random promo" });
      mockReadSmsInbox.mockResolvedValue([sms1, sms2]);

      mockParse
        .mockReturnValueOnce(createParsedTransaction({ amount: 100 }))
        .mockReturnValueOnce(null);

      const onProgress = jest.fn();
      await scanAndParseSms(onProgress, { batchSize: 2 });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          totalMessages: 2,
          messagesScanned: 2,
          transactionsFound: 1,
        })
      );
    });

    it("should not throw if onProgress is undefined", async () => {
      mockReadSmsInbox.mockResolvedValue([createSmsMessage()]);
      mockParse.mockReturnValue(null);

      await expect(scanAndParseSms(undefined)).resolves.toBeDefined();
    });
  });

  // =========================================================================
  // scanAndParseSms — UI Thread Yielding
  // =========================================================================
  describe("UI thread yielding", () => {
    it("should yield to InteractionManager after yieldInterval batches", async () => {
      const { InteractionManager } = jest.requireMock<{
        InteractionManager: { runAfterInteractions: jest.Mock };
      }>("react-native");

      // 6 messages, batchSize=1, yieldInterval=2 → yield at batch 2, 4, 6
      const messages = Array.from({ length: 6 }, (_, i) =>
        createSmsMessage({ body: `SMS ${i}` })
      );
      mockReadSmsInbox.mockResolvedValue(messages);
      mockParse.mockReturnValue(null);

      await scanAndParseSms(undefined, {
        batchSize: 1,
        yieldInterval: 2,
      });

      expect(InteractionManager.runAfterInteractions).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // scanAndParseSms — Scan Guard (AsyncStorage flag)
  // =========================================================================
  describe("scan guard", () => {
    it("should set scan-in-progress flag before scanning", async () => {
      mockReadSmsInbox.mockResolvedValue([]);

      await scanAndParseSms();

      const { setItem } = getAsyncStorageMocks();
      expect(setItem).toHaveBeenCalledWith(
        "@astik/sms_scan_in_progress",
        "true"
      );
    });

    it("should clear scan-in-progress flag after successful scan", async () => {
      mockReadSmsInbox.mockResolvedValue([]);

      await scanAndParseSms();

      const { removeItem } = getAsyncStorageMocks();
      expect(removeItem).toHaveBeenCalledWith("@astik/sms_scan_in_progress");
    });

    it("should clear scan-in-progress flag even if scan throws", async () => {
      mockReadSmsInbox.mockRejectedValue(new Error("SMS read failed"));

      await expect(scanAndParseSms()).rejects.toThrow("SMS read failed");

      const { removeItem } = getAsyncStorageMocks();
      expect(removeItem).toHaveBeenCalledWith("@astik/sms_scan_in_progress");
    });
  });

  // =========================================================================
  // cleanupStaleScanState
  // =========================================================================
  describe("cleanupStaleScanState", () => {
    it("should return true and remove flag when stale state exists", async () => {
      const { getItem, removeItem } = getAsyncStorageMocks();
      getItem.mockResolvedValueOnce("true");

      const wasStale = await cleanupStaleScanState();

      expect(wasStale).toBe(true);
      expect(removeItem).toHaveBeenCalledWith("@astik/sms_scan_in_progress");
    });

    it("should return false when no stale state", async () => {
      const { getItem, removeItem } = getAsyncStorageMocks();
      getItem.mockResolvedValueOnce(null);

      const wasStale = await cleanupStaleScanState();

      expect(wasStale).toBe(false);
      expect(removeItem).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // scanAndParseSms — Result Shape
  // =========================================================================
  describe("result shape", () => {
    it("should return readonly transactions array", async () => {
      mockReadSmsInbox.mockResolvedValue([createSmsMessage()]);
      mockParse.mockReturnValue(createParsedTransaction());

      const result = await scanAndParseSms();

      expect(Array.isArray(result.transactions)).toBe(true);
      expect(typeof result.totalScanned).toBe("number");
      expect(typeof result.totalFound).toBe("number");
      expect(typeof result.durationMs).toBe("number");
    });

    it("should measure duration in milliseconds", async () => {
      mockReadSmsInbox.mockResolvedValue([]);

      const result = await scanAndParseSms();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(5000); // sanity bound
    });
  });
});
