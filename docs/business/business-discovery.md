# Monyvi Business Discovery Archive

**Status:** Archived  
**Last updated:** 2026-05-10  
**Purpose:** Historical discovery index. Current product decisions live in
[business-decisions.md](./business-decisions.md).

## Summary

This file is retained as an archive of the original discovery scope. The app has
since moved beyond the early schema-planning phase. Do not use this document as
the implementation source of truth.

Use these current documents instead:

- [Business decisions](./business-decisions.md)
- [Technical architecture](../architecture/technical-architecture.md)
- [Design system](../design/design-system.md)

## Current Implemented Local Tables

WatermelonDB schema version 17 currently includes:

- `profiles`
- `accounts`
- `bank_details`
- `assets`
- `asset_metals`
- `categories`
- `user_category_settings`
- `transactions`
- `transfers`
- `debts`
- `recurring_payments`
- `budgets`
- `market_rates`
- `daily_snapshot_balance`
- `daily_snapshot_assets`
- `daily_snapshot_net_worth`

## Historical Note

Older references to `user_net_worth_summary`, `market_rates_history`, and an
API-first net-worth view are stale for the current mobile app. Net worth is now
computed locally from WatermelonDB data and synced market rates.
