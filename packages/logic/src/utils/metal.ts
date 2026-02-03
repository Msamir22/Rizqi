import { MarketRate, MetalType } from "@astik/db";

/**
 * Get the current price per gram for a metal type
 */
export function getMetalPrice(
  metalType: MetalType,
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
