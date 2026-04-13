import type { AssetMetal, MarketRate } from "@astik/db";
import { MetalPriceUnavailableError, getMetalPriceUsd } from "../utils/metal";

/**
 * Calculates the total USD value of the provided metal assets.
 *
 * Formula: weight_grams × purity_fraction × price_per_gram_usd.
 *
 * purity_fraction is expected normalized to the range 0.0–1.0:
 * - Gold: stored as karat/24 (e.g., 21K → 0.875)
 * - Silver/Platinum/Palladium: stored as fineness/1000 (e.g., 925 → 0.925)
 *
 * @param assetMetals - Array of asset metal holdings to value
 * @param marketRates - Market rates providing current USD price per gram for supported metals
 * @returns The sum of all asset metal values in USD
 */
export function calculateTotalAssets(
  assetMetals: AssetMetal[],
  marketRates: MarketRate
): number {
  if (!marketRates) {
    return 0;
  }

  return assetMetals.reduce((total, metal) => {
    try {
      const pricePerGram = getMetalPriceUsd(metal.metalType, marketRates);
      const value = metal.calculateValue(pricePerGram);
      return total + value;
    } catch (error: unknown) {
      if (error instanceof MetalPriceUnavailableError) {
        return total;
      }
      throw error;
    }
  }, 0);
}
