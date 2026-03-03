/**
 * Pending Account Service
 *
 * Manages in-memory accounts created during the SMS review session.
 * These accounts are NOT persisted to WatermelonDB until the user
 * taps "Save All" on the review page.
 *
 * Architecture & Design Rationale:
 * - Pattern: Unit of Work — accumulates pending changes in memory,
 *   then commits them atomically in a single WatermelonDB batch write.
 * - Why: Avoids premature persistence of accounts the user might
 *   discard. Only referenced accounts are persisted on final save.
 * - SOLID: SRP — only handles pending account lifecycle.
 *   ISP — consumers only need `PendingAccount` (read) or
 *   `persistPendingAccounts` (write), not both.
 *
 * @module pending-account-service
 */

import {
  database,
  type Account,
  type BankDetails,
  type CurrencyType,
} from "@astik/db";
import { Q } from "@nozbe/watermelondb";
import { getCurrentUserId } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * In-memory account created during the review session.
 * Not persisted until final save — see `persistPendingAccounts`.
 */
interface PendingAccount {
  /** Temporary UUID generated client-side */
  readonly tempId: string;
  /** User-entered account name */
  readonly name: string;
  /** Currency inherited from the transaction */
  readonly currency: CurrencyType;
  /** Always BANK for SMS-created accounts */
  readonly type: "BANK";
  /** SMS sender display name (for bank_details.sms_sender_name) */
  readonly senderDisplayName: string;
  /** Card last 4 digits from SMS body (for bank_details.card_last_4) */
  readonly cardLast4?: string;
}

/**
 * Result of persisting pending accounts to WatermelonDB.
 */
interface PersistResult {
  /** Maps PendingAccount.tempId → real WatermelonDB Account.id */
  readonly tempToRealIdMap: ReadonlyMap<string, string>;
  /** Number of Account records created */
  readonly createdCount: number;
  /** Errors encountered during creation */
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist pending accounts to WatermelonDB in a single atomic batch.
 *
 * Uses `prepareCreate` + `database.batch` to ensure true atomicity —
 * if any record fails to prepare, no records are committed.
 * All transactions on the review page must be valid before save,
 * so partial success is NOT acceptable.
 *
 * For each `PendingAccount`:
 * 1. Prepares an `Account` record (type=BANK, with user's currency)
 * 2. Prepares a `BankDetails` record (sms_sender_name + card_last_4)
 *
 * Only accounts referenced by at least one transaction should be
 * passed here — the caller filters unreferenced accounts first.
 *
 * @param pendingAccounts - Filtered list of referenced pending accounts
 * @returns Map of tempId → realId, plus count and error details
 */
async function persistPendingAccounts(
  pendingAccounts: readonly PendingAccount[]
): Promise<PersistResult> {
  if (pendingAccounts.length === 0) {
    return {
      tempToRealIdMap: new Map(),
      createdCount: 0,
      errors: [],
    };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      tempToRealIdMap: new Map(),
      createdCount: 0,
      errors: ["No authenticated user — cannot persist accounts"],
    };
  }

  const tempToRealIdMap = new Map<string, string>();
  const errors: string[] = [];
  let createdCount = 0;

  try {
    // Pre-fetch existing active BANK accounts for dedup (name+currency)
    const existingAccounts = await database
      .get<Account>("accounts")
      .query(
        Q.where("user_id", userId),
        Q.where("deleted", false),
        Q.where("type", "BANK")
      )
      .fetch();

    // Track accounts mapped within this batch to avoid intra-batch duplicates
    const createdInBatch = new Map<string, string>(); // "name|currency" → realId

    // Collect all DB operations to commit atomically
    const ops: Array<Account | BankDetails> = [];

    // Deferred mappings — only applied after successful batch commit
    const pendingMappings: Array<{
      readonly tempId: string;
      readonly dedupKey: string;
      readonly realId: string;
    }> = [];

    for (const pending of pendingAccounts) {
      const dedupKey = `${pending.name.trim().toLowerCase()}|${pending.currency}`;

      // Check: already mapped earlier in this batch?
      const batchDuplicate = createdInBatch.get(dedupKey);
      if (batchDuplicate) {
        // Safe to set immediately — references an already-committed or dedup'd ID
        tempToRealIdMap.set(pending.tempId, batchDuplicate);
        continue;
      }

      // Check: already exists in DB?
      const existingMatch = existingAccounts.find(
        (acc) =>
          // TODO: Move trim().toLowerCase() to a util function
          acc.name.trim().toLowerCase() === pending.name.trim().toLowerCase() &&
          acc.currency === pending.currency
      );

      if (existingMatch) {
        // Safe to set immediately — references a DB-existing record
        tempToRealIdMap.set(pending.tempId, existingMatch.id);
        createdInBatch.set(dedupKey, existingMatch.id);
        continue;
      }

      // Prepare Account record (id assigned synchronously by prepareCreate)
      const account = database
        .get<Account>("accounts")
        .prepareCreate((record) => {
          record.userId = userId;
          record.name = pending.name;
          record.currency = pending.currency;
          record.type = pending.type;
          record.balance = 0;
          record.isDefault = false;
          record.deleted = false;
        });
      ops.push(account);

      // Prepare BankDetails record
      const bankDetails = database
        .get<BankDetails>("bank_details")
        .prepareCreate((record) => {
          record.accountId = account.id;
          record.smsSenderName = pending.senderDisplayName;
          record.cardLast4 = pending.cardLast4;
          record.deleted = false;
        });
      ops.push(bankDetails);

      // Defer: collect mapping info for post-commit application
      pendingMappings.push({
        tempId: pending.tempId,
        dedupKey,
        realId: account.id,
      });

      // Track in createdInBatch so subsequent loop iterations can dedup
      createdInBatch.set(dedupKey, account.id);
    }

    // Commit all prepared records atomically
    if (ops.length > 0) {
      await database.write(async () => {
        await database.batch(ops);
      });
    }

    // Apply mappings only after successful commit
    for (const mapping of pendingMappings) {
      tempToRealIdMap.set(mapping.tempId, mapping.realId);
      createdCount++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Batch write failed: ${message}`);
  }

  return { tempToRealIdMap, createdCount, errors };
}

export { persistPendingAccounts };
export type { PendingAccount, PersistResult };
