/**
 * Metal Holding Service
 *
 * Service layer for metal holding CRUD operations.
 * Follows the transaction-service.ts pattern with atomic database writes.
 *
 * Architecture & Design Rationale:
 * - Pattern: Service-Layer Separation (Constitution IV)
 * - Why: DB write logic must not live in hooks or components.
 *   Follows the established transaction-service.ts pattern exactly.
 * - SOLID: SRP — service handles only DB operations for metal holdings.
 *
 * @module metal-holding-service
 */

import { getCurrentUserId } from "./supabase";

import {
  Asset,
  AssetMetal,
  database,
  type CurrencyType,
  type MetalType,
} from "@astik/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid item forms for metal holdings */
type ItemForm = "COIN" | "BAR" | "JEWELRY";

/**
 * Input data for creating a new metal holding.
 * All required fields are enforced; optional fields are explicitly marked.
 */
interface CreateMetalHoldingData {
  /** Display name for the holding (e.g., "Gold Ring 22K") */
  readonly name: string;
  /** Type of metal: GOLD or SILVER */
  readonly metalType: MetalType;
  /** Weight of the holding in grams */
  readonly weightGrams: number;
  /** Purity as a fraction (0.0–1.0), e.g. 0.875 for 21K gold */
  readonly purityFraction: number;
  /** Purchase price in the specified currency */
  readonly purchasePrice: number;
  /** Date of purchase */
  readonly purchaseDate: Date;
  /** Currency of the purchase price */
  readonly currency: CurrencyType;
  /** Physical form of the metal */
  readonly itemForm?: ItemForm;
  /** Optional free-text notes */
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PURITY_FRACTION = 0;
const MAX_PURITY_FRACTION = 1;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the input data for creating a metal holding.
 * Throws a descriptive error if any domain rule is violated.
 */
function validateCreateMetalHoldingData(
  data: CreateMetalHoldingData
): void {
  if (data.name.trim().length === 0) {
    throw new Error("Holding name is required");
  }
  if (data.weightGrams <= 0) {
    throw new Error("Weight must be greater than 0");
  }
  if (data.purchasePrice < 0) {
    throw new Error("Purchase price cannot be negative");
  }
  if (
    data.purityFraction <= MIN_PURITY_FRACTION ||
    data.purityFraction > MAX_PURITY_FRACTION
  ) {
    throw new Error("Purity fraction must be in the range (0, 1]");
  }
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Creates a new metal holding by atomically writing both the parent Asset
 * record and the child AssetMetal record in a single database transaction.
 *
 * @param data - The metal holding data to create
 * @returns The created Asset record
 * @throws Error if user is not authenticated, validation fails, or if the write fails
 */
async function createMetalHolding(
  data: CreateMetalHoldingData
): Promise<Asset> {
  validateCreateMetalHoldingData(data);

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const assetsCollection = database.get<Asset>("assets");
  const assetMetalsCollection = database.get<AssetMetal>("asset_metals");

  const newAsset = await database.write(async () => {
    // 1. Create the parent Asset record
    const asset = await assetsCollection.create((record) => {
      record.userId = userId;
      record.name = data.name.trim();
      record.type = "METAL";
      record.purchasePrice = data.purchasePrice;
      record.purchaseDate = data.purchaseDate;
      record.currency = data.currency;
      record.isLiquid = false;
      record.deleted = false;
      record.notes = data.notes;
    });

    // 2. Create the child AssetMetal record linked to the parent
    await assetMetalsCollection.create((record) => {
      record.assetId = asset.id;
      record.metalType = data.metalType;
      record.weightGrams = data.weightGrams;
      record.purityFraction = data.purityFraction;
      record.itemForm = data.itemForm;
      record.deleted = false;
    });

    return asset;
  });

  return newAsset;
}

export { createMetalHolding };
export type { CreateMetalHoldingData, ItemForm };
