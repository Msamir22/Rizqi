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

import type { ParsedSmsTransaction } from "@astik/logic/src/types";
import type { CurrencyType, TransactionType } from "@astik/db";

// ---------------------------------------------------------------------------
// Types — AI response shape
// ---------------------------------------------------------------------------

interface AiVoiceTransaction {
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly merchant: string;
  readonly categorySystemName: string;
  readonly description: string;
}

interface ParseVoiceResponse {
  readonly transactions: ReadonlyArray<AiVoiceTransaction>;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Constants
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
): Promise<ReadonlyArray<ParsedSmsTransaction>> {
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

    // Map AI response to ParsedSmsTransaction
    const now = new Date();
    const results: ParsedSmsTransaction[] = data.transactions.map(
      (aiTx: AiVoiceTransaction): ParsedSmsTransaction => ({
        amount: Math.abs(aiTx.amount),
        currency: normalizeCurrency(aiTx.currency),
        type: normalizeType(aiTx.type),
        counterparty: aiTx.merchant,
        merchant: aiTx.merchant,
        date: now, // Voice transactions default to current time
        smsBodyHash: "", // Not applicable for voice
        senderAddress: "voice-input",
        senderDisplayName: aiTx.merchant,
        categorySystemName: aiTx.categorySystemName || "uncategorized",
        rawSmsBody: aiTx.description || "",
        confidence: 0.8, // Voice AI confidence baseline
      })
    );

    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-voice-parser] Unexpected error:", message);
    return [];
  }
}
