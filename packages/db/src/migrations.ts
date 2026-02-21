/**
 * WatermelonDB Schema Migrations
 *
 * Each migration must target the next sequential version.
 * The schema version in schema.ts is auto-resolved from the highest toVersion here.
 *
 * @see https://watermelondb.dev/docs/Advanced/Migrations
 */

import {
  addColumns,
  createTable,
  schemaMigrations,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    {
      // Migration 026 renamed all _egp → _usd columns in Supabase.
      // WatermelonDB doesn't support renameColumn, so we add the new _usd columns.
      // The old _egp columns remain in SQLite but are ignored by WatermelonDB.
      toVersion: 9,
      steps: [
        addColumns({
          table: "market_rates",
          columns: [
            { name: "aed_usd", type: "number" },
            { name: "aud_usd", type: "number" },
            { name: "bhd_usd", type: "number" },
            { name: "btc_usd", type: "number" },
            { name: "cad_usd", type: "number" },
            { name: "chf_usd", type: "number" },
            { name: "cny_usd", type: "number" },
            { name: "dkk_usd", type: "number" },
            { name: "dzd_usd", type: "number" },
            { name: "egp_usd", type: "number" },
            { name: "eur_usd", type: "number" },
            { name: "gbp_usd", type: "number" },
            { name: "gold_usd_per_gram", type: "number" },
            { name: "hkd_usd", type: "number" },
            { name: "inr_usd", type: "number" },
            { name: "iqd_usd", type: "number" },
            { name: "isk_usd", type: "number" },
            { name: "jod_usd", type: "number" },
            { name: "jpy_usd", type: "number" },
            { name: "kpw_usd", type: "number" },
            { name: "krw_usd", type: "number" },
            { name: "kwd_usd", type: "number" },
            { name: "lyd_usd", type: "number" },
            { name: "mad_usd", type: "number" },
            { name: "myr_usd", type: "number" },
            { name: "nok_usd", type: "number" },
            { name: "nzd_usd", type: "number" },
            { name: "omr_usd", type: "number" },
            { name: "palladium_usd_per_gram", type: "number" },
            { name: "platinum_usd_per_gram", type: "number" },
            { name: "qar_usd", type: "number" },
            { name: "rub_usd", type: "number" },
            { name: "sar_usd", type: "number" },
            { name: "sek_usd", type: "number" },
            { name: "sgd_usd", type: "number" },
            { name: "silver_usd_per_gram", type: "number" },
            { name: "tnd_usd", type: "number" },
            { name: "try_usd", type: "number" },
            { name: "zar_usd", type: "number" },
          ],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        createTable({
          name: "daily_snapshot_assets",
          columns: [
            { name: "created_at", type: "number" },
            { name: "snapshot_date", type: "number" },
            { name: "total_assets_usd", type: "number" },
            { name: "user_id", type: "string", isIndexed: true },
          ],
        }),
        createTable({
          name: "daily_snapshot_balance",
          columns: [
            { name: "created_at", type: "number" },
            { name: "snapshot_date", type: "number" },
            { name: "total_accounts_usd", type: "number" },
            { name: "user_id", type: "string", isIndexed: true },
          ],
        }),
        createTable({
          name: "daily_snapshot_net_worth",
          columns: [
            { name: "created_at", type: "number" },
            { name: "snapshot_date", type: "number" },
            { name: "total_accounts", type: "number" },
            { name: "total_assets", type: "number" },
            { name: "total_net_worth", type: "number" },
            { name: "user_id", type: "string", isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: "recurring_payments",
          columns: [{ name: "currency", type: "string" }],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: "transactions",
          columns: [{ name: "counterparty", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: "categories",
          columns: [{ name: "usage_count", type: "number" }],
        }),
      ],
    },
  ],
});
