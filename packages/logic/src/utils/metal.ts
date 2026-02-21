import type { CurrencyType, MarketRate, MetalType } from "@astik/db";
import { convertCurrency } from "./currency";

/**
 * Retrieve the current price per gram for a specified metal in USD.
 *
 * @param marketRates - Market rates object containing USD-per-gram prices for supported metals
 * @returns The price in USD per gram for the given metal, or `0` if the metal type is unrecognized
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
 * Retrieve the current price per gram for a metal in the specified currency.
 *
 * @param metalType - The metal to get the price for
 * @param marketRates - Market rate data containing USD-per-gram prices
 * @param targetCurrency - Currency to return the price in (defaults to "USD")
 * @returns Price per gram expressed in `targetCurrency`
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