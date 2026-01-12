import type { AssetMetal } from "@astik/db";
import type { MarketRates } from "../types";

/**
 * Calculate total assets value in EGP
 *
 * Formula: weight_grams × purity_fraction × price_per_gram
 *
 * purity_fraction is already normalized (0.0-1.0):
 * - Gold: stored as karat/24 (e.g., 21K = 0.875)
 * - Silver/Platinum/Palladium: stored as fineness/1000 (e.g., 925 = 0.925)
 */
export function calculateTotalAssets(
  assetMetals: AssetMetal[],
  marketRates: MarketRates
): number {
  if (!marketRates) {
    return 0;
  }

  return assetMetals.reduce((total, metal) => {
    const pricePerGram = getMetalPrice(metal.metalType, marketRates);
    const value = metal.calculateValue(pricePerGram);
    return total + value;
  }, 0);
}

/**
 * Get the current price per gram for a metal type
 */
function getMetalPrice(
  metalType: AssetMetal["metalType"],
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
