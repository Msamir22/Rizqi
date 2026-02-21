import type { CurrencyType, MarketRate, MetalType } from "@astik/db";
import { convertCurrency } from "./currency";

/**
 * Get the current price per gram for a metal type in USD.
 * Metal prices are stored in USD per gram.
 */
export function getMetalPriceUsd(
  metalType: MetalType,
  marketRates: NonNullable<MarketRate>
): number {
  switch (metalType) {
    case "GOLD":
      return marketRates.goldUsdPerGram;
    case "SILVER":
      return marketRates.silverUsdPerGram;
    case "PLATINUM":
      return marketRates.platinumUsdPerGram;
    case "PALLADIUM":
      return marketRates.palladiumUsdPerGram;
    default:
      return 0;
  }
}

/**
 * Get the current price per gram for a metal type in the target currency.
 * Converts from the stored USD price to the target currency.
 *
 * @param metalType - The type of metal
 * @param marketRates - Market rate data
 * @param targetCurrency - The currency to return the price in (defaults to "USD")
 * @returns Price per gram in the target currency
 */
export function getMetalPrice(
  metalType: MetalType,
  marketRates: NonNullable<MarketRate>,
  targetCurrency: CurrencyType = "USD"
): number {
  const priceUsd = getMetalPriceUsd(metalType, marketRates);
  if (targetCurrency === "USD") return priceUsd;
  return convertCurrency(priceUsd, "USD", targetCurrency, marketRates);
}
