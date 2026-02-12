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
  schemaMigrations,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
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
