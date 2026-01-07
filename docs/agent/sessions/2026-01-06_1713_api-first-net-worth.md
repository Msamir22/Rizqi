# Session: API-First Net Worth Architecture

**Date:** 2026-01-06  
**Time:** ~05:00 - 17:13  
**Duration:** ~12 hours (intermittent)

---

## Summary

This session implemented a comprehensive API-first architecture for net worth
calculation and market rates. The work included creating a PostgreSQL VIEW for
real-time net worth calculation, setting up daily snapshot functions with
pg_cron scheduling, creating an edge function for metals.dev API integration,
adding Express API endpoints with JWT authentication, and migrating the mobile
app to use the API layer instead of direct Supabase access.

---

## What Was Accomplished

### Files Created

| File                                                   | Purpose                                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `supabase/migrations/005_views_functions_and_cron.sql` | VIEW, functions, cron jobs for net worth & snapshots |
| `supabase/migrations/006_cleanup_market_rates.sql`     | Remove unused JSONB columns from market_rates        |
| `supabase/functions/fetch-metal-rates/index.ts`        | Edge function for metals.dev API                     |
| `supabase/functions/fetch-metal-rates/deno.json`       | Deno config for edge function                        |
| `supabase/functions/deno.json`                         | Shared Deno config for VS Code IDE support           |
| `apps/api/src/middleware/auth.ts`                      | JWT validation middleware                            |
| `apps/api/src/routes/net-worth.ts`                     | Net worth API endpoint                               |
| `apps/mobile/services/api.ts`                          | Centralized API client with JWT                      |
| `apps/mobile/hooks/useNetWorthSummary.ts`              | Hook with API fetch + local fallback                 |

### Files Modified

| File                                  | Changes                                          |
| ------------------------------------- | ------------------------------------------------ |
| `apps/api/src/index.ts`               | Added net-worth router                           |
| `apps/mobile/services/rates.ts`       | Changed to use API instead of direct Supabase    |
| `apps/mobile/app/(tabs)/index.tsx`    | Use useNetWorthSummary hook                      |
| `apps/mobile/hooks/index.ts`          | Export new hooks                                 |
| `apps/mobile/services/index.ts`       | Export API service                               |
| `docs/business/business-decisions.md` | Section 10 (VIEW), Section 15.3-15.4 (API layer) |
| `.vscode/settings.json`               | Shared deno.json import map                      |

### Key Decisions Made

1. **Real-Time Calculation via VIEW:** Use PostgreSQL VIEW (`v_user_net_worth`)
   instead of cached table for net worth. Always accurate, no stale data.

2. **Renamed Table:** `user_net_worth_summary` → `daily_snapshot_net_worth`
   (purpose is historical snapshots only).

3. **Combined Cron Job:** All daily snapshot functions called by single
   `run_daily_snapshots()` function at 11 PM Cairo time.

4. **pg_cron + pg_net:** Use pg_cron to schedule edge function calls via pg_net
   every 30 minutes.

5. **API-First for Read-Only Data:** All server-computed data (rates, net worth)
   accessed via Express API layer.

---

## Business Logic Changes

### Section 10: Net Worth Calculation

Updated from cached table approach to real-time VIEW:

- Net worth is calculated on-the-fly using `v_user_net_worth` VIEW
- VIEW joins accounts and assets with market_rates for currency/metal conversion
- Currency conversion: USD × usd_egp, EUR × eur_egp
- Metal valuation: weight_grams × (purity_karat/24) × price_per_gram

### Section 15.3-15.4: API Layer Architecture

Added new sections documenting:

- API endpoints (`/api/rates`, `/api/net-worth`)
- Data access pattern (WatermelonDB for sync, API for server data)
- Edge functions and cron schedules

---

## Technical Details

### Data Access Architecture

```
Mobile App
├── WatermelonDB (offline-first sync)
│   └── accounts, transactions, categories, budgets, etc.
└── Express API (server data)
    ├── GET /api/rates (market rates)
    └── GET /api/net-worth (calculated from VIEW)
```

### Edge Function Flow

```
pg_cron (every 30 min)
  → pg_net.http_post()
    → Supabase Edge Function
      → metals.dev API
        → UPDATE market_rates table
```

---

## Pending Items

- [ ] Complete migration 006 (drop unused columns) - had dependency issue
- [ ] Redeploy edge function after column removal
- [ ] Test complete flow end-to-end
- [ ] Test mobile app fallback when API unavailable

---

## Context for Next Session

The implementation is ~95% complete. Migration 006 needs to be pushed (it was
fixed to handle VIEW dependency). After that:

1. Push migration 006: `npx supabase db push`
2. Redeploy edge function: `npx supabase functions deploy fetch-metal-rates`
3. Test API endpoint and mobile app

The cron jobs are already configured:

- `daily-snapshots`: 11 PM Cairo time
- `fetch-metal-rates`: Every 30 minutes (user set this up manually)

All mobile code is ready and uses the API with local WatermelonDB fallback.
