# Session: Remove v_user_net_worth View & Local-First Calculations

**Date:** 2026-01-11 / 2026-01-12 **Time:** 17:39 - 05:24 **Duration:** ~2 hours
(spread across evening sessions)

---

## Summary

Removed the PostgreSQL `v_user_net_worth` database view and implemented
on-the-fly net worth calculations in the `@monyvi/logic` package. The mobile app
now calculates `totalAccounts`, `totalAssets`, and `totalNetWorth` locally using
WatermelonDB without any API dependency. Also fixed critical issues in the
database snapshot functions related to arbitrary row selection and hardcoded
fallback values.

---

## What Was Accomplished

### Files Created

| File                                                       | Purpose                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `packages/logic/src/assets/assets-calculations.ts`         | `calculateTotalAssets()` function for metal valuation |
| `packages/logic/src/net-worth/net-worth-calculations.ts`   | `calculateNetWorth()` and `NetWorthSummary` interface |
| `supabase/migrations/009_remove_v_user_net_worth_view.sql` | Migration to drop view and fix snapshot functions     |

### Files Modified

| File                                            | Changes                                                         |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `packages/logic/src/index.ts`                   | Added exports for assets and net-worth modules                  |
| `apps/mobile/hooks/useNetWorthSummary.ts`       | Rewritten for local-first WatermelonDB queries                  |
| `apps/api/src/index.ts`                         | Removed net-worth route registration                            |
| `supabase/functions/fetch-metal-rates/index.ts` | User added platinum/palladium support, GBP, separate timestamps |

### Files Deleted

| File                               | Reason                                  |
| ---------------------------------- | --------------------------------------- |
| `apps/api/src/routes/net-worth.ts` | Removed API endpoint (local-first only) |

### Key Decisions Made

1. **Local-First Only:** No API fallback for net worth - calculations done
   entirely on device using WatermelonDB
2. **File Structure:** `calculateTotalAssets` in
   `assets/assets-calculations.ts`, `calculateNetWorth` in
   `net-worth/net-worth-calculations.ts`
3. **Snapshot Functions Fixed:** Use `ORDER BY timestamp DESC LIMIT 1` for
   latest rates, abort early if no rates exist

---

## Business Logic Changes

### Net Worth Calculation (Local-First)

The net worth calculation is now done entirely on the mobile device:

- **Total Accounts:** Sum of all account balances converted to EGP using market
  rates
- **Total Assets:** Sum of metal valuations:
  `weight × (purity/24) × price_per_gram`
- **Total Net Worth:** `totalAccounts + totalAssets`

The `v_user_net_worth` PostgreSQL view has been removed. The API endpoint
`/api/net-worth` has been deleted.

### Database Snapshot Function Safety

All three snapshot functions now:

1. Check if `market_rates` table has data before running
2. Use `ORDER BY timestamp DESC LIMIT 1` to get the latest rate
3. Have no hardcoded fallback values - if no rates exist, snapshots are skipped

---

## Technical Details

### Calculation Interfaces

```typescript
interface AssetForCalculation {
  id: string;
  type: string;
  deleted?: boolean;
}

interface AssetMetalForCalculation {
  assetId: string;
  metalType: string;
  weightGrams: number;
  purityKarat: number;
}

interface NetWorthSummary {
  totalAccounts: number;
  totalAssets: number;
  totalNetWorth: number;
  calculatedAt: Date;
}
```

### Mobile Hook Pattern

The `useNetWorthSummary` hook uses three reactive WatermelonDB subscriptions:

- `accounts` (filtered by `deleted = false`)
- `assets` (filtered by `type = 'METAL'` and `deleted = false`)
- `asset_metals` (filtered by `deleted = false`)

It then uses `useMemo` to calculate the net worth when any data changes.

---

## Pending Items

- [ ] Apply migration: `npx supabase db push`
- [ ] Update `market_rates` table schema to add new columns (platinum,
      palladium, GBP, timestamp fields)
- [ ] Deploy updated `fetch-metal-rates` edge function
- [ ] Test mobile hook with real data

---

## Context for Next Session

The user modified the `fetch-metal-rates` edge function to add:

- `platinum_egp_per_gram` and `palladium_egp_per_gram` columns
- `gbp_egp` exchange rate
- Separate `timestamp_metal` and `timestamp_currency` fields

These changes require a migration to update the `market_rates` table schema
before the edge function can be deployed. The migration 009 already references
`r.platinum_egp_per_gram` but the column doesn't exist yet - this needs to be
addressed.
