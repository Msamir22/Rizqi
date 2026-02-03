/**
 * Asset Breakdown Calculation
 * Calculate the distribution of assets across Bank, Cash, and Metals
 */

import type { Account, AssetMetal, MarketRate } from "@astik/db";
import { convertToEGP } from "../utils/currency";
import { getMetalPrice } from "../utils/metal";

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
 * Calculate raw asset breakdown values in EGP
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

  // Calculate account balances by type
  accounts.forEach((account) => {
    const balanceEgp = convertToEGP(
      account.balance,
      account.currency,
      marketRates
    );

    switch (account.type) {
      case "BANK":
        breakdown.bank += balanceEgp;
        break;
      case "DIGITAL_WALLET":
        breakdown.wallet += balanceEgp;
        break;
      case "CASH":
      default:
        breakdown.cash += balanceEgp;
        break;
    }
  });

  // Calculate metals value
  assetMetals.forEach((metal) => {
    const pricePerGram = getMetalPrice(metal.metalType, marketRates);
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
