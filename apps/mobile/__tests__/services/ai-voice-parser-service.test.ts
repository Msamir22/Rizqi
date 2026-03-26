/**
 * ai-voice-parser-service.test.ts — T009
 *
 * Tests the exported functions:
 * - parseVoiceWithAi (text mode, audio mode, error handling, validation)
 * - isVoiceParserError (type guard)
 *
 * Mock Strategy:
 *   - `supabase.functions.invoke` is mocked to simulate Edge Function responses
 *   - `fetch` is mocked globally for audio blob fetching in audio mode
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports (Jest hoisting)
// ---------------------------------------------------------------------------

const mockInvoke = jest.fn();

jest.mock("@/services/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]): unknown => mockInvoke(...args) as unknown,
    },
  },
}));

// Mock global fetch for audio mode
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Imports — module under test
// ---------------------------------------------------------------------------

import {
  parseVoiceWithAi,
  isVoiceParserError,
} from "@/services/ai-voice-parser-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResponse(
  transactions: ReadonlyArray<Record<string, unknown>>,
  transcript = "test transcript"
): { data: Record<string, unknown>; error: null } {
  return {
    data: { transactions, transcript },
    error: null,
  };
}

function makeValidTransaction(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    amount: 50,
    type: "EXPENSE",
    counterparty: "Coffee Shop",
    categorySystemName: "food_and_drinks",
    description: "Morning coffee",
    accountId: "acc-1",
    date: "2026-01-15",
    confidenceScore: 0.9,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ai-voice-parser-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // =========================================================================
  // isVoiceParserError
  // =========================================================================
  describe("isVoiceParserError", () => {
    it("should return true for error objects with 'kind' property", () => {
      const error = { kind: "timeout" as const, message: "Too slow" };
      expect(isVoiceParserError(error)).toBe(true);
    });

    it("should return false for success results with 'transactions'", () => {
      const success = { transactions: [], transcript: "" };
      expect(isVoiceParserError(success)).toBe(false);
    });
  });

  // =========================================================================
  // parseVoiceWithAi — Text mode
  // =========================================================================
  describe("parseVoiceWithAi — text mode", () => {
    it("should return parsed transactions for valid response", async () => {
      const tx = makeValidTransaction();
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));

      const result = await parseVoiceWithAi({
        textQuery: "I spent 50 on coffee",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(false);
      if (!isVoiceParserError(result)) {
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].amount).toBe(50);
        expect(result.transactions[0].currency).toBe("EGP");
        expect(result.transactions[0].type).toBe("EXPENSE");
        expect(result.transactions[0].counterparty).toBe("Coffee Shop");
        expect(result.transcript).toBe("test transcript");
      }
    });

    it("should pass categories and accounts to the Edge Function", async () => {
      mockInvoke.mockResolvedValueOnce(
        makeSuccessResponse([makeValidTransaction()])
      );

      await parseVoiceWithAi({
        textQuery: "I spent 50 on coffee",
        preferredCurrency: "EGP",
        categories: "Food & Drinks > Coffee",
        accounts: [{ id: "acc-1", name: "Cash EGP" }],
        languageHint: "en",
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const callArgs = mockInvoke.mock.calls[0] as unknown[];
      expect(callArgs[0]).toBe("parse-voice");
      const body = (callArgs[1] as { body: Record<string, unknown> }).body;
      expect(body.query).toBe("I spent 50 on coffee");
      expect(body.language).toBe("en");
      expect(body.categories).toBe("Food & Drinks > Coffee");
      expect(body.accounts).toEqual([{ id: "acc-1", name: "Cash EGP" }]);
    });

    it("should return multiple parsed transactions", async () => {
      const txs = [
        makeValidTransaction({ amount: 5, counterparty: "Foul" }),
        makeValidTransaction({ amount: 10, counterparty: "Taamia" }),
        makeValidTransaction({ amount: 5000, counterparty: "Shopping" }),
      ];
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse(txs));

      const result = await parseVoiceWithAi({
        textQuery: "I spent 5 on foul, 10 on taamia, 5000 on shopping",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(false);
      if (!isVoiceParserError(result)) {
        expect(result.transactions).toHaveLength(3);
        expect(result.transactions[0].amount).toBe(5);
        expect(result.transactions[1].amount).toBe(10);
        expect(result.transactions[2].amount).toBe(5000);
      }
    });

    it("should normalize INCOME type correctly", async () => {
      const tx = makeValidTransaction({ type: "income" });
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));

      const result = await parseVoiceWithAi({
        textQuery: "I received salary",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        expect(result.transactions[0].type).toBe("INCOME");
      }
    });

    it("should default unknown types to EXPENSE", async () => {
      const tx = makeValidTransaction({ type: "DEBIT" });
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));

      const result = await parseVoiceWithAi({
        textQuery: "I paid 50",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        expect(result.transactions[0].type).toBe("EXPENSE");
      }
    });

    it("should use absolute value for amounts", async () => {
      const tx = makeValidTransaction({ amount: -50 });
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));

      const result = await parseVoiceWithAi({
        textQuery: "I spent 50",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        expect(result.transactions[0].amount).toBe(50);
      }
    });

    it("should use senderDisplayName as 'voice-input'", async () => {
      mockInvoke.mockResolvedValueOnce(
        makeSuccessResponse([makeValidTransaction()])
      );

      const result = await parseVoiceWithAi({
        textQuery: "I spent 50",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        expect(result.transactions[0].senderDisplayName).toBe("voice-input");
      }
    });
  });

  // =========================================================================
  // parseVoiceWithAi — Error handling
  // =========================================================================
  describe("parseVoiceWithAi — error handling", () => {
    it("should return 'unknown' error when neither audioUri nor textQuery provided", async () => {
      const result = await parseVoiceWithAi({
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(true);
      if (isVoiceParserError(result)) {
        expect(result.kind).toBe("unknown");
        expect(result.message).toContain("audioUri or textQuery");
      }
    });

    it("should return 'network' error on Edge Function error", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Function invocation failed" },
      });

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(true);
      if (isVoiceParserError(result)) {
        expect(result.kind).toBe("network");
        expect(result.message).toBe("Function invocation failed");
      }
    });

    it("should return 'empty' error when response has no transactions array", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { transcript: "test" },
        error: null,
      });

      const result = await parseVoiceWithAi({
        textQuery: "hello",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(true);
      if (isVoiceParserError(result)) {
        expect(result.kind).toBe("empty");
      }
    });

    it("should return 'empty' when all transactions fail validation", async () => {
      const badTx = { invalid: "data" }; // Missing required `amount` and `type`
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([badTx]));

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(true);
      if (isVoiceParserError(result)) {
        expect(result.kind).toBe("empty");
      }
    });

    it("should skip malformed entries but keep valid ones", async () => {
      const valid = makeValidTransaction({ amount: 100 });
      const invalid = { noAmount: true };
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([valid, invalid]));

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(false);
      if (!isVoiceParserError(result)) {
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].amount).toBe(100);
      }
    });

    it("should return 'unknown' error on unexpected exception", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network failure"));

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(true);
      if (isVoiceParserError(result)) {
        expect(result.kind).toBe("unknown");
        expect(result.message).toBe("Network failure");
      }
    });

    it("should return 'timeout' error on AbortError", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockInvoke.mockRejectedValueOnce(abortError);

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      expect(isVoiceParserError(result)).toBe(true);
      if (isVoiceParserError(result)) {
        expect(result.kind).toBe("timeout");
        expect(result.message).toContain("took too long");
      }
    });
  });

  // =========================================================================
  // parseVoiceWithAi — Date parsing
  // =========================================================================
  describe("parseVoiceWithAi — date parsing", () => {
    it("should parse valid ISO date string", async () => {
      const tx = makeValidTransaction({ date: "2026-03-15" });
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        const txDate = result.transactions[0].date;
        expect(txDate).toBeInstanceOf(Date);
        expect(new Date(txDate).getFullYear()).toBe(2026);
      }
    });

    it("should fall back to current date for empty date string", async () => {
      const tx = makeValidTransaction({ date: "" });
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));
      const before = Date.now();

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        const txDate = new Date(result.transactions[0].date);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(before);
      }
    });

    it("should fall back to current date for invalid date string", async () => {
      const tx = makeValidTransaction({ date: "not-a-date" });
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([tx]));
      const before = Date.now();

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        const txDate = new Date(result.transactions[0].date);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(before);
      }
    });
  });

  // =========================================================================
  // parseVoiceWithAi — Audio mode
  // =========================================================================
  describe("parseVoiceWithAi — audio mode", () => {
    let appendSpy: jest.SpyInstance;

    beforeEach(() => {
      appendSpy = jest.spyOn(FormData.prototype, "append");
    });

    afterEach(() => {
      appendSpy.mockRestore();
    });

    /** Extracts the "audio" entry from the spied FormData.append calls. */
    function getAppendedAudioFile(): Record<string, unknown> | undefined {
      const audioCall = appendSpy.mock.calls.find(
        (call: unknown[]) => call[0] === "audio"
      ) as [string, Record<string, unknown>] | undefined;
      return audioCall?.[1];
    }

    it("should send audio as FormData with ReactNativeFormDataFile when audioUri is provided", async () => {
      mockInvoke.mockResolvedValueOnce(
        makeSuccessResponse([makeValidTransaction()])
      );

      const result = await parseVoiceWithAi({
        audioUri: "file:///tmp/recording.m4a",
        preferredCurrency: "EGP",
        languageHint: "ar",
        categories: "Food",
        accounts: [{ id: "acc-1", name: "Cash" }],
      });

      // No fetch() call — ReactNativeFormDataFile pattern reads files natively
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      const callArgs = mockInvoke.mock.calls[0] as unknown[];
      expect(callArgs[0]).toBe("parse-voice");
      const body = (callArgs[1] as { body: FormData }).body;
      expect(body).toBeInstanceOf(FormData);

      // Verify the appended audio file has the correct URI (unchanged)
      const audioFile = getAppendedAudioFile();
      expect(audioFile).toBeDefined();
      expect(audioFile?.uri).toBe("file:///tmp/recording.m4a");
      expect(audioFile?.type).toBe("audio/mp4");
      expect(audioFile?.name).toBe("recording.m4a");

      expect(isVoiceParserError(result)).toBe(false);
    });

    it("should normalize bare file paths by prepending file:// prefix", async () => {
      mockInvoke.mockResolvedValueOnce(
        makeSuccessResponse([makeValidTransaction()])
      );

      await parseVoiceWithAi({
        audioUri: "/data/user/0/com.app/cache/recording.m4a",
        preferredCurrency: "EGP",
      });

      // Verify the URI was normalized with file:// prefix
      const audioFile = getAppendedAudioFile();
      expect(audioFile).toBeDefined();
      expect(audioFile?.uri).toBe(
        "file:///data/user/0/com.app/cache/recording.m4a"
      );
    });

    it("should preserve content:// URIs without prepending file://", async () => {
      mockInvoke.mockResolvedValueOnce(
        makeSuccessResponse([makeValidTransaction()])
      );

      await parseVoiceWithAi({
        audioUri: "content://com.android.providers.media/recording.m4a",
        preferredCurrency: "EGP",
      });

      // Verify the content:// URI was NOT modified
      const audioFile = getAppendedAudioFile();
      expect(audioFile).toBeDefined();
      expect(audioFile?.uri).toBe(
        "content://com.android.providers.media/recording.m4a"
      );
    });
  });

  // =========================================================================
  // parseVoiceWithAi — Schema defaults
  // =========================================================================
  describe("parseVoiceWithAi — schema defaults", () => {
    it("should apply defaults for optional fields", async () => {
      const minimal = { amount: 100, type: "EXPENSE", counterparty: "Test" };
      mockInvoke.mockResolvedValueOnce(makeSuccessResponse([minimal]));

      const result = await parseVoiceWithAi({
        textQuery: "test",
        preferredCurrency: "EGP",
      });

      if (!isVoiceParserError(result)) {
        const tx = result.transactions[0];
        expect(tx.categoryDisplayName).toBe("other");
        expect(tx.accountId).toBe("");
        expect(tx.confidence).toBe(0.8);
      }
    });
  });
});
