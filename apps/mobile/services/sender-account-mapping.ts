/**
 * Sender-Account Mapping Service
 *
 * Manages the mapping between SMS sender config IDs and user accounts.
 * Uses AsyncStorage for persistence since SMS data is device-specific.
 *
 * Architecture & Design Rationale:
 * - Pattern: Repository Pattern (abstracts storage behind clean API)
 * - Why: SMS data is device-local; AsyncStorage is the right persistence
 *   layer (same pattern as useSmsSync.ts). No DB migration needed.
 * - SOLID: Single Responsibility — only manages sender↔account mappings
 *
 * @module sender-account-mapping
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AsyncStorage key for sender→account mapping */
const SENDER_ACCOUNT_MAP_KEY = "@astik/sender_account_map";

/** AsyncStorage key for the default account ID */
const DEFAULT_ACCOUNT_KEY = "@astik/default_account_id";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mapping from sender config ID to account ID.
 * Example: { "cib": "abc-123", "nbe": "def-456" }
 */
interface SenderAccountMap {
  readonly [senderConfigId: string]: string;
}

// ---------------------------------------------------------------------------
// Load / Save Mapping
// ---------------------------------------------------------------------------

/**
 * Load the sender→account mapping from AsyncStorage.
 *
 * @returns The persisted mapping, or an empty object if none exists
 */
export async function loadSenderAccountMap(): Promise<SenderAccountMap> {
  const raw = await AsyncStorage.getItem(SENDER_ACCOUNT_MAP_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as SenderAccountMap;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Persist the sender→account mapping to AsyncStorage.
 *
 * @param map - The mapping to save
 */
export async function saveSenderAccountMap(
  map: SenderAccountMap
): Promise<void> {
  await AsyncStorage.setItem(SENDER_ACCOUNT_MAP_KEY, JSON.stringify(map));
}

// ---------------------------------------------------------------------------
// Unmatched Sender Detection
// ---------------------------------------------------------------------------

/**
 * Identify sender config IDs from parsed transactions that don't match
 * any existing account in the mapping.
 *
 * @param parsedSenderIds - Unique sender config IDs from parsed SMS transactions
 * @param existingMap     - The current sender→account mapping
 * @returns Array of sender config IDs that have no mapping
 */
export function getUnmappedSenderIds(
  parsedSenderIds: readonly string[],
  existingMap: SenderAccountMap
): readonly string[] {
  const unique = [...new Set(parsedSenderIds)];
  return unique.filter((id) => !(id in existingMap));
}

// ---------------------------------------------------------------------------
// Default Account Management
// ---------------------------------------------------------------------------

/**
 * Load the default account ID from AsyncStorage.
 * The default account is used for transactions where the source account
 * cannot be determined.
 *
 * @returns The default account ID, or null if not set
 */
export async function getDefaultAccountId(): Promise<string | null> {
  return AsyncStorage.getItem(DEFAULT_ACCOUNT_KEY);
}

/**
 * Persist the default account ID to AsyncStorage.
 *
 * @param accountId - The account ID to set as default
 */
export async function setDefaultAccountId(accountId: string): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_ACCOUNT_KEY, accountId);
}

/**
 * Clear the default account ID from AsyncStorage.
 */
export async function clearDefaultAccountId(): Promise<void> {
  await AsyncStorage.removeItem(DEFAULT_ACCOUNT_KEY);
}
