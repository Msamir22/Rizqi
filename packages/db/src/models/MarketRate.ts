import { CurrencyType } from "../types";
import { BaseMarketRate } from "./base/base-market-rate";

export class MarketRate extends BaseMarketRate {
  /**
   * Check if market rate is stale (older than 24 hours)
   */
  isStale(): boolean {
    const dayInMs = 24 * 60 * 60 * 1000;
    return Date.now() - this.createdAt.getTime() > dayInMs;
  }

  /**
   * Get human-readable age of this market rate
   * Returns format like "2h ago", "1d ago"
   */
  getAge(): string {
    const seconds = Math.floor((Date.now() - this.createdAt.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  getRate(fromCurrency: CurrencyType, toCurrency: CurrencyType): number {
    const toCurrencySplitted = toCurrency.split("");
    const firstLetterUpperCase = toCurrencySplitted.shift()?.toUpperCase();
    if (!firstLetterUpperCase) {
      throw new Error("Invalid to currency");
    }
    const rest = toCurrencySplitted.join("");
    const key =
      `${fromCurrency.toLowerCase()}_${firstLetterUpperCase}${rest}` as keyof MarketRate;
    const rate = this[key as keyof MarketRate] as number;
    if (!rate) {
      throw new Error(`Rate not found for ${fromCurrency} to ${toCurrency}`);
    }
    return rate;
  }
}
