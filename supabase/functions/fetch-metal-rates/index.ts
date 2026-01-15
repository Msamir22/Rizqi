import "edge-runtime";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CurrenciesApiResponse {
  AED: number; // United Arab Emirates (Dirham)
  AUD: number; // Australia (Dollar)
  BHD: number; // Bahrain (Dinar)
  BTC: number; // Bitcoin (Crypto)
  CAD: number; // Canada (Dollar)
  CHF: number; // Switzerland (Franc)
  CNH: number; // China (Offshore Yuan)
  CNY: number; // China (Yuan Renminbi)
  DKK: number; // Denmark (Krone)
  DZD: number; // Algeria (Dinar)
  EGP: number; // Egypt (Pound)
  EUR: number; // Eurozone (Euro)
  GBP: number; // United Kingdom (Pound)
  HKD: number; // Hong Kong (Dollar)
  INR: number; // India (Rupee)
  IQD: number; // Iraq (Dinar)
  ISK: number; // Iceland (Krona)
  JOD: number; // Jordan (Dinar)
  JPY: number; // Japan (Yen)
  KPW: number; // North Korea (Won)
  KRW: number; // South Korea (Won)
  KWD: number; // Kuwait (Dinar)
  LYD: number; // Libya (Dinar)
  MAD: number; // Morocco (Dirham)
  MYR: number; // Malaysia (Ringgit)
  NOK: number; // Norway (Krone)
  NZD: number; // New Zealand (Dollar)
  OMR: number; // Oman (Rial)
  QAR: number; // Qatar (Riyal)
  RUB: number; // Russia (Ruble)
  SAR: number; // Saudi Arabia (Riyal)
  SEK: number; // Sweden (Krona)
  SGD: number; // Singapore (Dollar)
  TND: number; // Tunisia (Dinar)
  TRY: number; // Turkey (Lira)
  USD: number; // United States (Dollar)
  ZAR: number; // South Africa (Rand)
}

interface MetalsApiResponse {
  gold: number;
  silver: number;
  platinum: number;
  palladium: number;
}

interface MetalsDevApiResponse {
  status: string;
  currency: string;
  unit: string;

  metals: MetalsApiResponse;
  currencies: CurrenciesApiResponse;
  timestamps: {
    metal: string;
    currency: string;
  };
}

interface MarketRatesRow {
  // Precious metal prices (EGP per gram)
  gold_egp_per_gram: number;
  silver_egp_per_gram: number;
  platinum_egp_per_gram: number;
  palladium_egp_per_gram: number;
  // Currency exchange rates (to EGP)
  usd_egp: number;
  eur_egp: number;
  gbp_egp: number;
  aed_egp: number;
  aud_egp: number;
  bhd_egp: number;
  btc_egp: number;
  cad_egp: number;
  chf_egp: number;
  cnh_egp: number;
  cny_egp: number;
  dkk_egp: number;
  dzd_egp: number;
  hkd_egp: number;
  inr_egp: number;
  iqd_egp: number;
  isk_egp: number;
  jod_egp: number;
  jpy_egp: number;
  kpw_egp: number;
  krw_egp: number;
  kwd_egp: number;
  lyd_egp: number;
  mad_egp: number;
  myr_egp: number;
  nok_egp: number;
  nzd_egp: number;
  omr_egp: number;
  qar_egp: number;
  rub_egp: number;
  sar_egp: number;
  sek_egp: number;
  sgd_egp: number;
  tnd_egp: number;
  try_egp: number;
  zar_egp: number;
  // Timestamps
  timestamp_metal: string;
  timestamp_currency: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the metals.dev API key from environment
    const metalsApiKey = Deno.env.get("METALS.DEV_API_KEY");
    if (!metalsApiKey) {
      throw new Error("METALS.DEV_API_KEY is not configured");
    }

    // Fetch from metals.dev API
    const apiUrl = `https://api.metals.dev/v1/latest?api_key=${metalsApiKey}&currency=EGP&unit=g`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(
        `metals.dev API error: ${response.status} ${response.statusText}`
      );
    }

    const data: MetalsDevApiResponse = await response.json();

    if (data.status !== "success") {
      throw new Error(`metals.dev API returned status: ${data.status}`);
    }

    // Extract values from the API response (precious metals and currencies only)
    const marketRates: MarketRatesRow = {
      // Precious metal prices (EGP per gram)
      gold_egp_per_gram: data.metals.gold,
      silver_egp_per_gram: data.metals.silver,
      platinum_egp_per_gram: data.metals.platinum,
      palladium_egp_per_gram: data.metals.palladium,
      // Currency exchange rates (to EGP)
      usd_egp: data.currencies.USD,
      eur_egp: data.currencies.EUR,
      gbp_egp: data.currencies.GBP,
      aed_egp: data.currencies.AED,
      aud_egp: data.currencies.AUD,
      bhd_egp: data.currencies.BHD,
      btc_egp: data.currencies.BTC,
      cad_egp: data.currencies.CAD,
      chf_egp: data.currencies.CHF,
      cnh_egp: data.currencies.CNH,
      cny_egp: data.currencies.CNY,
      dkk_egp: data.currencies.DKK,
      dzd_egp: data.currencies.DZD,
      hkd_egp: data.currencies.HKD,
      inr_egp: data.currencies.INR,
      iqd_egp: data.currencies.IQD,
      isk_egp: data.currencies.ISK,
      jod_egp: data.currencies.JOD,
      jpy_egp: data.currencies.JPY,
      kpw_egp: data.currencies.KPW,
      krw_egp: data.currencies.KRW,
      kwd_egp: data.currencies.KWD,
      lyd_egp: data.currencies.LYD,
      mad_egp: data.currencies.MAD,
      myr_egp: data.currencies.MYR,
      nok_egp: data.currencies.NOK,
      nzd_egp: data.currencies.NZD,
      omr_egp: data.currencies.OMR,
      qar_egp: data.currencies.QAR,
      rub_egp: data.currencies.RUB,
      sar_egp: data.currencies.SAR,
      sek_egp: data.currencies.SEK,
      sgd_egp: data.currencies.SGD,
      tnd_egp: data.currencies.TND,
      try_egp: data.currencies.TRY,
      zar_egp: data.currencies.ZAR,
      // Timestamps
      timestamp_metal: data.timestamps.metal,
      timestamp_currency: data.timestamps.currency,
      created_at: new Date().toISOString(),
    };

    // Create Supabase client with service role for database access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not configured");
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert new row into market_rates table
    const { error: insertError } = await supabase
      .from("market_rates")
      .insert(marketRates);

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Market rates updated successfully",
        data: {
          metals: {
            gold: marketRates.gold_egp_per_gram,
            silver: marketRates.silver_egp_per_gram,
            platinum: marketRates.platinum_egp_per_gram,
            palladium: marketRates.palladium_egp_per_gram,
          },
          currencies: {
            usd: marketRates.usd_egp,
            eur: marketRates.eur_egp,
            gbp: marketRates.gbp_egp,
          },
          timestamps: {
            metal: marketRates.timestamp_metal,
            currency: marketRates.timestamp_currency,
          },
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    console.error("fetch-metal-rates error:", errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
