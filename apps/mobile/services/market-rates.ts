import { get } from "./request";
import { MarketRates, PreviousDayRates } from "@astik/logic";

/**
 * Fetch latest market rates from API
 */
export async function getLatestMarketRates(): Promise<MarketRates | null> {
  const { data, error } = await get("/api/market-rates");

  if (error) {
    console.error("Error fetching market rates:", error);
    return null;
  }

  return data;
}

/**
 * Fetch previous day market rates snapshot for trend comparison
 */
export async function getPreviousDayRates(): Promise<PreviousDayRates | null> {
  const { data, error } = await get("/api/market-rates/previous-day");

  if (error) {
    console.error("Error fetching previous day rates:", error);
    return null;
  }

  return data;
}
