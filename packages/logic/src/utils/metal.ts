import { MetalType } from "@astik/db";
import { MarketRates } from "../types";

/**
 * Get the current price per gram for a metal type
 */
export function getMetalPrice(
  metalType: MetalType,
  marketRates: NonNullable<MarketRates>
): number {
  switch (metalType) {
    case "GOLD":
      return marketRates.gold_egp_per_gram;
    case "SILVER":
      return marketRates.silver_egp_per_gram;
    case "PLATINUM":
      return marketRates.platinum_egp_per_gram;
    case "PALLADIUM":
      return marketRates.palladium_egp_per_gram;
    default:
      return 0;
  }
}
