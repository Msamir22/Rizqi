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

import type {
  ParsedVoiceTransaction,
  VoiceParserError,
} from "@astik/logic/src/types";
import type { Category } from "@astik/db";
import {
  normalizeType,
  parseAiDate,
  clampConfidence,
  parseCategory,
  buildCategoryMap,
} from "@astik/logic";
import type { CategoryMap } from "@astik/logic/src/utils/ai-parser-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default category display name when AI doesn't provide one. */
const DEFAULT_CATEGORY_DISPLAY_NAME = "other";

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
  /** Audio mode: local file URI */
  readonly audioUri?: string;
  /** Text mode: transcribed text for testing/fallback */
  readonly textQuery?: string;
  /** Optional language hint ("ar" or "en") */
  readonly languageHint?: "ar" | "en";
  /** User's category tree (L1/L2 format) */
  readonly categories?: string;
  /** User's accounts for AI matching */
  readonly accounts?: readonly AccountInput[];
  /** User's preferred currency code (set client-side, not by AI) */
  readonly preferredCurrency: string;
  /** User's categories from the database — used for AI category → ID resolution */
  readonly categoryRecords?: readonly Category[];
}

interface ParseVoiceResult {
  readonly transactions: readonly ParsedVoiceTransaction[];
  readonly transcript: string;
  readonly originalTranscript: string;
  readonly detectedLanguage: string;
}

// ---------------------------------------------------------------------------
// Schemas — AI response validation
// ---------------------------------------------------------------------------

const AiVoiceTransactionSchema = z.object({
  amount: z.number(),
  type: z.string(),
  counterparty: z.string(),
  categorySystemName: z.string().optional().default(""),
  description: z.string().optional().default(""),
  accountId: z.string().optional().default(""),
  date: z.string().optional().default(""),
  confidenceScore: z.number().optional().default(0.8),
});

type AiVoiceTransaction = z.infer<typeof AiVoiceTransactionSchema>;

interface ParseVoiceResponse {
  readonly transcript?: string;
  readonly original_transcript?: string;
  readonly detected_language?: string;
  readonly transactions: readonly unknown[];
  readonly error?: string;
}

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
      data: ParseVoiceResponse | null;
      error: { message: string } | null;
    };

    if (options.textQuery) {
      // Text mode — send as JSON
      response = await supabase.functions.invoke<ParseVoiceResponse>(
        "parse-voice",
        {
          body: {
            query: options.textQuery,
            language: options.languageHint,
            categories: options.categories,
            accounts: options.accounts,
            callerLocalDate,
          },
          signal: abortController.signal,
        }
      );
    } else if (options.audioUri) {
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
      if (options.languageHint) {
        formData.append("language", options.languageHint);
      }
      if (options.categories) {
        formData.append("categories", options.categories);
      }
      if (options.accounts && options.accounts.length > 0) {
        formData.append("accounts", JSON.stringify(options.accounts));
      }
      formData.append("callerLocalDate", callerLocalDate);

      response = await supabase.functions.invoke<ParseVoiceResponse>(
        "parse-voice",
        { body: formData, signal: abortController.signal }
      );
    } else {
      clearTimeout(timeoutId);
      return {
        kind: "unknown",
        message: "Either audioUri or textQuery must be provided.",
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

    const data = response.data;
    if (!data?.transactions || !Array.isArray(data.transactions)) {
      console.warn("[ai-voice-parser] No transactions in response");
      return {
        kind: "empty",
        message: "No transactions found in your recording. Try again?",
      };
    }

    const transcript = data.transcript ?? "";
    const originalTranscript = data.original_transcript ?? transcript;
    const detectedLanguage = data.detected_language ?? "en";

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

    // Build category map for lookup (if categories provided)
    const categoryMap: CategoryMap | undefined = options.categoryRecords
      ? buildCategoryMap(options.categoryRecords)
      : undefined;

    const results: ParsedVoiceTransaction[] = validTransactions.map(
      (aiTx: AiVoiceTransaction): ParsedVoiceTransaction => {
        const resolvedCategory = categoryMap
          ? parseCategory(aiTx.categorySystemName, categoryMap)
          : null;

        return {
          amount: Math.abs(aiTx.amount),
          currency:
            options.preferredCurrency as ParsedVoiceTransaction["currency"],
          type: normalizeType(aiTx.type),
          counterparty: aiTx.counterparty ?? "",
          date: parseAiDate(aiTx.date),
          categoryId: resolvedCategory?.id ?? "",
          categoryDisplayName:
            resolvedCategory?.displayName ??
            (aiTx.categorySystemName || DEFAULT_CATEGORY_DISPLAY_NAME),
          confidence: clampConfidence(aiTx.confidenceScore),
          accountId: aiTx.accountId || "",
          note: aiTx.description || "",
          originalTranscript,
          detectedLanguage,
        };
      }
    );

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
