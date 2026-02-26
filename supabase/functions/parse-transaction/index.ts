/**
 * @deprecated MARKED FOR DELETION — Replaced by `parse-voice` and `parse-sms` Edge Functions.
 * New functions use Gemini 2.5 Flash-Lite instead of OpenAI GPT-4o-mini.
 * Kept temporarily until new Edge Functions are validated.
 */

import "edge-runtime";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, language } = await req.json();

    if (!query) {
      throw new Error("Query is required");
    }

    const systemPrompt = `
    You are an AI parser for a personal finance app called Astik.
    Your job is to parse natural language voice commands into structured financial transactions.
    
    The user might speak in:
    - English
    - Arabic (Modern Standard or Egyptian Dialect)
    - A mix of both (Franco-Arab or code-switching)
    
    You need to extract a JSON object with a "transactions" array. Each object in the array must have:
    
    1. **amount**: number (Required)
    
    2. **type**: One of ["expense", "income", "loan", "borrow"] (Required)
       - "expense": Spending money (bought, paid, etc)
       - "income": Receiving money (salary, gift, etc)
       - "loan": User GIVING money to someone as a loan (outgoing debt)
       - "borrow": User TAKING money from someone as a loan (incoming debt)
    
    3. **category**: String or null.
       - IF type is "expense": Must be one of ["Food", "Transport", "Utilities", "Shopping", "Entertainment", "Health", "Education", "Housing", "Other"]. Infer from item name (e.g., KFC -> Food, Uber -> Transport).
       - IF type is NOT "expense": MUST be null.
    
    4. **account**: String or null.
       - ONLY return a value if the user deliberately mentions the account name (e.g., "from CIB", "on my wallet", "use cash account").
       - If user does NOT mention an account, return null (the app will handle the default).
       - Normalize common names: "CIB" -> "CIB", "cash" -> "Cash", "wallet" -> "Wallet".
    
    5. **currency**: "EGP" | "USD" | "XAU". Default to "EGP" unless specified.
    
    6. **description**: Short description of the item or person (e.g., "Coffee", "John", "Uber"). Translate to English if possible.
    
    Rules:
    - "Bought coffee 50" -> type: "expense", category: "Food", account: null
    - "Gave Ahmed 1000" -> type: "loan", category: null, description: "Ahmed"
    - "Took 200 from Sara" -> type: "borrow", category: null, description: "Sara"
    - "Pay electric bill 200 from CIB" -> type: "expense", category: "Utilities", account: "CIB"
    
    Return ONLY valid JSON.
    `;

    const userPrompt = `Parse this voice command: "${query}". Detected language context: ${language || "unknown"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const result = completion.choices[0].message.content;

    if (!result) {
      throw new Error("No result from AI");
    }

    const parsedData = JSON.parse(result);

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
