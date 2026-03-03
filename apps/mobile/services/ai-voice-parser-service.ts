/**
 * AI Voice Parser Service
 *
 * Mobile-side service client for the `/parse-voice` Edge Function.
 * Sends audio recordings or transcribed text to Gemini via Supabase
 * Edge Function and returns structured transaction data.
 *
 * Supports Arabic (MSA + Egyptian dialect), English, and code-switching.
 *
 * @module ai-voice-parser-service
 */

import { supabase } from "./supabase";
import { z } from "zod";

import type { ParsedSmsTransaction } from "@astik/logic/src/types";
import type { CurrencyType, TransactionType } from "@astik/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sender identifier for voice-input transactions (not from SMS). */
const VOICE_INPUT_SENDER = "voice-input";

/** Default category display name when AI doesn't provide one. */
const DEFAULT_CATEGORY_DISPLAY_NAME = "other";

/** Baseline confidence for voice-parsed transactions (0–1). */
const VOICE_AI_CONFIDENCE_BASELINE = 0.8;

// ---------------------------------------------------------------------------
// Schemas — AI response validation
// ---------------------------------------------------------------------------

const AiVoiceTransactionSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  type: z.string(),
  merchant: z.string(),
  categorySystemName: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

type AiVoiceTransaction = z.infer<typeof AiVoiceTransactionSchema>;

interface ParseVoiceResponse {
  readonly transactions: readonly unknown[];
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Validation Sets
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCurrency(raw: string): CurrencyType {
  const upper = raw.toUpperCase();
  if (VALID_CURRENCIES.has(upper)) {
    return upper as CurrencyType;
  }
  return "EGP" as CurrencyType;
}

function normalizeType(raw: string): TransactionType {
  const upper = raw.toUpperCase();
  if (VALID_TYPES.has(upper)) {
    return upper as TransactionType;
  }
  return "EXPENSE" as TransactionType;
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
 * @param options - Either { audioUri } or { textQuery }
 * @param languageHint - Optional language hint ("ar" or "en")
 * @returns Parsed transactions ready for user review
 * @throws Never — returns empty array on failure
 */
export async function parseVoiceWithAi(
  options: { audioUri: string } | { textQuery: string },
  languageHint?: "ar" | "en"
): Promise<readonly ParsedSmsTransaction[]> {
  try {
    let response: {
      data: ParseVoiceResponse | null;
      error: { message: string } | null;
    };

    if ("textQuery" in options) {
      // Text mode — send as JSON
      response = await supabase.functions.invoke<ParseVoiceResponse>(
        "parse-voice",
        {
          body: {
            query: options.textQuery,
            language: languageHint,
          },
        }
      );
    } else {
      // Audio mode — send as multipart form data
      const audioResponse = await fetch(options.audioUri);
      const audioBlob = await audioResponse.blob();

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      if (languageHint) {
        formData.append("language", languageHint);
      }

      response = await supabase.functions.invoke<ParseVoiceResponse>(
        "parse-voice",
        { body: formData }
      );
    }

    if (response.error) {
      console.error(
        "[ai-voice-parser] Edge Function error:",
        response.error.message
      );
      return [];
    }

    const data = response.data;
    if (!data?.transactions || !Array.isArray(data.transactions)) {
      console.warn("[ai-voice-parser] No transactions in response");
      return [];
    }

    // Map AI response to ParsedSmsTransaction (filter out malformed entries)
    const now = new Date();
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

    const results: ParsedSmsTransaction[] = validTransactions.map(
      (aiTx: AiVoiceTransaction): ParsedSmsTransaction => ({
        amount: Math.abs(aiTx.amount),
        currency: normalizeCurrency(aiTx.currency),
        type: normalizeType(aiTx.type),
        counterparty: aiTx.merchant,
        merchant: aiTx.merchant,
        date: now, // Voice transactions default to current time
        smsBodyHash: "", // Not applicable for voice
        senderDisplayName: VOICE_INPUT_SENDER,
        // Voice parser has no DB access — use empty categoryId (must be resolved by consumer)
        categoryId: "",
        categoryDisplayName:
          aiTx.categorySystemName || DEFAULT_CATEGORY_DISPLAY_NAME,
        rawSmsBody: aiTx.description || "",
        confidence: VOICE_AI_CONFIDENCE_BASELINE,
      })
    );

    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-voice-parser] Unexpected error:", message);
    return [];
  }
}
