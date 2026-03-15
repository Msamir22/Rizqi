/**
 * WatermelonDB Sync Adapter for Supabase
 * Implements push/pull synchronization between local and cloud databases
 *
 * Strategy: "Last Write Wins" - most recent updated_at timestamp wins conflicts
 */

import { schema, SupabaseDatabase } from "@astik/db";
import type { Database } from "@nozbe/watermelondb";
import {
  SyncDatabaseChangeSet,
  synchronize,
  SyncPullResult,
  SyncPushArgs,
  SyncPushResult,
} from "@nozbe/watermelondb/sync";
import { getCurrentUserId, supabase } from "./supabase";

// Date columns that need conversion between WatermelonDB (timestamps) and Supabase (ISO strings)
const DATE_ONLY_COLUMNS = [
  "date",
  "due_date",
  "start_date",
  "end_date",
  "next_due_date",
  "purchase_date",
  "period_start",
  "period_end",
  "snapshot_date",
] as const;

const TIMESTAMP_COLUMNS = ["created_at", "updated_at"] as const;

// Combined for transformFromSupabase (all date-like columns)
const ALL_DATE_COLUMNS = [...DATE_ONLY_COLUMNS, ...TIMESTAMP_COLUMNS] as const;

export const EXCLUDED_TABLES = ["__InternalSupabase"] as const;

/**
 * Snapshot tables are read-only (server-generated, pull-only).
 * They lack `updated_at` and `deleted` columns, so they require
 * a custom pull function and must never be pushed.
 */
const SNAPSHOT_TABLES = [
  "daily_snapshot_assets",
  "daily_snapshot_balance",
  "daily_snapshot_net_worth",
] as const;

type SnapshotTableName = (typeof SNAPSHOT_TABLES)[number];

// Child tables that don't have user_id - need to sync via parent relationship
const CHILD_TABLES_MAP: Record<
  string,
  {
    parentTable: WritableSupabaseTablesNames;
    foreignKey: string;
  }
> = {
  asset_metals: { parentTable: "assets", foreignKey: "asset_id" },
  bank_details: { parentTable: "accounts", foreignKey: "account_id" },
};

type ExcludedTableName = (typeof EXCLUDED_TABLES)[number];
type SupabaseTablesNames = Exclude<
  keyof SupabaseDatabase["public"]["Tables"],
  ExcludedTableName
>;

type ReadOnlyTableName = "market_rates" | SnapshotTableName;
type WritableSupabaseTablesNames = Exclude<
  SupabaseTablesNames,
  ReadOnlyTableName
>;

// Tables that should be synced to Supabase
const SYNCABLE_TABLES = Object.keys(schema.tables).filter(
  (table) => !EXCLUDED_TABLES.includes(table as ExcludedTableName)
) as SupabaseTablesNames[];

type SyncableTable = (typeof SYNCABLE_TABLES)[number];

/**
 * Pull market_rates (global data, last N days only)
 */
async function pullMarketRates(
  daysToKeep: number = 7
): Promise<SyncDatabaseChangeSet["market_rates"]> {
  try {
    // Calculate cutoff date (N days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from("market_rates")
      .select("*")
      .gt("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error pulling market_rates:", error);
      return { created: [], updated: [], deleted: [] };
    }

    if (!data || data.length === 0) {
      return { created: [], updated: [], deleted: [] };
    }

    // Transform records
    const activeRecords = data.map((record) => transformFromSupabase(record));

    return {
      created: [],
      updated: activeRecords,
      deleted: [],
    };
  } catch (err) {
    console.error("Exception pulling market_rates:", err);
    return { created: [], updated: [], deleted: [] };
  }
}

const SNAPSHOT_RETENTION_DAYS = 90;

/**
 * Pull a snapshot table (user-scoped, read-only, uses created_at instead of updated_at).
 * Modeled after pullMarketRates but with user_id filtering.
 * These tables lack `updated_at` and `deleted` columns.
 */
async function pullSnapshotTable(
  table: SnapshotTableName,
  userId: string,
  lastSyncDate: string | null
): Promise<SyncDatabaseChangeSet[SnapshotTableName]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - SNAPSHOT_RETENTION_DAYS);

    let query = supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .gt("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false });

    // Incremental sync: only fetch records created after last sync
    if (lastSyncDate) {
      query = query.gt("created_at", lastSyncDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error pulling ${table}:`, error);
      return { created: [], updated: [], deleted: [] };
    }

    if (!data || data.length === 0) {
      return { created: [], updated: [], deleted: [] };
    }

    // Transform records — snapshot tables have no `deleted` column
    const activeRecords = data.map((record) => transformFromSupabase(record));

    return {
      created: [],
      updated: activeRecords,
      deleted: [],
    };
  } catch (err) {
    console.error(`Exception pulling ${table}:`, err);
    return { created: [], updated: [], deleted: [] };
  }
}

/**
 * Pull user-scoped table (normal tables with user_id)
 */
async function pullUserTable(
  table: WritableSupabaseTablesNames,
  userId: string,
  lastSyncDate: string | null
): Promise<SyncDatabaseChangeSet[WritableSupabaseTablesNames]> {
  let query = supabase.from(table).select("*").eq("user_id", userId);

  if (lastSyncDate) {
    query = query.gt("updated_at", lastSyncDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error pulling ${table}:`, error);
    return { created: [], updated: [], deleted: [] };
  }

  if (!data || data.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const deleted = data
    .filter((record) => record.deleted === true)
    .map((record) => record.id);

  const activeRecords = data
    .filter((record) => record.deleted !== true)
    .map((record) => transformFromSupabase(record));

  return {
    created: [],
    updated: activeRecords,
    deleted,
  };
}

/**
 * Pull child table (no user_id, filtered via parent FK)
 */
async function pullChildTable(
  table: WritableSupabaseTablesNames,
  childConfig: {
    parentTable: WritableSupabaseTablesNames;
    foreignKey: string;
  },
  userId: string,
  lastSyncDate: string | null
): Promise<SyncDatabaseChangeSet[WritableSupabaseTablesNames]> {
  // Get parent IDs for this user
  const { data: parentIds } = await supabase
    .from(childConfig.parentTable)
    .select("id")
    .eq("user_id", userId);

  if (!parentIds || parentIds.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const ids = parentIds.map((p) => p.id);
  let query = supabase.from(table).select("*").in(childConfig.foreignKey, ids);

  if (lastSyncDate) {
    query = query.gt("updated_at", lastSyncDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error pulling ${table}:`, error);
    return { created: [], updated: [], deleted: [] };
  }

  if (!data || data.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const deleted = data
    .filter((record) => record.deleted === true)
    .map((record) => record.id);

  const activeRecords = data
    .filter((record) => record.deleted !== true)
    .map((record) => transformFromSupabase(record));

  return {
    created: [],
    updated: activeRecords,
    deleted,
  };
}

/**
 * Pull categories (user's categories + system categories)
 */
async function pullCategories(
  userId: string,
  lastSyncDate: string | null
): Promise<SyncDatabaseChangeSet["categories"]> {
  let query = supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (lastSyncDate) {
    query = query.gt("updated_at", lastSyncDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error pulling categories:", error);
    return { created: [], updated: [], deleted: [] };
  }

  if (!data || data.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const deleted = data
    .filter((record) => record.deleted === true)
    .map((record) => record.id);

  const activeRecords = data
    .filter((record) => record.deleted !== true)
    .map((record) => transformFromSupabase(record));

  return {
    created: [],
    updated: activeRecords,
    deleted,
  };
}

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
      const childConfig = CHILD_TABLES_MAP[table];
      const isSnapshotTable = SNAPSHOT_TABLES.includes(
        table as SnapshotTableName
      );

      // Route to appropriate specialized pull function
      if (table === "market_rates") {
        changes[table] = await pullMarketRates();
      } else if (isSnapshotTable) {
        changes[table] = await pullSnapshotTable(
          table as SnapshotTableName,
          userId,
          lastSyncDate
        );
      } else if (table === "categories") {
        changes[table] = await pullCategories(userId, lastSyncDate);
      } else if (childConfig) {
        changes[table] = await pullChildTable(
          table as WritableSupabaseTablesNames,
          childConfig,
          userId,
          lastSyncDate
        );
      } else {
        changes[table] = await pullUserTable(
          table as WritableSupabaseTablesNames,
          userId,
          lastSyncDate
        );
      }
    } catch (err) {
      console.error(`Exception pulling ${table}:`, err);
      changes[table] = { created: [], updated: [], deleted: [] };
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

    // Skip read-only tables (pull only, never push)
    if (
      table === "market_rates" ||
      SNAPSHOT_TABLES.includes(table as SnapshotTableName)
    ) {
      continue;
    }

    // Check if this is a child table (no user_id column)
    const isChildTable = table in CHILD_TABLES_MAP;

    try {
      // Handle created records
      if (tableChanges.created.length > 0) {
        const records = tableChanges.created.map((record) =>
          transformToSupabase(record, userId, isChildTable)
        );

        const { error } = await supabase.from(table).insert(records);
        if (error) {
          console.error(`Error inserting ${table}:`, error);
        }
      }

      // Handle updated records
      if (tableChanges.updated.length > 0) {
        for (const record of tableChanges.updated) {
          const transformed = transformToSupabase(record, userId, isChildTable);

          const { error } = await supabase
            .from(table)
            .upsert(transformed, { onConflict: "id" });
          if (error) {
            console.error(`Error upserting ${table}:`, error);
            // Log the full record on error for debugging
            console.error(
              `Full record that caused error:`,
              JSON.stringify(transformed, null, 2)
            );
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

/**
 * Transform Supabase record to WatermelonDB format
 */
function transformFromSupabase(
  record: Record<string, unknown>
): Record<string, unknown> {
  const transformed: Record<string, unknown> = { ...record };

  for (const col of ALL_DATE_COLUMNS) {
    if (typeof record[col] === "string") {
      const timestamp = new Date(record[col]).getTime();
      if (!Number.isNaN(timestamp)) {
        transformed[col] = timestamp;
      }
    }
  }

  return transformed;
}

// Type helper for Supabase insert types
type SupabaseInsert<T extends WritableSupabaseTablesNames> =
  SupabaseDatabase["public"]["Tables"][T]["Insert"];

/**
 * Transform WatermelonDB record to Supabase format
 */
function transformToSupabase<T extends WritableSupabaseTablesNames>(
  record: unknown,
  userId: string,
  isChildTable: boolean = false
): SupabaseInsert<T> {
  const wmRecord = record as Record<string, unknown>;
  const transformed: Record<string, unknown> = { ...wmRecord };

  // Remove WatermelonDB internal fields - these don't exist in Supabase schema
  // _status tracks sync state (synced, created, updated, deleted)
  // _changed tracks which columns have local changes
  delete transformed["_status"];
  delete transformed["_changed"];

  // Ensure user_id is set (only for tables with user_id column)
  if (!isChildTable) {
    transformed.user_id = userId;
  }

  for (const col of TIMESTAMP_COLUMNS) {
    if (typeof wmRecord[col] === "number") {
      transformed[col] = new Date(wmRecord[col]).toISOString();
    }
  }

  for (const col of DATE_ONLY_COLUMNS) {
    if (typeof wmRecord[col] === "number") {
      transformed[col] = new Date(wmRecord[col]).toISOString().split("T")[0];
    }
  }

  return transformed as SupabaseInsert<T>;
}

// Module-level sync lock — tracks in-flight sync to prevent concurrent synchronize() calls.
// If syncDatabase is called while one is already running, the second call silently returns.
let activeSyncPromise: Promise<void> | null = null;

/**
 * Returns the currently in-flight sync promise, if any.
 * Used by the logout service to await an active sync before resetting the database.
 */
export function getActiveSyncPromise(): Promise<void> | null {
  return activeSyncPromise;
}

/**
 * Synchronize WatermelonDB with Supabase
 * Call this after app start and periodically
 *
 * @param database - The WatermelonDB database instance
 * @param forceFullSync - If true, ignores lastPulledAt and fetches all data (use after data clear)
 */
export async function syncDatabase(
  database: Database,
  forceFullSync = false
): Promise<void> {
  // If a sync is already in-flight, skip this call
  if (activeSyncPromise) {
    console.log("Sync already in progress, skipping");
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("Sync skipped: No authenticated user");
    return;
  }

  if (forceFullSync) {
    console.log("🔄 Force full sync requested - fetching all data from server");
  }

  const doSync = async (): Promise<void> => {
    try {
      await synchronize({
        database,
        pullChanges: async ({ lastPulledAt }): Promise<SyncPullResult> => {
          // If forceFullSync is true, ignore the stored timestamp
          const effectiveLastPulledAt = forceFullSync ? null : lastPulledAt;
          const result: SyncPullResult = await pullChanges(
            effectiveLastPulledAt ?? null
          );
          return result;
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
          await pushChanges({ changes, lastPulledAt });
        },
        // Server may return records that don't exist locally (e.g., first sync or after local data cleared)
        // This flag tells WatermelonDB to create them instead of treating it as an error
        sendCreatedAsUpdated: true,
      });
      console.log("Sync completed successfully");
    } catch (error) {
      // WatermelonDB throws a diagnostic error when concurrent synchronize() calls occur.
      // This is benign — the later sync is aborted, no data corruption.
      // This can happen during Metro hot reload (e.g. pre-commit hook updates schema files).
      const errorMessage = String(error);
      if (errorMessage.includes("Concurrent synchronization")) {
        console.warn(
          "⚠️ Concurrent sync detected (benign) — later sync was aborted"
        );
        return;
      }
      console.error("Sync failed:", error);
      throw error;
    } finally {
      activeSyncPromise = null;
    }
  };

  activeSyncPromise = doSync();
  return activeSyncPromise;
}

/**
 * Reset sync state to force a full re-sync
 * This clears all local data and sync metadata
 * Use this when local data is missing but sync timestamp is ahead
 *
 * WARNING: This will delete all local data! Only use for debugging
 * or when you need to force a complete re-sync from server.
 *
 * @param db - The WatermelonDB database instance
 */
export async function resetSyncState(db: Database): Promise<void> {
  try {
    // WatermelonDB's unsafeResetDatabase clears all tables AND the sync metadata
    // This forces the next sync to be a full sync with lastPulledAt = null
    await db.write(async () => {
      await db.unsafeResetDatabase();
    });
    console.log(
      "🔄 Database reset complete. Next sync will be a full sync from server."
    );
  } catch (error) {
    console.error("Failed to reset database:", error);
    throw error;
  }
}

/**
 * Get the last sync timestamp
 */
export function getLastSyncTimestamp(): number | null {
  // WatermelonDB stores this internally, but we can track it ourselves if needed
  return null;
}
