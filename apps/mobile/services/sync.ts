/**
 * WatermelonDB Sync Adapter for Supabase
 * Implements push/pull synchronization between local and cloud databases
 *
 * Strategy: "Last Write Wins" - most recent updated_at timestamp wins conflicts
 */

import { schema, SupabaseDatabase } from "@astik/db";
import type { Database } from "@nozbe/watermelondb";
import type {
  SyncDatabaseChangeSet,
  SyncPullResult,
  SyncPushArgs,
  SyncPushResult,
} from "@nozbe/watermelondb/sync";
import { synchronize } from "@nozbe/watermelondb/sync";
import { getCurrentUserId, supabase } from "./supabase";

export const EXCLUDED_TABLES = [
  "__InternalSupabase",
  "daily_snapshot_assets",
  "daily_snapshot_balance",
  "daily_snapshot_net_worth",
  "daily_snapshot_market_rates",
  "market_rates",
] as const;

type ExcludedTableName = (typeof EXCLUDED_TABLES)[number];
type SupabaseTablesNames = Exclude<
  keyof SupabaseDatabase["public"]["Tables"],
  ExcludedTableName
>;

// Tables that should be synced to Supabase
const SYNCABLE_TABLES = Object.keys(schema.tables) as SupabaseTablesNames[];

type SyncableTable = (typeof SYNCABLE_TABLES)[number];

/**
 * Pull changes from Supabase since last sync
 */
async function pullChanges(
  lastPulledAt: number | null
): Promise<SyncPullResult> {
  const userId = await getCurrentUserId();
  // If no user is authenticated, return an empty changeset
  if (!userId) {
    console.log("No user authenticated, skipping pull");
    return { changes: {}, timestamp: Date.now() };
  }

  const changes: SyncDatabaseChangeSet = {};
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
        .map((record) => transformFromSupabase(record));

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
async function pushChanges(
  pushArgs: SyncPushArgs
): Promise<SyncPushResult | undefined | void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("No user authenticated, skipping push");
    return;
  }

  const { changes } = pushArgs;
  for (const [tableName, tableChanges] of Object.entries(changes)) {
    const table = tableName as SyncableTable;
    if (!SYNCABLE_TABLES.includes(tableName as SyncableTable)) {
      continue;
    }

    try {
      // Handle created records
      if (tableChanges.created.length > 0) {
        const records = tableChanges.created.map((record) =>
          transformToSupabase(record, userId)
        );
        const { error } = await supabase.from(table).insert(records);
        if (error) {
          console.error(`Error inserting ${table}:`, error);
        }
      }

      // Handle updated records
      if (tableChanges.updated.length > 0) {
        for (const record of tableChanges.updated) {
          const transformed = transformToSupabase(record, userId);
          const { error } = await supabase
            .from(table)
            .upsert(transformed, { onConflict: "id" });
          if (error) {
            console.error(`Error upserting ${table}:`, error);
          }
        }
      }

      // Handle deleted records (soft delete)
      if (tableChanges.deleted.length > 0) {
        const { error } = await supabase
          .from(table)
          .update({ deleted: true, updated_at: new Date().toISOString() })
          .in("id", tableChanges.deleted);
        if (error) {
          console.error(`Error deleting ${table}:`, error);
        }
      }
    } catch (err) {
      console.error(`Exception pushing ${table}:`, err);
    }
  }
}

// TODO: Refactor this function to be more simple

/**
 * Transform Supabase record to WatermelonDB format
 */
function transformFromSupabase(
  record: Record<string, unknown>
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

// Type helper for Supabase insert types
type SupabaseInsert<T extends SyncableTable> =
  SupabaseDatabase["public"]["Tables"][T]["Insert"];

// TODO: Refactor this function to be more simple

/**
 * Transform WatermelonDB record to Supabase format
 */
function transformToSupabase<T extends SyncableTable>(
  record: unknown,
  userId: string
): SupabaseInsert<T> {
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

  return transformed as SupabaseInsert<T>;
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
      pushChanges: async ({ changes, lastPulledAt }) => {
        await pushChanges({ changes, lastPulledAt });
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
