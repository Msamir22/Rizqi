import type { CurrencyType } from "../types";
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

  /**
   * Get the USD value for a given currency.
   * Each stored rate represents "value of 1 unit of currency X in USD".
   * USD itself has an implicit rate of 1.
   *
   * @param currency - The currency code to look up
   * @returns The USD value of 1 unit of the given currency, or null if unavailable
   */
  private getUsdValue(currency: CurrencyType): number | null {
    if (currency === "USD") return 1;

    const key = `${currency.toLowerCase()}Usd` as keyof MarketRate;
    const rate = this[key] as number;
    if (typeof rate !== "number" || rate === 0) {
      return null;
    }
    return rate;
  }

  /**
   * Convert between any two supported currencies via USD base.
   *
   * Formula: amount_B = amount_A × (rate_A / rate_B)
   * Where rate_X = value of 1 unit of X in USD.
   *
   * Example: Convert 100 EUR to JPY
   *   eurUsd = 1.0479 (1 EUR = $1.0479)
   *   jpyUsd = 0.0067 (1 JPY = $0.0067)
   *   result = 100 × (1.0479 / 0.0067) ≈ 15,641 JPY
   *
   * Returns 1 if rates are unavailable (e.g., empty market_rates table)
   * so the app shows unconverted amounts instead of crashing.
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns The exchange rate to multiply the source amount by
   */
  getRate(fromCurrency: CurrencyType, toCurrency: CurrencyType): number {
    if (fromCurrency === toCurrency) return 1;

    const fromUsd = this.getUsdValue(fromCurrency);
    const toUsd = this.getUsdValue(toCurrency);

    if (fromUsd === null || toUsd === null) {
      return 1;
    }

    return fromUsd / toUsd;
  }
}
