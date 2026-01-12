import { ApiEndpoints, MarketRates } from "@astik/logic";
import { apiGet } from "./requrest.service";

/**
 * Fetch latest market rates from API
 */
export async function getLatestMarketRates(): Promise<MarketRates> {
  try {
    const { data, error } = await apiGet<MarketRates>(ApiEndpoints.marketRates);

    if (error || !data) {
      console.error("Error fetching market rates:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception fetching market rates:", err);
    return null;
  }
}
