# Session: API and Database Enhancements

**Date:** 2026-01-06  
**Time:** ~05:00 - 07:00  
**Duration:** ~2 hours

---

## Summary

This session implemented a comprehensive API-first architecture for net worth
calculation and market rates. Key accomplishments include:

1. Created PostgreSQL VIEW for real-time net worth calculation
2. Set up daily snapshot functions with pg_cron scheduling
3. Created metals.dev edge function for market rates
4. Added Express API endpoints with JWT authentication
5. Migrated mobile app to use API layer instead of direct Supabase access

---

## What Was Accomplished

### Files Created

| File                                                   | Purpose                              |
| ------------------------------------------------------ | ------------------------------------ |
| `supabase/migrations/005_views_functions_and_cron.sql` | VIEW, functions, cron jobs           |
| `supabase/functions/fetch-metal-rates/index.ts`        | Edge function for metals.dev API     |
| `supabase/functions/fetch-metal-rates/deno.json`       | Deno configuration                   |
| `apps/api/src/middleware/auth.ts`                      | JWT validation middleware            |
| `apps/api/src/routes/net-worth.ts`                     | Net worth API endpoint               |
| `apps/mobile/services/api.ts`                          | Centralized API client with auth     |
| `apps/mobile/hooks/useNetWorthSummary.ts`              | Hook with API fetch + local fallback |

### Files Modified

| File                                  | Changes                              |
| ------------------------------------- | ------------------------------------ |
| `apps/api/src/index.ts`               | Added net-worth router               |
| `apps/mobile/services/rates.ts`       | Use API instead of direct Supabase   |
| `apps/mobile/app/(tabs)/index.tsx`    | Use useNetWorthSummary hook          |
| `apps/mobile/hooks/index.ts`          | Export new hooks                     |
| `apps/mobile/services/index.ts`       | Export API service                   |
| `docs/business/business-decisions.md` | Updated Section 10 for VIEW approach |

---

## Key Decisions Made

1. **Real-Time Calculation via VIEW:** Instead of triggers updating a cache
   table, use a PostgreSQL VIEW (`v_user_net_worth`) that calculates net worth
   on every query. Always 100% accurate, no stale data.

2. **Renamed Table:** `user_net_worth_summary` → `daily_snapshot_net_worth`
   (purpose is historical snapshots, not real-time data)

3. **Combined Cron Job:** All daily snapshot functions called by single
   `run_daily_snapshots()` function at 11 PM Cairo time.

4. **pg_cron + pg_net:** Use pg_cron to schedule, pg_net to call edge function
   for metals.dev API every 30 minutes.

5. **API-First for Read-Only Data:** All server-computed data (rates, net worth,
   snapshots) accessed via API layer, not direct Supabase from mobile.

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

### Net Worth VIEW Query

The VIEW joins accounts and assets with market_rates for currency/metal
conversion:

- Accounts in USD/EUR converted using current rates
- Gold/silver assets valued using weight × purity × price

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

- [ ] Deploy migration: `npx supabase db push`
- [ ] Deploy edge function: `npx supabase functions deploy fetch-metal-rates`
- [ ] Set up 30-min cron job (SQL in task.md)
- [ ] Test API endpoints
- [ ] Test mobile app with new hooks

---

## Context for Next Session

All code changes are complete. User needs to:

1. Push the migration to Supabase
2. Deploy the edge function
3. Set up the 30-minute cron job manually (requires project ref and service key)
4. Test the complete flow

The mobile app now fetches net worth from API with local fallback. Market rates
are fetched from API instead of direct Supabase access.
