/**
 * Asset Breakdown Calculation
 * Calculate the distribution of assets across Bank, Cash, and Metals
 * All values are computed in USD (universal base currency)
 */

import type { Account, AssetMetal, MarketRate } from "@astik/db";
import { convertCurrency } from "../utils/currency";
import { getMetalPriceUsd } from "../utils/metal";

export interface AssetBreakdown {
  bank: number;
  cash: number;
  metals: number;
  wallet: number;
  total: number;
}

export interface AssetBreakdownPercentage {
  label: string;
  value: number;
  percentage: number;
}

/**
 * Compute the portfolio breakdown (bank, cash, wallet, metals) with all values in USD.
 *
 * Converts each account balance from its native currency to USD using provided market rates,
 * aggregates balances by account type, converts metal holdings to USD using per-gram USD prices,
 * and computes the total as the sum of all categories.
 *
 * @param accounts - List of accounts whose balances will be converted and aggregated by type
 * @param assetMetals - List of metal holdings; each will be valued in USD per gram
 * @param marketRates - Market rate data used for currency conversion and metal pricing; if `null`, returns zeros for all categories
 * @returns The computed AssetBreakdown containing `bank`, `cash`, `wallet`, `metals`, and `total`, all expressed in USD
 */
export function calculateAssetBreakdown(
  accounts: Account[],
  assetMetals: AssetMetal[],
  marketRates: MarketRate | null
): AssetBreakdown {
  const breakdown: AssetBreakdown = {
    bank: 0,
    cash: 0,
    metals: 0,
    wallet: 0,
    total: 0,
  };

  if (!marketRates) {
    return breakdown;
  }

  // Calculate account balances by type, converting to USD
  accounts.forEach((account) => {
    const balanceUsd = convertCurrency(
      account.balance,
      account.currency,
      "USD",
      marketRates
    );

    switch (account.type) {
      case "BANK":
        breakdown.bank += balanceUsd;
        break;
      case "DIGITAL_WALLET":
        breakdown.wallet += balanceUsd;
        break;
      case "CASH":
      default:
        breakdown.cash += balanceUsd;
        break;
    }
  });

  // Calculate metals value (already in USD per gram)
  assetMetals.forEach((metal) => {
    const pricePerGram = getMetalPriceUsd(metal.metalType, marketRates);
    breakdown.metals += metal.calculateValue(pricePerGram);
  });

  // Total = bank + cash + wallet + metals
  breakdown.total =
    breakdown.bank + breakdown.cash + breakdown.wallet + breakdown.metals;

  return breakdown;
}

/**
 * Calculate asset breakdown as percentages for display
 * Returns Bank, Cash, Metals (wallet included in total but not displayed)
 */
export function calculateAssetBreakdownPercentages(
  breakdown: AssetBreakdown
): AssetBreakdownPercentage[] {
  const { bank, cash, metals, total } = breakdown;

  if (total === 0) {
    return [
      { label: "Bank", value: 0, percentage: 0 },
      { label: "Cash", value: 0, percentage: 0 },
      { label: "Metals", value: 0, percentage: 0 },
    ];
  }

  return [
    {
      label: "Bank",
      value: bank,
      percentage: Math.round((bank / total) * 100),
    },
    {
      label: "Cash",
      value: cash,
      percentage: Math.round((cash / total) * 100),
    },
    {
      label: "Metals",
      value: metals,
      percentage: Math.round((metals / total) * 100),
    },
  ];
}