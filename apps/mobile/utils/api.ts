/**
 * API Utilities for Monyvi
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!SUPABASE_ANON_KEY && __DEV__) {
  console.warn("⚠️ Missing EXPO_PUBLIC_SUPABASE_ANON_KEY env variable");
}

/**
 * Parsed AI Transaction structure from Edge Function
 */
export interface AITransaction {
  amount: number;
  currency: "EGP" | "USD" | "XAU";
  type: "expense" | "income" | "loan" | "borrow";
  category: string | null;
  description: string;
  account: string | null;
}

export interface AIParseResult {
  transactions: AITransaction[];
}

/**
 * Call the AI parser Edge Function
 */
export async function parseVoiceWithAI(
  text: string,
  language?: string
): Promise<AIParseResult> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-transaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          query: text,
          language: language || "unknown",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Parser Error:", errorText);
      throw new Error(`AI processing failed: ${response.status}`);
    }

    const data = (await response.json()) as AIParseResult;
    console.log("DEBUG: AI Raw Response:", JSON.stringify(data, null, 2));

    if (!data.transactions) {
      console.warn("DEBUG: No transactions array in response", data);
    }

    return data;
  } catch (error) {
    console.error("AI Parser Exception:", error);
    throw error;
  }
}
