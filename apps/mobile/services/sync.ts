/**
 * WatermelonDB Sync Adapter for Supabase
 * Implements push/pull synchronization between local and cloud databases
 *
 * Strategy: "Last Write Wins" - most recent updated_at timestamp wins conflicts
 */

import { synchronize } from "@nozbe/watermelondb/sync";
import type { Database } from "@nozbe/watermelondb";
import type {
  SyncPullResult,
  SyncDatabaseChangeSet,
} from "@nozbe/watermelondb/sync";
import { supabase, getCurrentUserId } from "./supabase";

// Record type that matches WatermelonDB's expected format
interface RawRecord {
  id: string;
  [key: string]: unknown;
}

// Tables that should be synced to Supabase
const SYNCABLE_TABLES = [
  "profiles",
  "accounts",
  "bank_details",
  "assets",
  "asset_metals",
  "categories",
  "user_category_settings",
  "debts",
  "recurring_payments",
  "transactions",
  "transfers",
  "budgets",
] as const;

type SyncableTable = (typeof SYNCABLE_TABLES)[number];

interface SyncPushChanges {
  [tableName: string]: {
    created: RawRecord[];
    updated: RawRecord[];
    deleted: string[];
  };
}

/**
 * Pull changes from Supabase since last sync
 */
async function pullChanges(
  lastPulledAt: number | null
): Promise<SyncPullResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("No user authenticated, skipping pull");
    return { changes: {} as SyncDatabaseChangeSet, timestamp: Date.now() };
  }

  const changes: SyncDatabaseChangeSet = {} as SyncDatabaseChangeSet;
  const lastSyncDate = lastPulledAt
    ? new Date(lastPulledAt).toISOString()
    : null;

  for (const table of SYNCABLE_TABLES) {
    try {
      // Query for records updated since last sync
      let query = supabase.from(table).select("*").eq("user_id", userId);

      if (lastSyncDate) {
        query = query.gt("updated_at", lastSyncDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error pulling ${table}:`, error);
        continue;
      }

      if (!data || data.length === 0) {
        changes[table] = { created: [], updated: [], deleted: [] };
        continue;
      }

      // Separate deleted from updated/created
      const deleted = data
        .filter((record) => record.deleted === true)
        .map((record) => record.id);

      const activeRecords = data
        .filter((record) => record.deleted !== true)
        .map((record) => transformFromSupabase(record, table));

      // For simplicity, treat all active records as "updated"
      // WatermelonDB will handle the create vs update logic
      changes[table] = {
        created: lastSyncDate ? [] : activeRecords, // First sync = all created
        updated: lastSyncDate ? activeRecords : [], // Subsequent = all updated
        deleted,
      };
    } catch (err) {
      console.error(`Exception pulling ${table}:`, err);
    }
  }

  return {
    changes,
    timestamp: Date.now(),
  };
}

/**
 * Push local changes to Supabase
 */
async function pushChanges(changes: SyncPushChanges): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("No user authenticated, skipping push");
    return;
  }

  for (const [tableName, tableChanges] of Object.entries(changes)) {
    if (!SYNCABLE_TABLES.includes(tableName as SyncableTable)) {
      continue;
    }

    try {
      // Handle created records
      if (tableChanges.created.length > 0) {
        const records = tableChanges.created.map((record) =>
          transformToSupabase(record, tableName, userId)
        );
        const { error } = await supabase.from(tableName).insert(records);
        if (error) {
          console.error(`Error inserting ${tableName}:`, error);
        }
      }

      // Handle updated records
      if (tableChanges.updated.length > 0) {
        for (const record of tableChanges.updated) {
          const transformed = transformToSupabase(record, tableName, userId);
          const { error } = await supabase
            .from(tableName)
            .upsert(transformed, { onConflict: "id" });
          if (error) {
            console.error(`Error upserting ${tableName}:`, error);
          }
        }
      }

      // Handle deleted records (soft delete)
      if (tableChanges.deleted.length > 0) {
        const { error } = await supabase
          .from(tableName)
          .update({ deleted: true, updated_at: new Date().toISOString() })
          .in("id", tableChanges.deleted);
        if (error) {
          console.error(`Error deleting ${tableName}:`, error);
        }
      }
    } catch (err) {
      console.error(`Exception pushing ${tableName}:`, err);
    }
  }
}

/**
 * Transform Supabase record to WatermelonDB format
 */
function transformFromSupabase(
  record: Record<string, unknown>,
  _tableName: string
): Record<string, unknown> {
  const transformed: Record<string, unknown> = { ...record };

  // Convert timestamps to numbers for WatermelonDB
  if (typeof record.created_at === "string") {
    transformed.created_at = new Date(record.created_at).getTime();
  }
  if (typeof record.updated_at === "string") {
    transformed.updated_at = new Date(record.updated_at).getTime();
  }
  if (typeof record.date === "string") {
    transformed.date = new Date(record.date).getTime();
  }
  if (typeof record.due_date === "string") {
    transformed.due_date = new Date(record.due_date).getTime();
  }
  if (typeof record.start_date === "string") {
    transformed.start_date = new Date(record.start_date).getTime();
  }
  if (typeof record.end_date === "string") {
    transformed.end_date = new Date(record.end_date).getTime();
  }
  if (typeof record.next_due_date === "string") {
    transformed.next_due_date = new Date(record.next_due_date).getTime();
  }
  if (typeof record.purchase_date === "string") {
    transformed.purchase_date = new Date(record.purchase_date).getTime();
  }
  if (typeof record.period_start === "string") {
    transformed.period_start = new Date(record.period_start).getTime();
  }
  if (typeof record.period_end === "string") {
    transformed.period_end = new Date(record.period_end).getTime();
  }

  return transformed;
}

/**
 * Transform WatermelonDB record to Supabase format
 */
function transformToSupabase(
  record: unknown,
  _tableName: string,
  userId: string
): Record<string, unknown> {
  const wmRecord = record as Record<string, unknown>;
  const transformed: Record<string, unknown> = { ...wmRecord };

  // Ensure user_id is set
  transformed.user_id = userId;

  // Convert number timestamps to ISO strings for Supabase
  if (typeof wmRecord.created_at === "number") {
    transformed.created_at = new Date(wmRecord.created_at).toISOString();
  }
  if (typeof wmRecord.updated_at === "number") {
    transformed.updated_at = new Date(wmRecord.updated_at).toISOString();
  }
  if (typeof wmRecord.date === "number") {
    transformed.date = new Date(wmRecord.date).toISOString().split("T")[0]; // DATE only
  }
  if (typeof wmRecord.due_date === "number") {
    transformed.due_date = new Date(wmRecord.due_date)
      .toISOString()
      .split("T")[0];
  }
  if (typeof wmRecord.start_date === "number") {
    transformed.start_date = new Date(wmRecord.start_date)
      .toISOString()
      .split("T")[0];
  }
  if (typeof wmRecord.end_date === "number") {
    transformed.end_date = new Date(wmRecord.end_date)
      .toISOString()
      .split("T")[0];
  }
  if (typeof wmRecord.next_due_date === "number") {
    transformed.next_due_date = new Date(wmRecord.next_due_date)
      .toISOString()
      .split("T")[0];
  }
  if (typeof wmRecord.purchase_date === "number") {
    transformed.purchase_date = new Date(wmRecord.purchase_date)
      .toISOString()
      .split("T")[0];
  }
  if (typeof wmRecord.period_start === "number") {
    transformed.period_start = new Date(wmRecord.period_start)
      .toISOString()
      .split("T")[0];
  }
  if (typeof wmRecord.period_end === "number") {
    transformed.period_end = new Date(wmRecord.period_end)
      .toISOString()
      .split("T")[0];
  }

  return transformed;
}

/**
 * Synchronize WatermelonDB with Supabase
 * Call this after app start and periodically
 */
export async function syncDatabase(database: Database): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("Sync skipped: No authenticated user");
    return;
  }

  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }): Promise<SyncPullResult> => {
        const result = await pullChanges(lastPulledAt ?? null);
        return result as SyncPullResult;
      },
      pushChanges: async ({ changes }) => {
        await pushChanges(changes as SyncPushChanges);
      },
      migrationsEnabledAtVersion: 2,
    });
    console.log("Sync completed successfully");
  } catch (error) {
    console.error("Sync failed:", error);
    throw error;
  }
}

/**
 * Get the last sync timestamp
 */
export async function getLastSyncTimestamp(): Promise<number | null> {
  // WatermelonDB stores this internally, but we can track it ourselves if needed
  return null;
}
