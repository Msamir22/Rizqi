import { readFileSync } from "fs";
import path from "path";

import { schema } from "../../../../packages/db/src/schema";

function readMigrationSql(): string {
  return readFileSync(
    path.join(
      process.cwd(),
      "..",
      "..",
      "supabase",
      "migrations",
      "047_rename_sms_body_hash_to_sms_fingerprint.sql"
    ),
    "utf8"
  );
}

function getColumnNames(tableName: string): readonly string[] {
  return schema.tables[tableName].columnArray.map((column) => column.name);
}

describe("sms fingerprint migration", () => {
  it("removes sms_body_hash and creates scoped sms_fingerprint indexes for transactions and transfers", () => {
    const sql = readMigrationSql();

    expect(sql).toContain("DROP INDEX IF EXISTS public.idx_transactions_sms_body_hash");
    expect(sql).toContain("DROP INDEX IF EXISTS public.idx_transfers_sms_body_hash");
    expect(sql).toMatch(
      /ALTER TABLE public\.transactions[\s\S]*DROP COLUMN IF EXISTS sms_body_hash,[\s\S]*ADD COLUMN IF NOT EXISTS sms_fingerprint TEXT;/m
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.transfers[\s\S]*DROP COLUMN IF EXISTS sms_body_hash,[\s\S]*ADD COLUMN IF NOT EXISTS sms_fingerprint TEXT;/m
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_transactions_sms_fingerprint[\s\S]*ON public\.transactions \(sms_fingerprint\)[\s\S]*WHERE sms_fingerprint IS NOT NULL;/m
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_transfers_sms_fingerprint[\s\S]*ON public\.transfers \(sms_fingerprint\)[\s\S]*WHERE sms_fingerprint IS NOT NULL;/m
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_sms_fingerprint[\s\S]*ON public\.transactions \(user_id, sms_fingerprint\)[\s\S]*WHERE sms_fingerprint IS NOT NULL AND deleted = false;/m
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_unique_sms_fingerprint[\s\S]*ON public\.transfers \(user_id, sms_fingerprint\)[\s\S]*WHERE sms_fingerprint IS NOT NULL AND deleted = false;/m
    );
  });

  it("keeps the current WatermelonDB schema on sms_fingerprint only", () => {
    const transactionColumns = getColumnNames("transactions");
    const transferColumns = getColumnNames("transfers");

    expect(transactionColumns).toContain("sms_fingerprint");
    expect(transferColumns).toContain("sms_fingerprint");
    expect(transactionColumns).not.toContain("sms_body_hash");
    expect(transferColumns).not.toContain("sms_body_hash");
  });
});
