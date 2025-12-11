/**
 * Currency conversion utilities for Astik
 */

import { Currency, MarketRates, GoldKarat } from '../types';

// Gold karat purity percentages
export const KARAT_PURITY: Record<GoldKarat, number> = {
  24: 1.0, // 100% pure
  22: 0.9167, // 91.67% pure
  21: 0.875, // 87.5% pure
  18: 0.75, // 75% pure
  14: 0.5833, // 58.33% pure
  10: 0.4167, // 41.67% pure
};

// Grams per troy ounce (standard for gold pricing)
const GRAMS_PER_TROY_OUNCE = 31.1035;

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: MarketRates
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Handle gold (XAU) specially since it's priced per troy ounce
  if (fromCurrency === 'XAU') {
    // Gold to fiat currency
    const goldPriceUSD = rates.metals.gold;
    const amountUSD = amount * goldPriceUSD;

    if (toCurrency === 'USD') {
      return amountUSD;
    } else if (toCurrency === 'EGP') {
      return amountUSD * rates.currencies.EGP;
    }
  }

  if (toCurrency === 'XAU') {
    // Fiat to gold
    let amountUSD: number;
    if (fromCurrency === 'USD') {
      amountUSD = amount;
    } else if (fromCurrency === 'EGP') {
      amountUSD = amount / rates.currencies.EGP;
    } else {
      throw new Error(`Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`);
    }

    const goldPriceUSD = rates.metals.gold;
    return amountUSD / goldPriceUSD;
  }

  // EGP <-> USD conversion
  if (fromCurrency === 'EGP' && toCurrency === 'USD') {
    return amount / rates.currencies.EGP;
  }

  if (fromCurrency === 'USD' && toCurrency === 'EGP') {
    return amount * rates.currencies.EGP;
  }

  throw new Error(`Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`);
}

/**
 * Calculate gold value from weight and karat
 * @param weightGrams Weight in grams
 * @param karat Gold karat (24k, 21k, 18k, etc.)
 * @param currency Desired output currency (EGP or USD)
 * @param rates Current market rates
 * @returns Value in the specified currency
 */
export function calculateGoldValue(
  weightGrams: number,
  karat: GoldKarat,
  currency: 'EGP' | 'USD',
  rates: MarketRates
): number {
  // Get gold price per troy ounce in USD
  const goldPricePerTroyOunce = rates.metals.gold;

  // Convert grams to troy ounces
  const weightTroyOunces = weightGrams / GRAMS_PER_TROY_OUNCE;

  // Apply karat purity
  const purity = KARAT_PURITY[karat];
  const pureGoldTroyOunces = weightTroyOunces * purity;

  // Calculate value in USD
  const valueUSD = pureGoldTroyOunces * goldPricePerTroyOunce;

  // Convert to requested currency
  if (currency === 'USD') {
    return valueUSD;
  } else {
    return valueUSD * rates.currencies.EGP;
  }
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'XAU') {
    return `${amount.toFixed(4)} oz`;
  }

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currency === 'EGP') {
    return `${formatted} EGP`;
  } else if (currency === 'USD') {
    return `$${formatted}`;
  }

  return `${formatted} ${currency}`;
}

/**
 * Example usage:
 * calculateGoldValue(10, 21, 'EGP', rates)
 *   → 13,250.00 (10 grams of 21k gold in EGP)
 */
