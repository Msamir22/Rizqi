/**
 * AI Voice Parser Service
 *
 * Mobile-side service client for the `/parse-voice` Edge Function.
 * Sends audio recordings or transcribed text to Gemini via Supabase
 * Edge Function and returns structured transaction data.
 *
 * Supports Arabic (MSA + Egyptian dialect), English, and code-switching.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service Layer (SRP — only handles AI communication)
 * - SOLID: Single responsibility → one service, one concern (voice→transactions).
 *   Open/Closed → new fields (accountId, date) added without modifying consumers.
 * - Algorithm: AbortController with 30s timeout for network resilience (FR-024).
 *
 * @module ai-voice-parser-service
 */

import { supabase } from "./supabase";
import { z } from "zod";

import type { Category } from "@astik/db";
import {
  normalizeCurrency,
  normalizeType,
  parseAiDate,
  clampConfidence,
  parseCategory,
  buildCategoryMap,
  type ParsedVoiceTransaction,
  type ReviewableTransaction,
  type VoiceParserError,
  type CategoryMap,
} from "@astik/logic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sender identifier for voice-input transactions (not from SMS). */
const VOICE_INPUT_SENDER = "Voice";

/** Client-side timeout for AI analysis request (FR-024). */
const AI_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountInput {
  readonly id: string;
  readonly name: string;
}

interface ParseVoiceOptions {
  /** Audio file URI */
  readonly audioUri: string;
  /** User's category tree (L1/L2 format) */
  readonly categories: string;
  /** User's accounts for AI matching */
  readonly accounts: readonly AccountInput[];
  /** User's preferred currency code (set client-side, not by AI) */
  readonly preferredCurrency: string;
  /** User's categories from the database — used for AI category → ID resolution */
  readonly categoryRecords: readonly Category[];
}

interface ParseVoiceResult {
  readonly transactions: readonly ReviewableTransaction[];
  readonly transcript: string;
  readonly originalTranscript: string;
  readonly detectedLanguage: string;
}

// ---------------------------------------------------------------------------
// Schemas — AI response validation
// ---------------------------------------------------------------------------

/**
 * Strict Zod schema for a single AI-extracted transaction.
 * Mirrors `VoiceTransaction` from the edge function exactly.
 *
 * All fields are required — if the AI fails to extract any of them,
 * the transaction is rejected by `safeParse` and logged as malformed.
 * Only `counterparty` and `accountId` are legitimately nullable
 * (the AI may not know the counterparty or matched account).
 */
const AiVoiceTransactionSchema = z.object({
  amount: z.number(),
  type: z.string(),
  counterparty: z.string().nullable(),
  categorySystemName: z.string(),
  description: z.string(),
  accountId: z.string().nullable(),
  date: z.string(),
  confidenceScore: z.number(),
});

type AiVoiceTransaction = z.infer<typeof AiVoiceTransactionSchema>;

/**
 * Strict Zod schema for the full edge-function response.
 * Mirrors `AiResponse` from the edge function.
 *
 * All fields are required — a missing `transcript` or `transactions`
 * array indicates a malformed response from Gemini.
 * Only `error` is optional (present only in error responses).
 */
const ParseVoiceResponseSchema = z.object({
  transcript: z.string(),
  original_transcript: z.string(),
  detected_language: z.string(),
  transactions: z.array(z.unknown()),
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Removed — normalizeType and parseAiDate are now imported from @astik/logic
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a voice recording through the AI Edge Function.
 *
 * Supports two modes:
 * 1. Audio file (multipart) — sends raw audio to Gemini multimodal
 * 2. Text query (JSON) — sends transcribed text for processing
 *
 * @param options - Configuration including audio/text, accounts, categories, currency
 * @returns Parsed transactions and transcript, or structured error
 * @throws Never — returns structured VoiceParserError on failure
 */
export async function parseVoiceWithAi(
  options: ParseVoiceOptions
): Promise<ParseVoiceResult | VoiceParserError> {
  // Compute caller's local date in YYYY-MM-DD format for relative date resolution
  const now = new Date();
  const callerLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // FR-024: 30-second client-side timeout via AbortController
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, AI_TIMEOUT_MS);

  try {
    let response: {
      data: unknown;
      error: { message: string } | null;
    };

    if (options.audioUri) {
      // Audio mode — send as multipart form data
      // React Native's FormData natively supports { uri, type, name } objects
      // for file uploads. Using fetch(localUri).blob() doesn't work reliably
      // on Android (bare paths without file:// prefix cause "Network request failed").
      //
      // Only prepend file:// for bare absolute paths (starting with "/").
      // Leave URIs with existing schemes (file://, content://, http://) untouched.
      const hasScheme = options.audioUri.includes("://");
      const fileUri = hasScheme
        ? options.audioUri
        : `file://${options.audioUri}`;

      const formData = new FormData();
      const audioFile: ReactNativeFormDataFile = {
        uri: fileUri,
        type: "audio/mp4",
        name: "recording.m4a",
      };
      formData.append("audio", audioFile);
      if (options.categories) {
        formData.append("categories", options.categories);
      }
      if (options.accounts && options.accounts.length > 0) {
        formData.append("accounts", JSON.stringify(options.accounts));
      }
      formData.append("callerLocalDate", callerLocalDate);

      response = await supabase.functions.invoke("parse-voice", {
        body: formData,
        signal: abortController.signal,
      });
    } else {
      clearTimeout(timeoutId);
      return {
        kind: "unknown",
        message: "audioUri must be provided.",
      };
    }

    clearTimeout(timeoutId);

    if (response.error) {
      console.error(
        "[ai-voice-parser] Edge Function error:",
        response.error.message
      );
      return {
        kind: "network",
        message: response.error.message,
      };
    }

    const rawData = response.data;
    const parsed = ParseVoiceResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      console.error(
        "[ai-voice-parser] Malformed backend response shape:",
        parsed.error.issues,
        "rawData:",
        rawData
      );
      return {
        kind: "schema",
        message:
          "The server returned an unexpected response format. Please try again.",
      };
    }

    const data = parsed.data;
    if (data.error) {
      console.error("[ai-voice-parser] Edge Function error:", data.error);
      return {
        kind: "network",
        message: data.error,
      };
    }

    const transcript = data.transcript;
    const originalTranscript = data.original_transcript || transcript;
    const detectedLanguage = data.detected_language;

    // Validate and map AI response to ParsedVoiceTransaction
    const validTransactions: AiVoiceTransaction[] = [];
    for (const raw of data.transactions) {
      const parsed = AiVoiceTransactionSchema.safeParse(raw);
      if (parsed.success) {
        validTransactions.push(parsed.data);
      } else {
        console.warn(
          "[ai-voice-parser] Skipping malformed transaction entry:",
          raw,
          parsed.error.issues
        );
      }
    }

    if (validTransactions.length === 0) {
      return {
        kind: "empty",
        message: "No transactions found in your recording. Try again?",
      };
    }

    // Build category map for lookup — fail fast if category data is missing/empty.
    // An empty category map would cause every parseCategory() call to throw,
    // silently dropping all transactions and returning a misleading "empty" error.
    const categoryMap: CategoryMap = buildCategoryMap(options.categoryRecords);
    if (categoryMap.size === 0) {
      console.error(
        "[ai-voice-parser] Category data unavailable — categoryMap is empty.",
        "categoryRecords length:",
        options.categoryRecords.length
      );
      return {
        kind: "config",
        message:
          "Category data is unavailable. Please restart the app and try again.",
      };
    }

    const validatedCurrency = normalizeCurrency(options.preferredCurrency);
    const results: ParsedVoiceTransaction[] = [];

    for (const aiTx of validTransactions) {
      try {
        const resolvedCategory = parseCategory(
          aiTx.categorySystemName,
          categoryMap
        );

        results.push({
          amount: Math.abs(aiTx.amount),
          currency: validatedCurrency,
          type: normalizeType(aiTx.type),
          counterparty: aiTx.counterparty ?? undefined,
          date: parseAiDate(aiTx.date),
          source: "VOICE",
          originLabel: aiTx.counterparty || VOICE_INPUT_SENDER,
          categoryId: resolvedCategory.id,
          categoryDisplayName: resolvedCategory.displayName,
          confidence: clampConfidence(aiTx.confidenceScore),
          accountId: aiTx.accountId || undefined,
          note: aiTx.description,
          originalTranscript,
          detectedLanguage,
        });
      } catch (error) {
        console.warn(
          "[ai-voice-parser] Skipping semantically invalid transaction:",
          aiTx,
          error
        );
      }
    }

    if (results.length === 0) {
      return {
        kind: "empty",
        message: "No transactions found in your recording. Try again?",
      };
    }

    return {
      transactions: results,
      transcript,
      originalTranscript,
      detectedLanguage,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    // FR-024: Handle timeout specifically
    if (err instanceof Error && err.name === "AbortError") {
      return {
        kind: "timeout",
        message:
          "Analysis took too long. Please check your connection and try again.",
      };
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-voice-parser] Unexpected error:", message);
    return {
      kind: "unknown",
      message,
    };
  }
}

/**
 * Type guard to check if a result is an error.
 */
export function isVoiceParserError(
  result: ParseVoiceResult | VoiceParserError
): result is VoiceParserError {
  return "kind" in result;
}
