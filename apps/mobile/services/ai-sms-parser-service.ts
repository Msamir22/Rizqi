/**
 * AI SMS Parser Service
 *
 * Mobile-side service client for the `/parse-sms` Edge Function.
 * Sends filtered SMS candidates to Gemini via Supabase Edge Function
 * and maps the AI response back to `ParsedSmsTransaction` objects.
 *
 * Falls back to `sms-category-mapper.ts` if the AI call fails.
 *
 * @module ai-sms-parser-service
 */

import { supabase } from "./supabase";

import type { CurrencyType, TransactionType } from "@astik/db";
import type { ParsedSmsTransaction, SmsMessage } from "@astik/logic/src/types";

// ---------------------------------------------------------------------------
// Types — AI response shape
// ---------------------------------------------------------------------------

interface AiSmsTransaction {
  readonly messageId: string;
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly merchant: string;
  readonly date: string;
  readonly categorySystemName: string;
  /** Bank/wallet/fintech name extracted from message content (not sender name). */
  readonly financialEntity?: string;
  /** True for ATM cash withdrawal transactions. */
  readonly isAtmWithdrawal?: boolean;
  /** Last 4 digits of the card found in the SMS body. */
  readonly cardLast4?: string;
}

// ---------------------------------------------------------------------------
// Input type — candidate SMS for AI processing
// ---------------------------------------------------------------------------

export interface SmsCandidate {
  /** The original SMS message */
  readonly message: SmsMessage;
  /** Pre-computed body hash for deduplication */
  readonly smsBodyHash: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// TODO: make this dynamic based on the Supported Currencies.
const VALID_CURRENCIES: ReadonlySet<string> = new Set([
  "EGP",
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "AED",
  "KWD",
]);

const VALID_TYPES: ReadonlySet<string> = new Set(["EXPENSE", "INCOME"]);

/**
 * Client-side chunk size — messages per Edge Function call.
 * Each chunk should complete well within the Supabase ~150s wall-time limit.
 * 50 messages ≈ 10–15s (one Gemini call on the server).
 *
 * Reduced from 100 to 50 to:
 * - Stay safely within the ~150s edge function wall-time
 * - Provide more frequent progress updates (2× chunks = 2× UI updates)
 * - Reduce the blast radius of a single chunk failure
 */
const CLIENT_CHUNK_SIZE = 50;

/**
 * Minimum chunk size for retry-with-split. Chunks at or below this size
 * will NOT be split further on failure — they are treated as permanently failed.
 * This prevents infinite bisection.
 */
const MIN_CHUNK_SIZE_FOR_SPLIT = 10;

/** Delay between chunks (ms) to avoid Gemini rate limits. */
const INTER_CHUNK_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for a single AI transaction object.
 * Validates that all required properties exist with correct types.
 */
function isValidAiTransaction(value: unknown): value is AiSmsTransaction {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.messageId === "string" &&
    typeof obj.amount === "number" &&
    typeof obj.currency === "string" &&
    typeof obj.type === "string" &&
    typeof obj.merchant === "string" &&
    typeof obj.date === "string" &&
    typeof obj.categorySystemName === "string"
  );
}

/**
 * Safely parse and validate the Edge Function response.
 * Returns an empty array if the response shape is unexpected.
 */
function parseAiResponse(data: unknown): readonly AiSmsTransaction[] {
  if (typeof data !== "object" || data === null) {
    console.warn(
      "[ai-sms-parser] parseAiResponse: data is not an object",
      typeof data
    );
    return [];
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.transactions)) {
    console.warn(
      "[ai-sms-parser] parseAiResponse: no 'transactions' array in response. Keys:",
      Object.keys(obj)
    );
    return [];
  }

  const valid = obj.transactions.filter(isValidAiTransaction);
  const invalid = obj.transactions.length - valid.length;
  if (invalid > 0) {
    console.warn(
      `[ai-sms-parser] parseAiResponse: ${invalid}/${obj.transactions.length} transactions failed validation`
    );
  }
  return valid;
}

function normalizeCurrency(raw: string): CurrencyType | null {
  const upper = raw.toUpperCase();
  if (VALID_CURRENCIES.has(upper)) {
    return upper as CurrencyType;
  }
  return null;
}

function normalizeType(raw: string): TransactionType {
  const upper = raw.toUpperCase();
  if (VALID_TYPES.has(upper)) {
    return upper as TransactionType;
  }

  // It's okay to default to expense as it's the most common type of transaction.
  return "EXPENSE" as TransactionType;
}

function parseDate(dateStr: string, fallbackMs: number): Date {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date(fallbackMs);
  }
  return parsed;
}

/**
 * Map a batch of validated AI transactions to ParsedSmsTransaction objects.
 */
function mapAiTransactions(
  aiTransactions: readonly AiSmsTransaction[],
  candidateMap: ReadonlyMap<string, SmsCandidate>
): ParsedSmsTransaction[] {
  const results: ParsedSmsTransaction[] = [];

  for (const aiTx of aiTransactions) {
    const candidate = candidateMap.get(aiTx.messageId);
    // TODO: fallback to the preferedCurrncy.
    const currency = normalizeCurrency(aiTx.currency) ?? "EGP";
    if (!candidate) {
      console.warn(
        `[ai-sms-parser] Unknown messageId: ${aiTx.messageId}, skipping`
      );
      continue;
    }

    results.push({
      amount: Math.abs(aiTx.amount),
      currency,
      type: normalizeType(aiTx.type),
      counterparty: aiTx.merchant,
      merchant: aiTx.merchant,
      date: parseDate(aiTx.date, candidate.message.date),
      smsBodyHash: candidate.smsBodyHash,
      senderAddress: candidate.message.address,
      // Prefer financialEntity (extracted bank name) over raw sender address
      senderDisplayName: aiTx.financialEntity || candidate.message.address,
      categorySystemName: aiTx.categorySystemName || "other",
      rawSmsBody: candidate.message.body,
      // TODO: ensure the AI return confidence score.
      confidence: 0.85,
      financialEntity: aiTx.financialEntity,
      isAtmWithdrawal: aiTx.isAtmWithdrawal ?? false,
      cardLast4: aiTx.cardLast4,
    });
  }

  return results;
}

/**
 * Send a single chunk of messages to the Edge Function.
 * Returns validated AI transactions or empty array on failure.
 */
async function invokeParseChunk(
  messagesPayload: readonly MessagePayload[]
): Promise<readonly AiSmsTransaction[]> {
  const response = await supabase.functions.invoke("parse-sms", {
    body: { messages: messagesPayload },
  });

  if (response.error) {
    const errorMsg =
      response.error instanceof Error
        ? response.error.message
        : String(response.error);
    console.error("[ai-sms-parser] Chunk error:", errorMsg);
    return [];
  }

  return parseAiResponse(response.data);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Callback invoked after each chunk completes (or after a retry resolves). */
export interface AiParseProgress {
  readonly chunksCompleted: number;
  readonly totalChunks: number;
  readonly transactionsSoFar: number;
  /** Duration of the just-completed chunk in milliseconds. Used for time estimation. */
  readonly chunkDurationMs: number;
}

interface MessagePayload {
  readonly id: string;
  readonly body: string;
  readonly sender: string;
  readonly date: string; // not neede to be send to the AI.
}

interface ChunkWork {
  readonly messages: readonly MessagePayload[];
  /** True if this chunk is already a retry sub-chunk (no further splitting). */
  readonly isRetry: boolean;
}

/**
 * Parse SMS candidates through the AI Edge Function.
 *
 * Chunks candidates client-side into groups of {@link CLIENT_CHUNK_SIZE}
 * and sends each chunk as a separate Edge Function call. This avoids
 * the Supabase ~150s wall-time limit that occurs when processing
 * thousands of messages in a single invocation.
 *
 * Failed chunks are logged but do not abort the pipeline — partial
 * results from successful chunks are still returned.
 *
 * @param candidates - SMS messages that passed the keyword filter
 * @param onProgress - Optional callback invoked after each chunk completes
 * @returns Parsed transactions ready for user review
 * @throws Never — returns empty array on total failure
 */
export async function parseSmsWithAi(
  candidates: readonly SmsCandidate[],
  onProgress?: (progress: AiParseProgress) => void
): Promise<readonly ParsedSmsTransaction[]> {
  if (candidates.length === 0) return [];

  try {
    // Build the lookup map: messageId → candidate
    const candidateMap = new Map<string, SmsCandidate>();
    const allMessages: readonly MessagePayload[] = candidates.map((c) => {
      candidateMap.set(c.message.id, c);
      return {
        id: c.message.id,
        body: c.message.body,
        sender: c.message.address,
        date: new Date(c.message.date).toISOString(),
      };
    });

    // Build a queue of chunks to process. Retry-with-split may add
    // sub-chunks dynamically, so we use a queue instead of index-based loop.

    // Initial chunking
    const chunkQueue: ChunkWork[] = [];
    for (let i = 0; i < allMessages.length; i += CLIENT_CHUNK_SIZE) {
      chunkQueue.push({
        messages: allMessages.slice(i, i + CLIENT_CHUNK_SIZE),
        isRetry: false,
      });
    }

    let totalChunks = chunkQueue.length;
    let chunksCompleted = 0;
    const allResults: ParsedSmsTransaction[] = [];

    let chunkIndex = 0;
    while (chunkIndex < chunkQueue.length) {
      // Delay between chunks to avoid Gemini rate limits (skip for first chunk)
      if (chunkIndex > 0) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, INTER_CHUNK_DELAY_MS)
        );
      }

      const currentChunk = chunkQueue[chunkIndex];
      const chunkStartMs = Date.now();

      const aiTransactions = await invokeParseChunk(currentChunk.messages);
      const chunkDurationMs = Date.now() - chunkStartMs;

      // Check if the chunk failed (invokeParseChunk returns [] on error)
      if (
        aiTransactions.length === 0 &&
        currentChunk.messages.length > 0 &&
        !currentChunk.isRetry &&
        currentChunk.messages.length > MIN_CHUNK_SIZE_FOR_SPLIT
      ) {
        // Retry-with-split: bisect the failed chunk and enqueue sub-chunks
        const midpoint = Math.ceil(currentChunk.messages.length / 2);
        const firstHalf = currentChunk.messages.slice(0, midpoint);
        const secondHalf = currentChunk.messages.slice(midpoint);

        console.warn(
          `[ai-sms-parser] Chunk of ${currentChunk.messages.length} failed. ` +
            `Splitting into ${firstHalf.length} + ${secondHalf.length} and retrying.`
        );

        // Replace the failed chunk's slot with 2 retry sub-chunks.
        // We splice them right after the current index so they're processed next.
        chunkQueue.splice(
          chunkIndex + 1,
          0,
          { messages: firstHalf, isRetry: true },
          { messages: secondHalf, isRetry: true }
        );

        // Adjust total: we're replacing 1 failed chunk with 2 sub-chunks (+1 net)
        totalChunks += 1;

        // Move past the failed chunk (don't count it as completed)
        chunkIndex++;
        continue;
      }

      // Chunk succeeded (or it's a retry that returned no results — we accept that)
      const mapped = mapAiTransactions(aiTransactions, candidateMap);
      allResults.push(...mapped);
      chunksCompleted++;

      onProgress?.({
        chunksCompleted,
        totalChunks,
        transactionsSoFar: allResults.length,
        chunkDurationMs,
      });

      chunkIndex++;
    }

    return allResults;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-sms-parser] Unexpected error:", message);
    return [];
  }
}
