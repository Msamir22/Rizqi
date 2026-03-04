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
import { z } from "zod";

import type { Category, CurrencyType, TransactionType } from "@astik/db";
import { SUPPORTED_CURRENCIES, buildCategoryTree } from "@astik/logic";
import type { ParsedSmsTransaction, SmsMessage } from "@astik/logic/src/types";

// ---------------------------------------------------------------------------
// Schemas — AI response validation
// ---------------------------------------------------------------------------

const AiSmsTransactionSchema = z.object({
  messageId: z.string(),
  amount: z.number(),
  currency: z.string(),
  type: z.string(),
  counterparty: z.string(),
  date: z.string(),
  categorySystemName: z.string(),
  isAtmWithdrawal: z.boolean().optional().default(false),
  cardLast4: z.string().optional(),
  confidenceScore: z.number(),
  isTrusted: z.boolean(),
});

type AiSmsTransaction = z.infer<typeof AiSmsTransactionSchema>;

/** Result from AI parsing */
export interface AiParseResult {
  readonly transactions: readonly ParsedSmsTransaction[];
}

/** Context sent alongside SMS messages to the Edge Function. */
export interface ParseSmsContext {
  /** Raw category entries from DB — used to build both the AI tree string and the validation set. */
  readonly categories: readonly Category[];
  readonly supportedCurrencies: readonly string[];
}

type CategoryMap = Map<
  Category["systemName"],
  { name: Category["displayName"]; id: Category["id"] }
>;

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

// Derived from SUPPORTED_CURRENCIES so it stays in sync with CurrencyType
// automatically. No manual list to maintain.
const VALID_CURRENCIES: ReadonlySet<string> = new Set<CurrencyType>(
  SUPPORTED_CURRENCIES.map((c) => c.code)
);

const VALID_TYPES: ReadonlySet<string> = new Set<TransactionType>([
  "EXPENSE",
  "INCOME",
]);

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
 * Parsed edge function response.
 */
interface ChunkAiResult {
  readonly transactions: readonly AiSmsTransaction[];
  /** True if the Edge Function call failed (not a legitimate empty result). */
  readonly hasError: boolean;
}

/**
 * Safely parse and validate the Edge Function response.
 * Uses Zod schema validation for each transaction entry.
 * Returns empty transactions if the response shape is unexpected.
 */
function parseAiResponse(data: unknown): ChunkAiResult {
  const emptyResult: ChunkAiResult = { transactions: [], hasError: false };

  if (typeof data !== "object" || data === null) {
    console.warn(
      "[ai-sms-parser] parseAiResponse: data is not an object",
      typeof data
    );
    return emptyResult;
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.transactions)) {
    console.warn(
      "[ai-sms-parser] parseAiResponse: no 'transactions' array in response. Keys:",
      Object.keys(obj)
    );
    return emptyResult;
  }

  const transactions: AiSmsTransaction[] = [];
  let invalidCount = 0;

  for (const raw of obj.transactions) {
    const parsed = AiSmsTransactionSchema.safeParse(raw);
    if (parsed.success) {
      transactions.push(parsed.data);
    } else {
      invalidCount++;
      console.warn(
        "[ai-sms-parser] Skipping malformed transaction entry:",
        raw,
        parsed.error.issues
      );
    }
  }

  if (invalidCount > 0) {
    console.warn(
      `[ai-sms-parser] parseAiResponse: ${invalidCount}/${obj.transactions.length} transactions failed validation`
    );
  }

  return { transactions, hasError: false };
}

function normalizeCurrency(raw: string): CurrencyType | null {
  const upper = raw.toUpperCase();
  if (VALID_CURRENCIES.has(upper)) {
    return upper as CurrencyType;
  }

  // Unknown currency — return null so callers can skip or handle appropriately.
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

/**
 * Validate and normalize an AI-returned category system_name.
 * Falls back to "other" if the AI returned an unknown category.
 */
function parseCategory(
  categorySystemName: string,
  validCategories: CategoryMap
): { name: Category["displayName"]; id: Category["id"] } | null {
  const directMatch = validCategories.get(categorySystemName);
  if (directMatch) return directMatch;

  const fallbackCategory = validCategories.get("other");
  if (fallbackCategory) return fallbackCategory;
  console.warn(
    `[ai-sms-parser] Unknown category "${categorySystemName}" from AI and no "other" fallback category exists`
  );

  return null;
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
  candidateMap: ReadonlyMap<string, SmsCandidate>,
  validCategoryMap: CategoryMap
): ParsedSmsTransaction[] {
  const results: ParsedSmsTransaction[] = [];

  for (const aiTx of aiTransactions) {
    const candidate = candidateMap.get(aiTx.messageId);

    const currency = normalizeCurrency(aiTx.currency);
    if (!candidate) {
      console.warn(
        `[ai-sms-parser] Unknown messageId: ${aiTx.messageId}, skipping`
      );
      continue;
    }

    // Filter out transactions with unsupported currencies
    if (!currency) {
      console.warn(
        `[ai-sms-parser] Unsupported currency "${aiTx.currency}" for messageId: ${aiTx.messageId}, skipping`
      );
      continue;
    }

    // Filter out untrusted transactions (promotional offers, ambiguous messages)
    if (!aiTx.isTrusted) {
      console.info(
        `[ai-sms-parser] Untrusted transaction from ${candidate.message.address}, ` +
          `amount: ${aiTx.amount} ${aiTx.currency}, skipping`
      );
      continue;
    }

    // Counterparty guard: must never equal the financial entity
    const counterparty =
      candidate.message.address &&
      aiTx.counterparty.toLowerCase().trim() ===
        candidate.message.address.toLowerCase().trim()
        ? ""
        : aiTx.counterparty;

    const category = parseCategory(aiTx.categorySystemName, validCategoryMap);

    if (!category) {
      console.warn(
        `[ai-sms-parser] No valid category mapping for messageId: ${aiTx.messageId}, skipping`
      );
      continue;
    }

    results.push({
      amount: Math.abs(aiTx.amount),
      currency,
      type: normalizeType(aiTx.type),
      counterparty,
      date: parseDate(aiTx.date, candidate.message.date),
      smsBodyHash: candidate.smsBodyHash,
      senderDisplayName: candidate.message.address,
      categoryId: category.id,
      categoryDisplayName: category.name,
      rawSmsBody: candidate.message.body,
      confidence: Math.min(1, Math.max(0, aiTx.confidenceScore)),
      isAtmWithdrawal: aiTx.isAtmWithdrawal ?? false,
      cardLast4: aiTx.cardLast4,
    });
  }

  return results;
}

/**
 * Send a single chunk of messages to the Edge Function.
 * Returns validated AI transactions, or empty results on failure.
 */
async function invokeParseChunk(
  messagesPayload: readonly MessagePayload[],
  context: ParseSmsContext
): Promise<ChunkAiResult> {
  const errorResult: ChunkAiResult = { transactions: [], hasError: true };

  const response = await supabase.functions.invoke("parse-sms", {
    body: {
      messages: messagesPayload,
      categories: buildCategoryTree(context.categories),
      supportedCurrencies: context.supportedCurrencies,
    },
  });

  if (response.error) {
    const errorMsg =
      response.error instanceof Error
        ? response.error.message
        : String(response.error);
    console.error("[ai-sms-parser] Chunk error:", errorMsg);
    return errorResult;
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
 * @param context - Client context (categories, currencies)
 * @param onProgress - Optional callback invoked after each chunk completes
 * @returns Parsed transactions only (account suggestions derived separately)
 * @throws Never — returns empty array on total failure
 */
import { MOCK_PARSED_TRANSACTIONS } from "./mock-parsed-transactions";

// Toggle this to true to return mock parsed transactions and save AI tokens.
const USE_MOCK_DATA = true;

export async function parseSmsWithAi(
  candidates: readonly SmsCandidate[],
  context: ParseSmsContext,
  onProgress?: (progress: AiParseProgress) => void
): Promise<AiParseResult> {
  const emptyResult: AiParseResult = { transactions: [] };
  if (candidates.length === 0) return emptyResult;

  if (USE_MOCK_DATA) {
    console.info(
      "[ai-sms-parser] 🟡 Using MOCK parsed transactions to save AI tokens."
    );
    return { transactions: [...MOCK_PARSED_TRANSACTIONS] };
  }

  // Build validation set once for the entire parse session
  const validCategoryMap: CategoryMap = new Map(
    context.categories.map((c) => [
      c.systemName,
      { name: c.displayName, id: c.id },
    ])
  );

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

      const chunkResult = await invokeParseChunk(
        currentChunk.messages,
        context
      );
      const chunkDurationMs = Date.now() - chunkStartMs;

      // Only retry-with-split on actual errors, not legitimate empty results
      if (
        chunkResult.hasError &&
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
      const mapped = mapAiTransactions(
        chunkResult.transactions,
        candidateMap,
        validCategoryMap
      );
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

    return { transactions: allResults };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-sms-parser] Unexpected error:", message);
    return emptyResult;
  }
}
