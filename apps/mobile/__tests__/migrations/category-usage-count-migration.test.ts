import { readFileSync } from "fs";
import path from "path";

function readMigrationSql(): string {
  return readFileSync(
    path.join(
      process.cwd(),
      "..",
      "..",
      "supabase",
      "migrations",
      "049_align_remote_runtime_objects.sql"
    ),
    "utf8"
  );
}

describe("category usage count migration", () => {
  it("adds missing sync columns before enabling asset_metals updated_at trigger", () => {
    const sql = readMigrationSql();

    expect(sql).toMatch(
      /ALTER TABLE public\.asset_metals[\s\S]*ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,[\s\S]*ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now\(\);[\s\S]*CREATE TRIGGER handle_asset_metals_updated_at/m
    );
  });

  it("keeps shared system category usage counts out of user-scoped activity", () => {
    const sql = readMigrationSql();

    expect(sql).toMatch(
      /UPDATE public\.categories[\s\S]*SET usage_count = 0[\s\S]*WHERE user_id IS NULL[\s\S]*usage_count <> 0;/m
    );
    expect(sql).toMatch(
      /WHERE id = NEW\.category_id\s+AND user_id = NEW\.user_id;/m
    );
    expect(sql).toMatch(
      /WHERE id = OLD\.category_id\s+AND user_id = OLD\.user_id;/m
    );
    expect(sql).not.toMatch(/WHERE id = (NEW|OLD)\.category_id;/m);
  });
});
