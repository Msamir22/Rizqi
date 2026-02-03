import type { AssetMetal, MarketRate } from "@astik/db";

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
  marketRates: MarketRate
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
  marketRates: NonNullable<MarketRate>
): number {
  switch (metalType) {
    case "GOLD":
      return marketRates.goldEgpPerGram;
    case "SILVER":
      return marketRates.silverEgpPerGram;
    case "PLATINUM":
      return marketRates.platinumEgpPerGram;
    case "PALLADIUM":
      return marketRates.palladiumEgpPerGram;
    default:
      return 0;
  }
}
