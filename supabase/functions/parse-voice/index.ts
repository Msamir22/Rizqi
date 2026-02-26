/**
 * parse-voice Edge Function
 *
 * Receives an audio recording (or transcribed text), processes it through
 * Gemini 2.5 Flash-Lite (native multimodal), and returns structured
 * transaction data with category assignments.
 *
 * Supports Arabic (MSA + Egyptian dialect), English, and code-switching.
 *
 * @module parse-voice
 */

import "edge-runtime";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Maximum audio size in bytes (~1 minute of compressed audio). */
const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Category tree — same as parse-sms, kept in sync.
// ---------------------------------------------------------------------------

const CATEGORY_TREE = `
EXPENSE categories (use the system_name value):
  food_drinks: groceries, restaurant, coffee_tea, snacks, drinks, food_other
  transportation: public_transport, private_transport, transport_other
  vehicle: fuel, parking, rental, license_fees, vehicle_tax, traffic_fine, vehicle_buy, vehicle_sell, vehicle_maintenance, vehicle_other
  shopping: clothes, electronics_appliances, accessories, footwear, bags, kids_baby, beauty, home_garden, pets, sports_fitness, toys_games, wedding, detergents, decorations, personal_care, shopping_other
  health_medical: doctor, medicine, surgery, dental, health_other
  utilities_bills: electricity, water, internet, phone, gas, trash, online_subscription, streaming, taxes, utilities_other
  entertainment: events, tickets, entertainment_other
  charity: donations, fundraising, charity_gifts, charity_other
  education: books, tuition, education_fees, education_other
  housing: rent, housing_maintenance, housing_tax, housing_buy, housing_sell, housing_other
  travel: vacation, business_travel, holiday, travel_other
  debt_loans: lent_money, borrowed_money, debt_repayment_paid, debt_repayment_received, debt_other
  other: uncategorized

INCOME categories:
  income: salary, bonus, commission, refund, loan_income, gift_income, check, rental_income, freelance, business_income, income_other
`;

// ---------------------------------------------------------------------------
// Gemini response JSON schema
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      description: "Array of extracted transactions from the voice input.",
      items: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Transaction amount as a positive number.",
          },
          currency: {
            type: "string",
            description: "ISO 4217 currency code. Default to EGP if unclear.",
            enum: ["EGP", "USD", "EUR", "GBP", "SAR", "AED", "KWD"],
          },
          type: {
            type: "string",
            description:
              "Transaction type: EXPENSE for spending, INCOME for receiving money.",
            enum: ["EXPENSE", "INCOME"],
          },
          merchant: {
            type: "string",
            description:
              "The merchant, vendor, person, or counterparty name. Translate to English if originally in Arabic.",
          },
          categorySystemName: {
            type: "string",
            description:
              "The most specific L2 category system_name from the category tree. Fall back to L1 or 'uncategorized'.",
          },
          description: {
            type: "string",
            description:
              "Short description of the transaction. Translate to English if originally in Arabic.",
          },
        },
        required: [
          "amount",
          "currency",
          "type",
          "merchant",
          "categorySystemName",
          "description",
        ],
      },
    },
  },
  required: ["transactions"],
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Astik AI, a voice-to-transaction parser for an Egyptian personal finance app.

YOUR TASK:
Listen to the user's voice input (or read their transcribed text) and extract financial transactions.
The user might speak in English, Arabic (MSA or Egyptian dialect), a mix, or Franco-Arab.

PARSING RULES:
1. A user may describe one or more transactions in a single recording.
2. Amount: Extract numerical amounts. Handle spoken numbers in Arabic or English.
3. Currency: Default to EGP unless another currency is explicitly mentioned.
4. Type: EXPENSE for spending (bought, paid, etc.), INCOME for receiving (salary, gift, received, etc.).
5. Merchant: The entity or person involved. Translate Arabic names to English where reasonable.
6. Category: Assign the MOST SPECIFIC L2 category from the tree below. Fall back to L1 or "uncategorized".
7. Description: A brief English summary of the transaction.

EXAMPLES:
- "اشتريت قهوة من ستاربكس بـ ٨٠ جنيه" → { amount: 80, currency: "EGP", type: "EXPENSE", merchant: "Starbucks", categorySystemName: "coffee_tea", description: "Coffee from Starbucks" }
- "Paid 200 pounds for Uber" → { amount: 200, currency: "EGP", type: "EXPENSE", merchant: "Uber", categorySystemName: "private_transport", description: "Uber ride" }
- "I received my salary, 15000" → { amount: 15000, currency: "EGP", type: "INCOME", merchant: "Employer", categorySystemName: "salary", description: "Monthly salary" }

CATEGORY TREE:
${CATEGORY_TREE}

IMPORTANT:
- Return ONLY valid transactions. If the audio is unclear or non-financial, return an empty transactions array.
- Multiple transactions in one recording should each be a separate item in the array.
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceTransaction {
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly merchant: string;
  readonly categorySystemName: string;
  readonly description: string;
}

interface AiResponse {
  readonly transactions: ReadonlyArray<VoiceTransaction>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ error: message, code: status }, status);
}

/**
 * Verify the JWT from the Authorization header.
 */
async function verifyAuth(
  authHeader: string | null
): Promise<{ userId: string } | null> {
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;
  return { userId: data.user.id };
}

/**
 * Detect audio MIME type from the first bytes of the file.
 */
function detectAudioMimeType(bytes: Uint8Array): string {
  // Check for common audio file signatures
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67)
    return "audio/ogg";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    return "audio/wav";
  // Default to webm for most mobile recordings
  return "audio/webm";
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // 1. Auth
    const auth = await verifyAuth(req.headers.get("authorization"));
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    // 2. Parse input — supports both multipart form data and JSON (text query)
    const contentType = req.headers.get("content-type") ?? "";
    let audioBytes: Uint8Array | null = null;
    let textQuery: string | null = null;
    let languageHint: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio");
      languageHint = formData.get("language") as string | null;

      if (audioFile instanceof File) {
        if (audioFile.size === 0) {
          return errorResponse("Audio file is empty.", 400);
        }
        if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
          return errorResponse(
            `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024} MB.`,
            413
          );
        }
        const buffer = await audioFile.arrayBuffer();
        audioBytes = new Uint8Array(buffer);
      }
    } else if (contentType.includes("application/json")) {
      // Fallback: accept a text transcription for testing / future use
      let body: { query?: unknown; language?: unknown };
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body.", 400);
      }

      if (typeof body.query !== "string" || body.query.trim().length === 0) {
        return errorResponse("`query` must be a non-empty string.", 400);
      }
      textQuery = body.query.trim();
      languageHint = typeof body.language === "string" ? body.language : null;
    }

    if (!audioBytes && !textQuery) {
      return errorResponse(
        "Either an 'audio' file (multipart) or a 'query' string (JSON) is required."
      );
    }

    // 3. Init Gemini
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return errorResponse("GEMINI_API_KEY not configured", 500);
    }
    const ai = new GoogleGenAI({ apiKey });

    // 4. Build content parts
    let contents: unknown;

    if (audioBytes) {
      // Multimodal: audio + text prompt
      const mimeType = detectAudioMimeType(audioBytes);
      // Encode in chunks to avoid call-stack limits on large buffers
      const CHUNK_SIZE = 8192;
      let binaryString = "";
      for (let i = 0; i < audioBytes.length; i += CHUNK_SIZE) {
        const chunk = audioBytes.subarray(i, i + CHUNK_SIZE);
        binaryString += String.fromCharCode(...chunk);
      }
      const base64Audio = btoa(binaryString);

      contents = [
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        {
          text: `Parse the financial transactions from this voice recording.${
            languageHint ? ` Language hint: ${languageHint}.` : ""
          }`,
        },
      ];
    } else {
      // Text-only mode (transcription or test)
      contents = `Parse this voice command into transactions: "${textQuery}".${
        languageHint ? ` Language: ${languageHint}.` : ""
      }`;
    }

    // 5. Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    });

    const text = response.text;
    if (!text) {
      return jsonResponse({ transactions: [] });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse({ transactions: [] });
    }

    const transactions = Array.isArray(
      (parsed as Partial<AiResponse>)?.transactions
    )
      ? (parsed as AiResponse).transactions
      : [];

    // 6. Return results
    return jsonResponse({ transactions });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[parse-voice] Error:", message);
    return errorResponse("Internal server error", 500);
  }
});
