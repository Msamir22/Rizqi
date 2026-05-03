# Session: Database Schema Overhaul

**Date:** 2026-01-12  
**Time:** ~06:00 - 08:37  
**Duration:** ~2.5 hours

---

## Summary

Implemented a comprehensive database schema overhaul for the Monyvi app. This
included creating a new `currency_type` enum with 37 currencies from the
metals.dev API, expanding the `metal_type` enum to include all metals
(PALLADIUM, COPPER, ALUMINUM, LEAD, NICKEL, ZINC), migrating currency columns
from `CHAR(3)` to the new enum, renaming `market_rates_history` to
`daily_market_rates_snapshot`, standardizing all snapshot tables to use
`created_at` TIMESTAMPTZ instead of separate `snapshot_date` fields, and
expanding both `market_rates` and `daily_market_rates_snapshot` tables with 50+
new columns for all metals and currencies.

A follow-up migration added NOT NULL constraints to all new columns and removed
the old `timestamp` field in favor of `timestamp_metal` and
`timestamp_currency`.

---

## What Was Accomplished

### Files Created

| File                                                | Purpose                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `supabase/migrations/009_schema_overhaul.sql`       | Main migration: enums, table rename, column additions, function updates |
| `supabase/migrations/010_market_rates_not_null.sql` | NOT NULL constraints, remove old timestamp, fix ORDER BY                |

### Files Modified

| File                                            | Changes                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `scripts/transform-schema.js`                   | Removed hardcoded `Currency` type, updated `EXCLUDED_TABLES` to use `daily_market_rates_snapshot` |
| `supabase/functions/fetch-metal-rates/index.ts` | Updated to insert all 50+ columns from API response, added `created_at`                           |

### Key Decisions Made

1. **Single migration file for schema overhaul:** All enum, table, and function
   changes consolidated into `009_schema_overhaul.sql` since the original
   migration hadn't been published yet.

2. **Use `created_at` with `DATE()` extraction:** Instead of keeping a separate
   `snapshot_date` field, we use `DATE(created_at)` for daily uniqueness checks.
   PostgreSQL extracts the date portion correctly from TIMESTAMPTZ.

3. **Regular indexes instead of unique expression indexes:** The `DATE()`
   function is not IMMUTABLE in PostgreSQL, so we use regular indexes and rely
   on the DELETE+INSERT pattern for idempotency.

4. **ORDER BY created_at:** Functions that fetch the latest market rates use
   `ORDER BY created_at DESC LIMIT 1` instead of `timestamp_metal` for
   consistency.

5. **DECIMAL(15, 4) precision:** All monetary and rate columns use this
   precision (15 total digits, 4 decimal places) to handle both large amounts
   and fractional values.

---

## Business Logic Changes

> No new business logic changes - this was purely a schema/infrastructure
> update.

---

## Technical Details

### New Enums

**`currency_type`** (37 currencies):

```
AED, AUD, BHD, BTC, CAD, CHF, CNH, CNY, DKK, DZD, EGP, EUR, GBP, HKD, INR, IQD,
ISK, JOD, JPY, KPW, KRW, KWD, LYD, MAD, MYR, NOK, NZD, OMR, QAR, RUB, SAR, SEK,
SGD, TND, TRY, USD, ZAR
```

**`metal_type`** (9 metals):

```
GOLD, SILVER, PLATINUM, PALLADIUM, COPPER, ALUMINUM, LEAD, NICKEL, ZINC
```

### New `market_rates` Columns

**Metals (16 columns):**

- `platinum_egp_per_gram`, `palladium_egp_per_gram`
- `lbma_gold_am_egp_per_gram`, `lbma_gold_pm_egp_per_gram`
- `lbma_silver_egp_per_gram`, `lbma_platinum_am_egp_per_gram`,
  `lbma_platinum_pm_egp_per_gram`
- `lbma_palladium_am_egp_per_gram`, `lbma_palladium_pm_egp_per_gram`
- `copper_egp_per_gram`, `aluminum_egp_per_gram`, `lead_egp_per_gram`,
  `nickel_egp_per_gram`, `zinc_egp_per_gram`

**Currencies (36 columns):**

- All 36 non-EGP currencies with `_egp` suffix (e.g., `usd_egp`, `eur_egp`,
  `gbp_egp`, `btc_egp`)

**Timestamps:**

- `timestamp_metal`, `timestamp_currency` (from metals.dev API)

### Functions Updated

1. `recalculate_daily_snapshot_balance()` - Handles all 37 currencies
2. `recalculate_daily_snapshot_assets()` - Handles all 9 metals
3. `recalculate_daily_snapshot_net_worth()` - Reads from snapshot tables
4. `save_daily_market_rates_snapshot()` - Saves all columns

---

## Pending Items

- [ ] Review and update legacy `packages/logic/src/utils/currency.ts` (has
      TypeScript errors due to old JSONB structure)
- [ ] Test edge function with real API call to populate new columns
- [ ] Verify mobile app displays market rates correctly

---

## Context for Next Session

The database schema is now fully expanded with all currencies and metals from
the metals.dev API. The `fetch-metal-rates` edge function is deployed and ready
to populate the new columns.

**Note:** The file `packages/logic/src/utils/currency.ts` has TypeScript errors
because it still references the old JSONB structure (`rates.currencies`,
`rates.metals`). The user mentioned this is a legacy file they'll review
separately.

The generated TypeScript types in `packages/db/src/types.ts` now include:

- `CurrencyType` with 37 currencies
- `MetalType` with 9 metals

All columns in `market_rates` are now NOT NULL, so the edge function must
provide values for all of them.
