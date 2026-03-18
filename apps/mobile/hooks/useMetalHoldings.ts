/**
 * useMetalHoldings Hook
 *
 * Reactive hook that observes metal holdings from WatermelonDB.
 * Follows the useAssetBreakdown pattern for WatermelonDB observation.
 *
 * Architecture & Design Rationale:
 * - Pattern: Observer pattern via WatermelonDB's observe() + React state
 * - Why: Consistent with all existing hooks (useAssetBreakdown, useMarketRates).
 *   Data updates reactively when DB changes.
 * - SOLID: Open/Closed — hook returns processed data; components don't know
 *   about DB internals.
 *
 * @module useMetalHoldings
 */

import { useEffect, useMemo, useState } from "react";
import { Q } from "@nozbe/watermelondb";

import { Asset, AssetMetal, database, type CurrencyType } from "@astik/db";
import { convertCurrency, getMetalPriceUsd } from "@astik/logic";

import { useMarketRates } from "./useMarketRates";
import { usePreferredCurrency } from "./usePreferredCurrency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A metal holding enriched with computed values for display */
interface MetalHolding {
  /** The parent Asset record */
  readonly asset: Asset;
  /** The child AssetMetal record */
  readonly assetMetal: AssetMetal;
  /** Current market value in user's preferred currency */
  readonly currentValue: number;
  /** Current market value in USD */
  readonly currentValueUsd: number;
  /** Profit/loss as a percentage ((current - purchase) / purchase * 100) */
  readonly profitLossPercent: number;
  /** Absolute profit/loss amount in preferred currency */
  readonly profitLossAmount: number;
}

/** Summary for a single metal type */
interface MetalTypeSummary {
  readonly totalValue: number;
  readonly percentage: number;
  readonly itemCount: number;
}

/** Portfolio split between metal types */
interface PortfolioSplit {
  readonly gold: MetalTypeSummary;
  readonly silver: MetalTypeSummary;
}

/** Aggregate profit/loss for the entire portfolio */
interface ProfitLoss {
  /** Absolute profit/loss amount in preferred currency */
  readonly amount: number;
  /** Profit/loss as a percentage */
  readonly percent: number;
}

interface UseMetalHoldingsResult {
  /** Gold holdings sorted by purchase date descending (newest first) */
  readonly goldHoldings: readonly MetalHolding[];
  /** Silver holdings sorted by purchase date descending (newest first) */
  readonly silverHoldings: readonly MetalHolding[];
  /** Total portfolio value in preferred currency */
  readonly totalValue: number;
  /** Total purchase price of all holdings in preferred currency */
  readonly totalPurchasePrice: number;
  /** Aggregate profit/loss for the entire portfolio */
  readonly profitLoss: ProfitLoss;
  /** Portfolio split between Gold and Silver */
  readonly portfolioSplit: PortfolioSplit;
  /** Whether the data is still loading */
  readonly isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Internal Types (raw DB data before enrichment)
// ---------------------------------------------------------------------------

interface RawHolding {
  readonly asset: Asset;
  readonly assetMetal: AssetMetal;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Joins assets with their corresponding asset_metals records.
 * Each asset is expected to have exactly one asset_metal child.
 */
function joinAssetsWithMetals(
  assets: readonly Asset[],
  assetMetals: readonly AssetMetal[]
): readonly RawHolding[] {
  const metalsByAssetId = new Map<string, AssetMetal>();

  for (const metal of assetMetals) {
    metalsByAssetId.set(metal.assetId, metal);
  }

  const holdings: RawHolding[] = [];

  for (const asset of assets) {
    const assetMetal = metalsByAssetId.get(asset.id);
    if (assetMetal) {
      holdings.push({ asset, assetMetal });
    }
  }

  return holdings;
}

/**
 * Enriches a raw holding with computed market values and profit/loss.
 */
function enrichHolding(
  raw: RawHolding,
  latestRates: NonNullable<Parameters<typeof getMetalPriceUsd>[1]>,
  preferredCurrency: CurrencyType
): MetalHolding {
  const pricePerGramUsd = getMetalPriceUsd(
    raw.assetMetal.metalType,
    latestRates
  );
  const currentValueUsd = raw.assetMetal.calculateValue(pricePerGramUsd);
  const currentValue =
    preferredCurrency === "USD"
      ? currentValueUsd
      : convertCurrency(currentValueUsd, "USD", preferredCurrency, latestRates);

  const purchasePriceInPref =
    raw.asset.currency === preferredCurrency
      ? raw.asset.purchasePrice
      : convertCurrency(
          raw.asset.purchasePrice,
          raw.asset.currency,
          preferredCurrency,
          latestRates
        );

  const profitLossAmount = currentValue - purchasePriceInPref;
  const profitLossPercent =
    purchasePriceInPref > 0
      ? (profitLossAmount / purchasePriceInPref) * 100
      : 0;

  return {
    asset: raw.asset,
    assetMetal: raw.assetMetal,
    currentValue,
    currentValueUsd,
    profitLossPercent,
    profitLossAmount,
  };
}

/**
 * Sort comparator: newest purchase date first (descending).
 * FR-024: Holdings sorted by purchase date descending.
 */
function sortByPurchaseDateDesc(a: MetalHolding, b: MetalHolding): number {
  return b.asset.purchaseDate.getTime() - a.asset.purchaseDate.getTime();
}

/**
 * Group enriched holdings by metal type and sort by purchase date desc.
 */
function groupAndSortHoldings(holdings: readonly MetalHolding[]): {
  gold: MetalHolding[];
  silver: MetalHolding[];
} {
  const gold: MetalHolding[] = [];
  const silver: MetalHolding[] = [];

  for (const holding of holdings) {
    if (holding.assetMetal.metalType === "GOLD") {
      gold.push(holding);
    } else if (holding.assetMetal.metalType === "SILVER") {
      silver.push(holding);
    }
  }

  gold.sort(sortByPurchaseDateDesc);
  silver.sort(sortByPurchaseDateDesc);

  return { gold, silver };
}

/**
 * Compute portfolio split percentages.
 */
function computePortfolioSplit(
  goldHoldings: readonly MetalHolding[],
  silverHoldings: readonly MetalHolding[],
  totalValue: number
): PortfolioSplit {
  const goldTotal = goldHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const silverTotal = silverHoldings.reduce(
    (sum, h) => sum + h.currentValue,
    0
  );

  return {
    gold: {
      totalValue: goldTotal,
      percentage: totalValue > 0 ? (goldTotal / totalValue) * 100 : 0,
      itemCount: goldHoldings.length,
    },
    silver: {
      totalValue: silverTotal,
      percentage: totalValue > 0 ? (silverTotal / totalValue) * 100 : 0,
      itemCount: silverHoldings.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Default values for empty/loading state
// ---------------------------------------------------------------------------

const EMPTY_HOLDINGS: readonly MetalHolding[] = [];

const EMPTY_SPLIT: PortfolioSplit = {
  gold: { totalValue: 0, percentage: 0, itemCount: 0 },
  silver: { totalValue: 0, percentage: 0, itemCount: 0 },
};

const ZERO_PROFIT_LOSS: ProfitLoss = { amount: 0, percent: 0 };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Reactive hook for observing and computing metal holdings data.
 *
 * Observes both `assets` (type=METAL, deleted=false) and `asset_metals`
 * (deleted=false) from WatermelonDB, joining them and computing market
 * values, profit/loss, and portfolio split.
 */
export function useMetalHoldings(): UseMetalHoldingsResult {
  const { latestRates, isLoading: ratesLoading } = useMarketRates();
  const { preferredCurrency } = usePreferredCurrency();

  const [assets, setAssets] = useState<readonly Asset[]>([]);
  const [assetMetals, setAssetMetals] = useState<readonly AssetMetal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Observe assets of type METAL
  useEffect(() => {
    const assetsCollection = database.get<Asset>("assets");
    const query = assetsCollection.query(
      Q.where("type", "METAL"),
      Q.where("deleted", false)
    );

    const subscription = query.observe().subscribe({
      next: (result) => {
        setAssets(result);
      },
      error: (err: unknown) => {
        console.error("Error observing metal assets:", err);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  // Observe asset_metals (deleted=false)
  useEffect(() => {
    const metalsCollection = database.get<AssetMetal>("asset_metals");
    const query = metalsCollection.query(Q.where("deleted", false));

    const subscription = query.observe().subscribe({
      next: (result) => {
        setAssetMetals(result);
        setDataLoading(false);
      },
      error: (err: unknown) => {
        console.error("Error observing asset metals:", err);
        setDataLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  // Compute enriched holdings when raw data or rates change
  const computedData = useMemo((): Omit<
    UseMetalHoldingsResult,
    "isLoading"
  > => {
    if (!latestRates || assets.length === 0) {
      return {
        goldHoldings: EMPTY_HOLDINGS,
        silverHoldings: EMPTY_HOLDINGS,
        totalValue: 0,
        totalPurchasePrice: 0,
        profitLoss: ZERO_PROFIT_LOSS,
        portfolioSplit: EMPTY_SPLIT,
      };
    }

    // 1. Join assets with their metals
    const rawHoldings = joinAssetsWithMetals(assets, assetMetals);

    // 2. Enrich with computed values
    const enriched = rawHoldings.map((raw) =>
      enrichHolding(raw, latestRates, preferredCurrency)
    );

    // 3. Group and sort (FR-024: newest first)
    const { gold, silver } = groupAndSortHoldings(enriched);

    // 4. Compute aggregates
    const totalValue = enriched.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPurchasePrice = enriched.reduce((sum, h) => {
      const purchaseInPref =
        h.asset.currency === preferredCurrency
          ? h.asset.purchasePrice
          : convertCurrency(
              h.asset.purchasePrice,
              h.asset.currency,
              preferredCurrency,
              latestRates
            );
      return sum + purchaseInPref;
    }, 0);

    const profitLossAmount = totalValue - totalPurchasePrice;
    const profitLossPercent =
      totalPurchasePrice > 0
        ? (profitLossAmount / totalPurchasePrice) * 100
        : 0;

    // 5. Portfolio split
    const portfolioSplit = computePortfolioSplit(gold, silver, totalValue);

    return {
      goldHoldings: gold,
      silverHoldings: silver,
      totalValue,
      totalPurchasePrice,
      profitLoss: { amount: profitLossAmount, percent: profitLossPercent },
      portfolioSplit,
    };
  }, [assets, assetMetals, latestRates, preferredCurrency]);

  return {
    ...computedData,
    isLoading: dataLoading || ratesLoading,
  };
}

export type {
  MetalHolding,
  MetalTypeSummary,
  PortfolioSplit,
  ProfitLoss,
  UseMetalHoldingsResult,
};
