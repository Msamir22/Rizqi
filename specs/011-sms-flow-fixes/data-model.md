# Data Model: 011 SMS Flow Fixes

**Branch**: `011-sms-flow-fixes`

## Changes to Existing Entities

### Transfer (table: `transfers`)

**New column**: `sms_body_hash TEXT` (nullable)

| Column          | Type | Nullable | Description                                                                                           |
| --------------- | ---- | -------- | ----------------------------------------------------------------------------------------------------- |
| `sms_body_hash` | TEXT | Yes      | SHA-256 hash of normalized SMS body. Set only for transfers created from SMS (e.g., ATM withdrawals). |

**Migration**: `supabase/migrations/030_add_sms_body_hash_to_transfers.sql`

- Adds `sms_body_hash` column to `transfers` table
- Creates partial index on `sms_body_hash WHERE sms_body_hash IS NOT NULL`
  (matches the pattern from migration 028 for transactions)

**WatermelonDB impact**:

- `base-transfer.ts` will be auto-regenerated with
  `@field("sms_body_hash") smsBodyHash?: string`
- `schema.ts` will include the new column
- `migrations.ts` needs a new version with `addColumns` for transfers

### Transaction (table: `transactions`)

**No schema changes**. The `sms_body_hash` column already exists. The only
change is to the hash computation logic (normalization before hashing).

## New Utility

### `normalizeSmsBody(body: string): string`

Location: `apps/mobile/services/sms-sync-service.ts` (or extracted to a shared
util)

**Logic**:

1. Strip zero-width Unicode characters: `\u200B`, `\u200C`, `\u200D`, `\uFEFF`
2. Normalize line endings: `\r\n` and `\r` → `\n`
3. Collapse consecutive whitespace to single space
4. Trim leading/trailing whitespace
