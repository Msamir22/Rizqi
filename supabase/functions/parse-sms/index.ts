/**
 * parse-sms Edge Function
 *
 * Receives a batch of SMS messages from a single client chunk,
 * parses them through Gemini 2.5 Flash-Lite with retry/backoff,
 * and returns structured transaction data.
 *
 * Architecture & Design Rationale:
 * - Pattern: Gateway + Retry (exponential backoff)
 * - Why: Gemini rate limits cause 429/500 errors under load.
 *   Retry with backoff absorbs transient failures without pushing
 *   complexity to the mobile client.
 * - SOLID: SRP — only handles AI interaction, no filtering.
 *
 * @module parse-sms
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

/** Max retries for Gemini API calls. */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms). Retries: 2s, 4s, 8s. */
const BASE_RETRY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Category tree — embedded to avoid DB round-trips.
// Mirrors the L1/L2 hierarchy from migration 004_update_categories.sql.
// The AI MUST return one of these exact system_name values.
// ---------------------------------------------------------------------------

const CATEGORY_TREE = `
EXPENSE categories (return the system_name value):
  L1: food_drinks
    L2: groceries, restaurant, coffee_tea, snacks, drinks, food_other
  L1: transportation
    L2: public_transport, private_transport, transport_other
  L1: vehicle
    L2: fuel, parking, rental, license_fees, vehicle_tax, traffic_fine, vehicle_buy, vehicle_sell, vehicle_maintenance, vehicle_other
  L1: shopping
    L2: clothes, electronics_appliances, accessories, footwear, bags, kids_baby, beauty, home_garden, pets, sports_fitness, toys_games, wedding, detergents, decorations, personal_care, shopping_other
  L1: health_medical
    L2: doctor, medicine, surgery, dental, health_other
  L1: utilities_bills
    L2: electricity, water, internet, phone, gas, trash, online_subscription, streaming, taxes, utilities_other
  L1: entertainment
    L2: events, tickets, trips_holidays, entertainment_other
  L1: charity
    L2: donations, fundraising, charity_gifts, charity_other
  L1: education
    L2: books, tuition, education_fees, education_other
  L1: housing
    L2: rent, housing_maintenance, housing_tax, housing_buy, housing_sell, housing_other
  L1: travel
    L2: vacation, business_travel, holiday, travel_other
  L1: debt_loans
    L2: lent_money, debt_repayment_paid, debt_other
  L1: asset_purchase
  L1: other
    L2: uncategorized

INCOME categories:
  L1: income
    L2: salary, bonus, commission, refund, loan_income, gift_income, check, rental_income, freelance, business_income, income_other
  L1: asset_sale
  L1: debt_loans
    L2: borrowed_money, debt_repayment_received
`;

// ---------------------------------------------------------------------------
// Gemini response JSON schema
// ---------------------------------------------------------------------------
// TODO: instruct AI to return suggestions for accounts needs to be created based on the SMS content.
// we should send an array of an existing accounts name  & currency to the AI to let it decide whether this user need to create an additional accounts
// if the AI decides that the user need to create an additional accounts, it should return an array of account names to be created.
// if the array of the accounts is empty, then it's a new user and the retruend array of account names is required and AI should return it based on the SMS content.
// the shape of array should be like this : [{name: "account1", currency: "EGP"}, {name: "account2", currency: "USD"}, {name: "account3", currency: "EUR"}]
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      description:
        "Array of parsed transactions. Only include CLEARLY financial transactions.",
      items: {
        type: "object",
        properties: {
          messageId: {
            type: "string",
            description: "Original SMS message ID.",
          },
          amount: {
            type: "number",
            description: "Transaction amount as positive number.",
          },
          currency: {
            type: "string",
            // if the currency detected in the message is not supported, then we should ignore the message.
            enum: ["EGP", "USD", "EUR", "GBP", "SAR", "AED", "KWD"], // should be dynamic based on the Supported Currencies.
          },
          type: {
            type: "string",
            enum: ["EXPENSE", "INCOME"],
          },
          // rename this to counterparty to be the same name as we have in the DB
          merchant: {
            type: "string",
            description: "Merchant/counterparty name.",
          },
          date: {
            type: "string",
            description: "YYYY-MM-DD format.",
          },
          categorySystemName: {
            type: "string",
            description:
              "Exactly ONE system_name from the category tree. Use a specific L2 ONLY when confident. If uncertain about which L2 fits, use the L1 parent instead. NEVER use *_other L2 categories (e.g. food_other, shopping_other) — use the L1 parent. Fall back to 'other' only as last resort.",
          },
          financialEntity: {
            type: "string",
            description:
              "The bank/wallet/fintech name (e.g. CIB, NBE, Vodafone Cash).",
          },
          isAtmWithdrawal: {
            type: "boolean",
            description: "True for ATM/Bank cash withdrawals only.",
          },
          cardLast4: {
            type: "string",
            description: "Last 4 digits of card if mentioned.",
          },
        },
        required: [
          "messageId",
          "amount",
          "currency",
          "type",
          "merchant",
          "date",
          "categorySystemName",
        ],
      },
    },
  },
  required: ["transactions"],
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Astik AI, a financial SMS parser for an Egyptian personal finance app.

YOUR TASK:
Parse each SMS and extract structured transaction data.
Only include messages that are CLEARLY financial transactions.

INCLUDE ONLY:
- Card purchases / POS payments
- ATM withdrawals
- Bank withdrawals
- Bank transfers (sent/received, including InstaPay)
- Mobile wallet payments and transfers
- Salary credits
- Loan disbursements / repayments
- Bill payments through banking apps
- Refunds to bank account

DO NOT INCLUDE:
- OTP / verification codes
- Marketing / promotional SMS
- Balance inquiry responses
- Telecom recharges / top-ups / data bundles
- SIM subscriptions
- Loyalty / reward points
- Card activation / deactivation notices
- Password reset or security alerts
- App download links
- Any message where you are uncertain

WHEN IN DOUBT, SKIP. Precision > recall.

PARSING RULES:
1. Amount: positive number, remove separators, handle Arabic numerals.
2. Currency: the default currency is EGP, but it can be different based on the SMS content.
3. Type: EXPENSE = money out, INCOME = money in.
4. Merchant: counterparty name.
5. Date: from SMS body or use provided date.
6. Category: return EXACTLY ONE system_name from the tree below. Use a specific L2 when confident (e.g. groceries, restaurant). If uncertain which L2 fits, use the L1 parent (e.g. food_drinks, shopping). NEVER use *_other L2 categories (food_other, shopping_other, etc.) — always prefer the L1 parent. Only use 'other' as an absolute last resort.
7. financialEntity: bank/wallet name from SMS content.
8. isAtmWithdrawal: true only for ATM withdrawals.
9. cardLast4: last 4 card digits if mentioned.

CATEGORY TREE:
${CATEGORY_TREE}

Handle Arabic naturally. InstaPay: \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0649 = sent (EXPENSE), \u062a\u062d\u0648\u064a\u0644 \u0645\u0646 = received (INCOME).
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsInput {
  readonly id: string;
  readonly body: string;
  readonly sender: string;
  readonly date: string;
}

interface ParseSmsRequest {
  readonly messages: ReadonlyArray<SmsInput>;
}

interface AiTransaction {
  readonly messageId: string;
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly merchant: string;
  readonly date: string;
  readonly categorySystemName: string;
  readonly financialEntity?: string;
  readonly isAtmWithdrawal?: boolean;
  readonly cardLast4?: string;
}

interface AiResponse {
  readonly transactions: ReadonlyArray<AiTransaction>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message, code: status }, status);
}

/**
 * Verify the JWT from the Authorization header using Supabase client.
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
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process messages through Gemini with retry and exponential backoff.
 * Retries up to MAX_RETRIES times on failure (2s → 4s → 8s delays).
 */
async function processWithRetry(
  ai: GoogleGenAI,
  messages: ReadonlyArray<SmsInput>
): Promise<ReadonlyArray<AiTransaction>> {
  const userPrompt = `Parse the following ${messages.length} SMS messages into transactions:

${messages
  .map(
    (m) =>
      `--- MESSAGE ID: ${m.id} ---
Sender: ${m.sender}
Date: ${m.date}
Body: ${m.body}
`
  )
  .join("\n")}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(
          `[parse-sms] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`
        );
        await sleep(delay);
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 1,
        },
      });

      const text = response.text ?? "";
      if (!text) return [];

      const parsed: AiResponse = JSON.parse(text);
      return parsed.transactions ?? [];
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[parse-sms] Attempt ${attempt + 1} failed: ${errMsg}`);

      // Don't retry on non-retryable errors (auth, bad request)
      if (
        errMsg.includes("401") ||
        errMsg.includes("403") ||
        errMsg.includes("INVALID")
      ) {
        break;
      }
    }
  }

  // All retries exhausted
  const finalMsg =
    lastError instanceof Error ? lastError.message : "Unknown error";
  console.error(`[parse-sms] All retries exhausted: ${finalMsg}`);
  return [];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // 1. Auth
    const auth = await verifyAuth(req.headers.get("authorization"));
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    // 2. Parse input
    const body: ParseSmsRequest = await req.json();
    if (!body.messages || !Array.isArray(body.messages)) {
      return errorResponse("'messages' array is required");
    }
    if (body.messages.length === 0) {
      return jsonResponse({ transactions: [] });
    }

    // 3. Init Gemini
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return errorResponse("GEMINI_API_KEY not configured", 500);
    }
    const ai = new GoogleGenAI({ apiKey });

    // 4. Process all messages in a single Gemini call (with retry).
    //    Client-side chunking ensures each call stays under the ~150s limit.
    const transactions = await processWithRetry(ai, body.messages);

    console.log(
      `[parse-sms] Parsed ${transactions.length} from ${body.messages.length} messages`
    );

    // 5. Return results
    return jsonResponse({ transactions });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[parse-sms] Error:", message);
    return errorResponse(message, 500);
  }
});
