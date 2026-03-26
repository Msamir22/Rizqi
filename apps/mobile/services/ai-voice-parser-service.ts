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

import type { ParsedSmsTransaction } from "@astik/logic/src/types";
import type { TransactionType } from "@astik/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sender identifier for voice-input transactions (not from SMS). */
const VOICE_INPUT_SENDER = "voice-input";

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
}

interface ParseVoiceResult {
  readonly transactions: readonly ParsedSmsTransaction[];
  readonly transcript: string;
}

/** Error types for structured error handling */
type VoiceParserErrorKind = "timeout" | "network" | "empty" | "unknown";

interface VoiceParserError {
  readonly kind: VoiceParserErrorKind;
  readonly message: string;
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
  readonly transactions: readonly unknown[];
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Validation Sets
// ---------------------------------------------------------------------------

const VALID_TYPES: ReadonlySet<string> = new Set(["EXPENSE", "INCOME"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeType(raw: string): TransactionType {
  const upper = raw.toUpperCase();
  if (VALID_TYPES.has(upper)) {
    return upper as TransactionType;
  }
  return "EXPENSE" as TransactionType;
}

/** Regex to detect date-only strings (YYYY-MM-DD) without time component. */
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse an AI-returned date string into a Date object.
 * Bare YYYY-MM-DD strings are treated as local dates (not UTC) to avoid
 * off-by-one day errors in positive UTC offset timezones (e.g., Egypt UTC+2).
 * Falls back to current timestamp if empty or unparseable.
 */
function parseAiDate(raw: string): Date {
  if (!raw || raw.trim() === "") {
    return new Date();
  }

  // Date-only strings: create in local timezone to avoid UTC midnight shift
  if (DATE_ONLY_REGEX.test(raw.trim())) {
    const [yearStr, monthStr, dayStr] = raw.trim().split("-");
    const localDate = new Date(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr)
    );
    if (!isNaN(localDate.getTime())) {
      return localDate;
    }
    return new Date();
  }

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

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

    // Validate and map AI response to ParsedSmsTransaction
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

    const results: ParsedSmsTransaction[] = validTransactions.map(
      (aiTx: AiVoiceTransaction): ParsedSmsTransaction => ({
        amount: Math.abs(aiTx.amount),
        currency: options.preferredCurrency as ParsedSmsTransaction["currency"],
        type: normalizeType(aiTx.type),
        counterparty: aiTx.counterparty ?? "",
        merchant: aiTx.counterparty ?? "",
        date: parseAiDate(aiTx.date),
        smsBodyHash: "", // Not applicable for voice
        senderDisplayName: VOICE_INPUT_SENDER,
        categoryId: "", // Resolved by consumer via categorySystemName lookup
        categoryDisplayName:
          aiTx.categorySystemName || DEFAULT_CATEGORY_DISPLAY_NAME,
        rawSmsBody: aiTx.description || "",
        confidence: aiTx.confidenceScore,
        accountId: aiTx.accountId || "",
      })
    );

    return { transactions: results, transcript };
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
