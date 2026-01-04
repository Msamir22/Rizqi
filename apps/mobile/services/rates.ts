/**
 * Market Rates Service
 * Fetches and caches market rates from Supabase
 */

import { supabase } from "./supabase";

export interface MarketRates {
  goldEgpPerGram: number;
  silverEgpPerGram: number;
  usdEgp: number;
  eurEgp: number;
  timestamp: Date;
}

// In-memory cache
let cachedRates: MarketRates | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Fetch latest market rates from Supabase
 */
export async function fetchMarketRates(): Promise<MarketRates | null> {
  // Check cache first
  const now = Date.now();
  if (cachedRates && now - lastFetchTime < CACHE_DURATION_MS) {
    return cachedRates;
  }

  try {
    const { data, error } = await supabase
      .from("market_rates")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching market rates:", error);
      return cachedRates; // Return cached data if available
    }

    if (!data) {
      return null;
    }

    // Parse the JSONB fields
    const metals = data.metals as { gold?: number; silver?: number };
    const currencies = data.currencies as { EGP?: number; EUR?: number };

    // Calculate EGP rates from USD base
    // metals.dev returns prices in USD per gram
    const usdEgp = currencies.EGP ?? 50; // Fallback exchange rate
    const eurEgp = (currencies.EGP ?? 50) / (currencies.EUR ?? 0.92);

    cachedRates = {
      goldEgpPerGram: (metals.gold ?? 0) * usdEgp,
      silverEgpPerGram: (metals.silver ?? 0) * usdEgp,
      usdEgp,
      eurEgp,
      timestamp: new Date(data.timestamp),
    };
    lastFetchTime = now;

    return cachedRates;
  } catch (err) {
    console.error("Exception fetching market rates:", err);
    return cachedRates;
  }
}

/**
 * Convert amount from any currency to EGP
 */
export function convertToEgp(
  amount: number,
  currency: "EGP" | "USD" | "EUR",
  rates: MarketRates | null
): number {
  if (!rates) return amount;

  switch (currency) {
    case "EGP":
      return amount;
    case "USD":
      return amount * rates.usdEgp;
    case "EUR":
      return amount * rates.eurEgp;
    default:
      return amount;
  }
}

/**
 * Convert amount from EGP to any currency
 */
export function convertFromEgp(
  amountEgp: number,
  toCurrency: "EGP" | "USD" | "EUR",
  rates: MarketRates | null
): number {
  if (!rates) return amountEgp;

  switch (toCurrency) {
    case "EGP":
      return amountEgp;
    case "USD":
      return amountEgp / rates.usdEgp;
    case "EUR":
      return amountEgp / rates.eurEgp;
    default:
      return amountEgp;
  }
}

/**
 * Calculate gold value
 */
export function calculateGoldValue(
  weightGrams: number,
  purityKarat: number,
  rates: MarketRates | null
): number {
  if (!rates) return 0;
  return weightGrams * (purityKarat / 24) * rates.goldEgpPerGram;
}

/**
 * Calculate silver value
 */
export function calculateSilverValue(
  weightGrams: number,
  rates: MarketRates | null
): number {
  if (!rates) return 0;
  return weightGrams * rates.silverEgpPerGram;
}

/**
 * Force refresh rates (bypass cache)
 */
export async function refreshMarketRates(): Promise<MarketRates | null> {
  cachedRates = null;
  lastFetchTime = 0;
  return fetchMarketRates();
}
