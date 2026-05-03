# Metals Module — First-Release Readiness Audit

**Date:** 2026-04-28 **Status:** Pre-first-release (dev) **Scope:** Metals
module — `(tabs)/metals.tsx`, `live-rates.tsx`, all `components/metals/*`, all
`components/live-rates/*`, `useMetalHoldings`, `useLiveRatesScreen`,
`useMarketRates`, `metal-holding-service`, `metal-holding-calculations`,
`packages/logic/src/utils/metal.ts`, `packages/db/src/models/Asset*.ts`,
`metal_holdings`/`asset_metals` migrations, `metals.json` (en/ar),
`fetch-metal-rates` Edge Function. **Out of scope:** voice-driven gold entry
(future backlog), dashboard widgets, snapshots beyond what
`recalculate_daily_snapshot_assets` already does. **v1 vision:** Track
holdings + view live rates + **sell/dispose** + **realized P/L**.

---

## Executive summary

The metals module is in a usable shape for the **track + view-rates** halves of
v1 — but the v1 vision also requires **sell/dispose + realized P/L**, neither of
which exists today. On top of that gap, the audit surfaced **~110 distinct
findings** across five specialist lenses. The most serious clusters are:

1. A committed `.env` file leaking the Supabase anon key and Sentry DSN — hard
   P0 across the project, not just metals.
2. A latent **sync break** on `asset_metals` — the WatermelonDB model expects
   `deleted`/`updated_at`, but the original Supabase schema (mig 002) and the
   metals refactor (mig 011) never added them. Once any incremental pull or
   soft-delete fires, sync silently fails.
3. **Currency-rate fallback returning `1`** when an FX pair is unavailable,
   which produces phantom 50× profits in the hero card.
4. **Network-bound `getCurrentUserId()` on the create path**, violating the
   offline-first constitution rule.
5. **No edit, no delete, no sell, no realized P/L** — the v1 vision gap.

**Verdict:** Not ready for v1 as-is. With the **P0 cluster** closed (8 issues)
and the **P1 cluster** addressed (≈19 issues), **plus** the sell/dispose feature
shipped per the plan in §10, the module is shippable. P2/P3 are fast-follow.

---

## Statistics

| Lens                                        | Findings |
| ------------------------------------------- | -------- |
| Logic & correctness (L-001 → L-036)         | 36       |
| Style & patterns (S-001 → S-070)            | ~70      |
| Performance (P-001 → P-025)                 | 25       |
| Security (SEC-001 → SEC-015)                | 15       |
| Product / UX gaps + ideas (PR-001 → PR-025) | 25       |
| **Total**                                   | **~171** |

**By severity (after cross-lens consolidation):**

| Severity                | Consolidated issues |
| ----------------------- | ------------------- |
| **P0 — launch-blocker** | 8                   |
| **P1 — must fix v1**    | 19                  |
| **P2 — fast-follow**    | 14                  |
| **P3 — backlog**        | 11                  |
| **v1 vision gaps**      | 4 (planner Gap A–D) |

---

## Test coverage map

### Tests present

- Unit: `packages/logic/src/utils/__tests__/metal.test.ts` — covers
  `getMetalPriceUsd`, `getMetalPrice`, `MetalPriceUnavailableError`,
  `getGoldPurityPrice`, NaN/Infinity/undefined/0/negative purity edges.
  **Solid.**

### Notable test gaps (high-value, blocking v1)

- **`metal-holding-calculations.ts`** — `enrichHolding`, `joinAssetsWithMetals`,
  `groupAndSortHoldings`, `computePortfolioSplit` are completely untested. All
  P/L math is uncovered.
- **`metal-holding-service.ts`** — `createMetalHolding` validation + atomic
  write is uncovered. No "AssetMetal create throws — does WMDB roll back?" test.
- **`useMetalHoldings`**, **`useLiveRatesScreen`**, **`useMarketRates`** — none
  tested.
- No tests for `purity-utils.ts` / `currency.ts` round-trip with stored DB
  precision.
- No E2E (Maestro) for: add holding → see in list → reopen app → still there.
- `metal.test.ts` line 78–81 asserts the buggy `default → return 0` behavior —
  once fixed (L-004), this test should be inverted.

---

## Cross-lens confirmed findings (highest confidence)

These were independently flagged by 2+ specialist agents. Treat as ground truth.

| #    | Finding                                                                                      | Lenses                      | Severity |
| ---- | -------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| X-1  | `.env` with live Supabase anon key and Sentry DSN committed to git                           | security                    | **P0**   |
| X-2  | `asset_metals` table missing `deleted` + `updated_at` columns vs. WMDB / sync layer          | logic, security             | **P0**   |
| X-3  | `<Modal>` + `bg-black/50` + Touchable `opacity-*` in `AddHoldingModal` (Android crash trap)  | logic, style, performance   | **P0**   |
| X-4  | `MarketRate.getRate()` returns `1` on missing FX pair → phantom 50× profit                   | logic                       | **P0**   |
| X-5  | `getCurrentUserId()` hits Supabase auth network on create path → blocks offline-first        | logic                       | **P0**   |
| X-6  | `onRefresh` in `useLiveRatesScreen` is a 1-second `setTimeout` — no actual sync              | logic, performance, planner | **P1**   |
| X-7  | `LiveRatesHeader` is a hand-rolled custom header (CLAUDE.md prohibits)                       | style                       | **P1**   |
| X-8  | Unregistered `amber-*` / `emerald-*` / `red-50/200/700/800/900` Tailwind colors used widely  | style                       | **P1**   |
| X-9  | Missing `React.memo` cascade — 60-s timer in `useLiveRatesScreen` re-renders entire screen   | performance                 | **P1**   |
| X-10 | Two-effect race in `useMetalHoldings` (`assets` and `asset_metals` observed independently)   | logic, performance          | **P1**   |
| X-11 | No upper bound + no Arabic-numeral / decimal-comma normalization on weight / price inputs    | logic, security             | **P1**   |
| X-12 | `console.error` logs full transformed record (PII / financials) in `sync.ts`                 | security                    | **P1**   |
| X-13 | Hardcoded English / units (`"/g"`, `"/oz"`, `"Updated"`, "Gold (N)") in user-visible strings | style                       | **P1**   |
| X-14 | Business calc inline in `metals.tsx` (`goldChangePercent` / `silverChangePercent`)           | style, performance          | **P1**   |
| X-15 | FX rate at purchase not snapshotted → realized P/L will be wrong by EGP-USD drift            | logic, planner              | **P1**   |
| X-16 | Zero unit-test coverage for `metal-holding-calculations.ts` + `metal-holding-service.ts`     | logic                       | **P1**   |
| X-17 | No sell/dispose, no realized P/L (the v1 vision gap)                                         | logic, planner              | **v1**   |

---

## P0 — Launch-blockers

### P0-1. Committed `.env` with live secrets

**Source:** SEC-001. **Symptom:** `apps/mobile/.env` contains
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (a JWT exp 2079-12-15) and
`EXPO_PUBLIC_SENTRY_DSN`. Both committed since `8e435f7`. **Fix:** (a) rotate
the Supabase anon key in the dashboard; (b) rotate the Sentry DSN; (c)
`git filter-repo --path apps/mobile/.env --invert-paths`; (d) add to
`apps/mobile/.gitignore`; (e) confirm `service_role` key was never committed.
**Note:** This is project-wide, not metals-specific, but blocks any v1 release.

### P0-2. `asset_metals` missing `deleted` + `updated_at` columns

**Sources:** L-001, L-002, L-003, SEC-014. **Symptom:** WMDB schema declares
both columns, sync layer queries them via `.gt("updated_at", lastSyncDate)` and
writes `deleted=false` on insert. Supabase `asset_metals` (mig 002 / mig 011)
has neither. First incremental pull throws "column does not exist" and the
per-table error is swallowed — sync silently breaks. Soft-delete cannot
propagate. On a fresh device after delete, holdings reappear. **Fix:** New
migration `0XX_asset_metals_sync_columns.sql`:

```sql
ALTER TABLE public.asset_metals
  ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER handle_asset_metals_updated_at
  BEFORE UPDATE ON public.asset_metals
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE INDEX idx_asset_metals_deleted ON public.asset_metals(deleted)
  WHERE deleted = false;
```

### P0-3. `MarketRate.getRate()` returns 1 silently on missing pair

**Source:** L-006. **Symptom:** A user holding gold purchased in EGP, with
preferred currency switched to a coin whose `<code>_usd` rate is null/0, will
see purchase converted at rate=1 → currentValue at ~50× → green "+5000%" P/L on
the hero card. **Fix:** Return `null`/`NaN` from `getRate` and propagate. At
call sites (`enrichHolding`, `convertCurrency`), branch to a "rate unavailable"
state and badge in `MetalsHeroCard`.

### P0-4. `getCurrentUserId()` is network-bound on the create path

**Sources:** L-017. **Symptom:** `metal-holding-service.createMetalHolding`
calls `supabase.auth.getUser()`, which performs a JWT refresh round-trip.
Airplane mode + expired in-memory session → Save fails generic toast, user loses
typed data. Constitution rule violated. **Fix:** Replace with session-cached
lookup: `(await supabase.auth.getSession()).data.session?.user.id`. Or thread
`user.id` from a top-level `useAuth` context. Audit other services for the same
pattern in a separate task (likely a regression nest).

### P0-5. Sell/dispose + realized P/L not implemented (v1 vision gap)

**Sources:** Planner Gap A/B/C, Logic Gap A/B/C. **Symptom:** No
`deleteMetalHolding`/`disposeMetalHolding` service. No tap target on
`HoldingCard`. No detail screen. No `metal_disposals` table. No FIFO/avg-cost
decision recorded. No realized P/L aggregator. The `assets.disposed_at` column
doesn't exist. Cost-basis FX rate (`purchase_fx_to_usd`) not snapshotted.
**Fix:** Full plan in §10. Two product decisions required upfront: (a) FIFO vs
weighted-avg (recommend FIFO at lot level + pro-rata within lot); (b) FX timing
(recommend snapshot at purchase + at disposal, not today's rate).

### P0-6. `AddHoldingModal` Android-crash trap

**Sources:** L-023, S-A1, S-A2, P-016, P-018, P-019. **Symptom:** Three rule
violations stacked in one component:

- `<Modal>` wrapping a `<View className="bg-black/50">` —
  `.claude/rules/android-modal-overlay-pattern.md` ban.
- `opacity-50` on a `<TouchableOpacity>` (CLAUDE.md NativeWind v4 crash list).
- `dark:bg-amber-900/30` on a `<TouchableOpacity>` chip.
- `<Modal>` is always-mounted (visible toggled, not conditionally rendered).
  **Fix:** Migrate to absolute-overlay pattern. Move `opacity` and any
  `bg-color/opacity` on Touchables to inline `style`. Conditionally render with
  `{visible && <Overlay ... />}`.

### P0-7. Crash on metals screen when `goldUsdPerGram` is null

**Sources:** L-021, L-022. **Symptom:** `getMetalPriceUsd` throws
`MetalPriceUnavailableError`. `enrichHolding` calls it inside
`useMetalHoldings.useMemo` — and `getGoldPurityPrice` inside
`useLiveRatesScreen.useMemo`. Neither is wrapped. Fresh install + rate-sync
hiccup → both screens crash. **Fix:** Wrap the per-holding enrichment in
try/catch; on error, mark `currentValue = null`, render badge "Rate unavailable"
on `HoldingCard` and skip from totals. In `useLiveRatesScreen`, guard with
`Number.isFinite(latestRates.goldUsdPerGram)` before calling.

### P0-8. `recalculate_daily_snapshot_assets` will sum disposed weight after Phase 1

**Sources:** Planner Risk #6. **Symptom:** The SECURITY DEFINER snapshot
function in mig 011 sums `asset_metals.weight_grams` regardless of disposals.
Once `metal_disposals` exists, net-worth snapshots will overcount. **Fix:**
Update the function in the same migration that introduces `metal_disposals` —
subtract `SUM(metal_disposals.disposed_weight_grams)` per asset_metal before
multiplying by price.

---

## P1 — Must fix before v1

### Calculations & data integrity

- **L-007** `convertCurrency` returns 0 (not source amount) on non-finite,
  silently producing `+0.0%` profit on a corrupted purchase price. Propagate
  unavailability or fall back to source + warning.
- **L-008** `enrichHolding` doesn't guard `pricePerGramUsd === 0` from the
  `getMetalPriceUsd` default branch; user sees `−100%` on healthy holdings.
- **L-009** `profitLossPercent` is meaningless when `totalPurchasePrice = 0`
  (gift / inheritance) — UI shows fake `+0.0%`. Render `—` for percent in that
  case.
- **L-012** Service accepts `purchasePrice = 0` — combined with positive
  currentValue → `+0.0%` lie. Reject `<= 0` unless an explicit `is_gift` flag is
  added.
- **L-014** `MetalSplitCards` percentages don't sum to 100 (no largest-remainder
  rounding).
- **SEC-006 / L-011** No upper bound on weight or price — typo of `5000` instead
  of `500` corrupts net-worth.
- **SEC-007 / L-010** `parseFloat` no Arabic-Indic digit / comma-decimal
  normalization. `"3,5"` saves as `3.0` silently. **Egyptian-market
  data-integrity bug.**

### Sync & offline

- **SEC-005** `console.error` in `sync.ts` logs full transformed record (name,
  weight, purity, purchase price, metal type) on Android logcat / Sentry. Remove
  payload from log.
- **L-019** `useMarketRates.previousDayRate` uses device local "today" —
  boundary jitter near UTC midnight causes 24h % to flip for hours. Pick UTC or
  local explicitly and document.
- **SEC-013** `pushChanges` swallows per-table upsert errors and reports overall
  sync as success. User has no signal cloud sync degraded. Surface a
  partial-failure flag.

### Style / Components

- **X-7 (S-B1)** `LiveRatesHeader` → migrate to `PageHeader`. Extend
  `PageHeader` rightAction slot to accept a `ReactNode` if needed.
- **X-8 (S-E1..E9)** Replace `amber-*`/`emerald-*` with `gold-*`/`nileGreen-*`,
  or register the missing tints in `tailwind.config.js`. Same for
  `red-50/200/700/800/900`.
- **S-D1..D5** `style={{ color: palette.x }}` should be Tailwind classes
  (`text-gold-400`, `text-nileGreen-500`).
- **S-F1..F4** Static `rgba(...)` strings in `MetalTabs` and `MetalsHeroCard` —
  extract `palette.gold.darkBg` constants or add a `withAlpha()` helper.
- **S-J1..J8 / X-13** i18n hardcoded units, accessibility labels, and
  `"Updated"`. Replace with `t(...)` keys (use named import in hooks,
  `useTranslation` in components).
- **L-035 / S-K4** Replace `console.error` in `useMetalHoldings` and
  `useMarketRates` with structured logger.

### Performance

- **P-002 / P-007 / P-008 / P-009 / X-9** Add `React.memo` to: `MetalsHeroCard`,
  `MetalSplitCards`, `LiveRatesStrip`, `MetalCard`, `GoldHeroCard`,
  `CurrencyRow`, `LiveRatesHeader`, `LiveRatesFooter`, `LiveRatesEmptyState`.
  The 60-s `lastUpdatedText` timer currently re-renders the entire screen tree.
- **P-001** Hoist inline style objects (`{ flexGrow: 1 }`,
  `{ paddingBottom: 16 }`, `{ gap: 12 }`) and memoize `refreshControl` in
  `LiveRatesScreen`.
- **P-014 / P-015** Convert `<ScrollView>` + `<FlatList scrollEnabled={false}>`
  in `LiveRatesScreen` to a single `FlatList` with
  `ListHeaderComponent`/`ListFooterComponent`. Restores virtualization for 25+
  currencies.
- **P-005 / X-14** Move `goldChangePercent` / `silverChangePercent` derivation
  out of `metals.tsx` into a hook (`useMetalChange()` or extend
  `useMarketRates`). Wrap inline `onPress` in `useCallback`. Memoize
  `rightAction`.
- **P-010 / X-10** Combine the two `useEffect` observers in `useMetalHoldings`
  into a single observation, or use two readiness flags so loading state is
  correct under all orderings.
- **P-004** `onRefresh` `setTimeout` — track in `useRef`, clear in cleanup,
  **and** wire to a real `useMarketRates.refresh()`.

### Tests (must add before merging Phase 3 service)

- Unit tests for every branch of `metal-holding-calculations.enrichHolding`
  (zero rates, zero purchase, currency mismatch, negative profit, single vs
  cross currency).
- `metal-holding-service.createMetalHolding` test with mock collection that
  throws on second create — verify rollback.
- Hook test for `useMetalHoldings` with: 0 assets, observer race ordering,
  malformed rate (NaN, Infinity).

---

## P2 — Fast-follow post-v1

- **L-004** `getMetalPriceUsd` default branch silently returns 0 — should throw
  `MetalPriceUnavailableError`. `metal.test.ts:78-81` asserts the buggy
  behavior; flip after fix.
- **L-018** `useMarketRates` re-fetches `previousDayRate` on every `latestRates`
  change. Add `lastUpdated`-keyed memo.
- **L-024** AddHoldingModal `metalType` reset effect runs on every parent render
  — gate on visible transition or use `key` reset pattern.
- **L-025** AddHoldingModal `errorMessage` not cleared when user taps Retry —
  clear before re-attempt.
- **L-028 / L-029** Sign formatting in `MetalsHeroCard` / `HoldingCard` shows
  `+0.0%` when amount is 0; render `—`.
- **L-030** `formatCurrency` for `HoldingCard` rounds to 0 decimals; show 2
  decimals for amounts < 1000.
- **L-016** `formatPurityForDisplay` returns "925" without unit — display `925‰`
  or `925 (Sterling)` to avoid karat confusion.
- **SEC-002** `market_rates` mig 001 grants SELECT to `anon`; mig 008 fixes it
  but make it idempotent / non-anon-by-default in 001 to be DB-snapshot-safe.
- **SEC-003** `fetch-metal-rates` Edge Function has
  `Access-Control-Allow-Origin: "*"` — restrict to your origin.
- **SEC-010** RLS policies on `asset_metals` use `auth.uid()` inline; rewrite as
  `(SELECT auth.uid())` for planner-friendly evaluation.
- **SEC-011** Float arithmetic for financial values — for v1 display this is
  acceptable; track for v2 migration to integer milligrams + integer cents.
- **SEC-012** No rate limiting on `fetch-metal-rates` Edge Function — restrict
  to scheduler with `verify_jwt = true` or shared-secret header.
- **SEC-015** `recalculate_daily_snapshot_assets` SECURITY DEFINER — explicitly
  `REVOKE EXECUTE FROM authenticated, anon`.
- **P-022** `EmptyMetalsState` JPG asset — verify size; downscale or convert to
  WebP if > 600×420 @3x.
- **S-N1** `EmptyMetalsState` uses JPG illustration; `LiveRatesEmptyState`
  composes Views. Pick one.

---

## P3 — Backlog

- **L-005** Document the `purity_fraction DECIMAL(5,4)` round-trip rounding (or
  store karat as smallint for gold).
- **L-013** `21/24 = 0.875` literal vs DB-stored 0.8750 — verified safe today,
  but document the round-trip invariant.
- **L-015** `MIN_BAR_WIDTH_PERCENT` floor decoupled from text — display `<1%`
  not `0%` when bar is forced to floor.
- **L-026** Hero card flicker during the asymmetric observer emission window in
  `useMetalHoldings`.
- **L-031** Replace `console.error` everywhere with structured logger
  (project-wide cleanup).
- **L-032** After fixing L-004, update `metal.test.ts` to assert it throws on
  unknown metal type.
- **L-036** `karatToFraction(0)` throws — document or add boundary handling (UI
  doesn't currently call with 0).
- **S-C1..C5** Hoist `isDark`-derived color constants in `AddHoldingModal`,
  `LiveRatesHeader`, `MetalsHeroCard`. Allowed but DRY.
- **S-K1..K8** TypeScript polish: extract `TrendBadgeProps` interface; remove
  `as` cast on FlatList; clean up `<></>` returns; track `setTimeout` IDs for
  cleanup.
- **S-N2** Drop unicode `▲`/`▼` prefix in `MetalCard.tsx:53` (already has
  MaterialIcons arrows).
- **P-023** Drive `MetalTabs` icon color via Reanimated for animated transition
  (current snap is functional but visually inconsistent).

---

## v1 Vision Gaps (sell/dispose + realized P/L)

| Gap | Scope                                                                                                                                                     | Severity |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A   | No `disposeMetalHolding` / `deleteMetalHolding` service; no UI tap target on `HoldingCard`; no detail screen `app/metals/[id].tsx`.                       | **v1**   |
| B   | Cost-basis schema incomplete: no `disposed_at`/`sale_price`/`sale_currency`. No partial-disposal model. No realized P/L aggregator.                       | **v1**   |
| C   | FX rate at purchase not snapshotted (`purchase_fx_to_usd` missing). EGP devaluation will distort realized P/L for any holding bought before EGP devalued. | **v1**   |
| D   | `is_liquid` hardcoded `false` for all metals; no toggle in `AddHoldingModal`. Coins/bullion are liquid, jewelry is not.                                   | P2       |

Implementation plan follows in §10.

---

## Open product / business decisions (must be confirmed before Phase 1)

1. **Cost-basis method** — recommend **FIFO at lot level + pro-rata within
   lot**. Egyptian gold-shop reality is "I sold 5g of my wedding ring."
   Alternative is weighted-average per `metal_type` (simpler, loses lot
   transparency).
2. **FX timing for cross-currency P/L** — recommend **snapshot at purchase AND
   at disposal**. Each `metal_disposal` carries its own `disposal_currency`;
   conversion to user's preferred currency for _display_ uses today's rate, but
   the realized P/L itself is computed in the original purchase currency.
3. **Default karat** — recommend default `21K` for gold in `AddHoldingModal`
   (Egyptian street-level standard, not 24K).
4. **Zero-cost-basis (gift/inheritance)** — needs explicit `is_gift` flag,
   otherwise `purchasePrice <= 0` should be rejected.
5. **`is_liquid` semantics for metals** — toggle in AddHoldingModal? Default by
   `item_form` (coin/bullion = liquid, jewelry = not)?
6. **Append `business-decisions.md` §16.4** capturing all of the above before
   code lands.

---

## v1 Implementation Plan (sell/dispose + realized P/L)

Phased, each phase is a standalone PR. Decisions above must be sign-off before
Phase 1.

### Phase 1 — Schema (foundation, P0)

New migration `supabase/migrations/0XX_add_metal_disposals.sql`:

```sql
-- v1 sync hygiene fix (P0-2)
ALTER TABLE public.asset_metals
  ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER handle_asset_metals_updated_at
  BEFORE UPDATE ON public.asset_metals
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- FX snapshot at purchase (P1, gap C)
ALTER TABLE public.assets
  ADD COLUMN purchase_fx_to_usd DECIMAL(20, 10);

-- Disposal ledger (v1 vision)
CREATE TABLE public.metal_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_metal_id UUID NOT NULL REFERENCES public.asset_metals(id) ON DELETE CASCADE,
  disposed_weight_grams DECIMAL(10,3) NOT NULL CHECK (disposed_weight_grams > 0),
  disposal_price DECIMAL(15,2) NOT NULL CHECK (disposal_price >= 0),
  disposal_currency CHAR(3) NOT NULL,
  disposal_fx_to_usd DECIMAL(20, 10),
  disposal_date DATE NOT NULL,
  proceeds_account_id UUID REFERENCES public.accounts(id),
  cost_basis_at_disposal DECIMAL(15,2) NOT NULL,
  realized_pnl DECIMAL(15,2) GENERATED ALWAYS AS (disposal_price - cost_basis_at_disposal) STORED,
  notes TEXT,
  linked_transaction_id UUID,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.metal_disposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own disposals" ON public.metal_disposals FOR SELECT
  TO authenticated USING (user_id = (SELECT auth.uid()));
-- ...mirror INSERT/UPDATE/DELETE policies, all with (SELECT auth.uid())...
CREATE INDEX idx_metal_disposals_user_date ON public.metal_disposals(user_id, disposal_date DESC);

-- Update snapshot to subtract disposals (P0-8)
CREATE OR REPLACE FUNCTION recalculate_daily_snapshot_assets() ...
  -- subtract SUM(metal_disposals.disposed_weight_grams) per asset_metal
```

WatermelonDB:

- Bump schema version in `packages/db/src/migrations.ts`.
- `createTable("metal_disposals", …)` with columns mirroring above.
- Add `purchase_fx_to_usd` to `assets` columns. Add `deleted`/`updated_at` to
  `asset_metals` (already there in WMDB; this aligns server-side).
- `MetalDisposal.ts` model + base. Add to syncable list in `sync.ts`.

### Phase 2 — Logic

- New `packages/logic/src/utils/metal-disposal.ts`:
  - `computeCostBasisProRata(lotWeight, lotCost, disposedWeight): number`
  - `computeRealizedPnL(disposalPrice, costBasis): number`
  - `computeRemainingWeight(lot, disposals): number`
  - `aggregateRealizedPnL(disposals, targetCurrency, rates): number` (use stored
    disposal currency)
- `packages/logic/src/utils/__tests__/metal-disposal.test.ts` — 100% branch
  coverage.
- Backfill tests for `metal-holding-calculations.ts` (X-16).

### Phase 3 — Services

- New `apps/mobile/services/metal-disposal-service.ts`:
  - `disposeMetalHolding({ assetMetalId, disposedWeightGrams, disposalPrice, disposalCurrency, disposalDate, proceedsAccountId, notes })`
  - Atomic `database.write`: validate ≤ remaining; compute cost basis; insert
    disposal row; if `proceedsAccountId`, insert linked `transactions` row of
    category `asset_sale`.
- Extend `metal-holding-service.ts`:
  - `updateMetalHolding(assetId, patch)` — name/notes only.
  - `deleteMetalHolding(assetId)` — soft delete; refuse if disposals exist
    (force sell flow).
  - Snapshot `purchase_fx_to_usd` from `latestRates` at create.
- Replace `getCurrentUserId()` with session-cached lookup (P0-4).
- Validation via Zod schemas; types via `z.infer`.

### Phase 4 — Hooks

- Extend `useMetalHoldings`:
  - Observe `metal_disposals` (third subscription, but combine into a single
    readiness gate this time).
  - Compute `remainingWeightGrams` per holding.
  - Filter active list by `remaining > 0`; expose `disposedHoldings`.
  - Add `unrealizedPnL` (rename) + `realizedPnL` aggregate.
- New `useMetalHoldingDetail(assetId)` — single-holding observation + its
  disposals.
- Combine the two observers (X-10) while doing this.

### Phase 5 — UI

- New route `apps/mobile/app/metals/[id].tsx` (detail screen): purity / weight
  remaining / current value / unrealized P/L on remaining / disposals timeline /
  Sell / Edit / Delete (delete disabled if disposals exist).
- Tap-through on `HoldingCard` → `router.push(/metals/${id})`.
- New `components/metals/SellHoldingSheet.tsx` (absolute-overlay pattern,
  **not** `<Modal>`): weight to sell + "Sell all" shortcut, proceeds, currency,
  date, optional account picker, notes; live realized-P/L preview.
- `components/metals/DisposedHoldingsSection.tsx` — collapsed accordion below
  active list.
- `MetalsHeroCard` — add "Realized P/L (lifetime)" sub-row.
- Migrate `LiveRatesHeader` to `PageHeader` (X-7).
- Wire `onRefresh` to actual `useMarketRates.refresh()` (X-6).

### Phase 6 — i18n + a11y

- New keys: `sell`, `sell_holding`, `weight_to_sell`, `sell_all`, `proceeds`,
  `proceeds_account_optional`, `realized_pnl`, `unrealized_pnl`,
  `disposal_history`, `disposed_on`, `delete_holding`, `confirm_delete`,
  `cannot_delete_has_disposals`, `edit_holding`, `weight_unit_grams`,
  `price_per_gram`, `price_per_oz`, `last_updated`. Mirror in `ar/metals.json`.
- ARIA labels for all new actions.

### Phase 7 — Tests

- Logic + service tests (Phase 2/3 already).
- Maestro E2E: add → tap card → sell partial → verify realized P/L → sell
  remainder → verify disposed section.
- Regression test: rate sync failure mid-render does not crash the screen
  (P0-7).

---

## v1.1 backlog (capture, ship later)

| Title                                        | User value                                                | Effort |
| -------------------------------------------- | --------------------------------------------------------- | ------ |
| Historical price chart per metal (7d/30d/1y) | "Should I hold or sell?" — anchored decision context      | M      |
| Price alerts (push when threshold crossed)   | Actionable nudge to act at user's target                  | M-L    |
| Edit cost basis post-creation                | Data hygiene — users mistype                              | S      |
| Bulk import from gold-shop receipt (OCR)     | Zero-friction onboarding for many-lot users               | L      |
| Pure-metal P/L vs EGP-priced P/L toggle      | Disambiguates FX gain from metal gain — Egyptian-specific | S      |
| Inheritance/dowry batch entry                | One-shot import for cultural moments                      | M      |

---

## Future backlog

| Title                                                      | User value                                                                | Effort |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| **Voice-driven gold entry** ("اشتريت ١٠ جرام دهب عيار ٢١") | Matches the app's voice-first promise; killer feature for Egyptian market | M      |
| **Zakat-on-gold calculator** (hijri year + nisab)          | Religious compliance; nothing else does this in Egypt                     | M      |
| **EGP devaluation comparison widget**                      | Validates "gold-as-savings" framing vs CIB savings rate                   | M      |
| **Hijri Eid/Ramadan gifting tracker**                      | Cultural fit; supports zakat planning                                     | M      |
| **Gift-received entry mode** (`is_gift` flag)              | Distinguishes gift from purchase, fixes 0-cost-basis edge case            | S      |
| **Wedding gold tracking (post-multi-user)**                | Family-level financial picture                                            | L      |
| **Hallmark photo / receipt attachment per holding**        | Audit trail + verification at sale                                        | S-M    |
| **Sub-tabs: jewelry vs bullion vs coin**                   | Different premiums, different liquidity in Egyptian market                | S      |
| **21K-equivalent gram display**                            | Egyptian users think in 21K, not 24K                                      | S      |
| **Purchase-anniversary reminder** ("1 year ago...")        | Engagement + decision moment                                              | S      |
| **CSV / PDF export for holdings + disposals**              | Accountant / inheritance-prep utility                                     | S      |
| **Gold-shop directory link** (out-of-app referral)         | Helps user act on a sell decision                                         | M      |
| **Family / shared holdings** (post multi-user)             | Wedding gold tracked jointly                                              | L      |

---

## Implementation order (priority-sorted)

1. **P0-1** — rotate keys + scrub `.env` from git history (project-wide).
2. **P0-2** — `asset_metals` sync columns migration. **Without this, anything
   else is moot.**
3. **P0-4** — replace `getCurrentUserId()` with session-cached lookup.
4. **P0-3** — `getRate()` returns null/NaN; propagate.
5. **P0-7** — wrap rate-throwing calls in `useMetalHoldings` and
   `useLiveRatesScreen`.
6. **P0-6** — migrate `AddHoldingModal` to absolute-overlay pattern; fix
   Touchable opacity / bg-color/opacity.
7. **P1 calculation cluster** — L-007/L-008/L-009/L-012/L-014; SEC-006/L-011
   input bounds; SEC-007/L-010 numeral normalization.
8. **P1 sync cluster** — SEC-005 redact log payload; SEC-013 propagate sync
   errors; L-019 UTC vs local for previous-day rate.
9. **Tests** for `metal-holding-calculations` + `metal-holding-service` (gates
   Phase 3).
10. **Phase 1** of v1 sell/dispose plan (schema migration + WMDB bump + snapshot
    SQL fix).
11. **Phase 2** — logic helpers + tests.
12. **Phase 3** — services + offline auth fix.
13. **Phase 4** — hooks (combined observers, realized P/L).
14. **Phase 5** — detail screen + SellHoldingSheet + PageHeader migration +
    onRefresh fix.
15. **Phase 6** — i18n + a11y.
16. **Phase 7** — Maestro E2E.
17. **P1 style/perf cluster** — `React.memo` cascade, FlatList consolidation,
    `amber-*`/`emerald-*` swap, custom-header removal, business-calc relocation.
18. **P2 fast-follow** — purity formatting, snapshot SECURITY DEFINER REVOKE,
    RLS `(SELECT auth.uid())` rewrite, anon SELECT idempotency.
19. **P3** — polish, doc updates, structured-logger swap.

---

## Key files to modify

### New files

- `supabase/migrations/0XX_add_metal_disposals.sql`
- `packages/db/src/models/MetalDisposal.ts` + auto-generated base
- `packages/logic/src/utils/metal-disposal.ts` +
  `__tests__/metal-disposal.test.ts`
- `apps/mobile/services/metal-disposal-service.ts` + `__tests__`
- `apps/mobile/services/__tests__/metal-holding-service.test.ts` (backfill)
- `apps/mobile/services/__tests__/metal-holding-calculations.test.ts` (backfill)
- `apps/mobile/hooks/useMetalHoldingDetail.ts`
- `apps/mobile/app/metals/[id].tsx`
- `apps/mobile/components/metals/SellHoldingSheet.tsx`
- `apps/mobile/components/metals/DisposedHoldingsSection.tsx`
- `docs/business/business-decisions.md` §16.4 (append)

### Modified files

- `packages/db/src/migrations.ts` (schema bump + new tables/columns)
- `packages/db/src/models/Asset.ts`, `AssetMetal.ts` (new fields/relations)
- `packages/db/src/models/MarketRate.ts` (return null/NaN, not 1)
- `packages/logic/src/utils/metal.ts` (default branch throws)
- `packages/logic/src/utils/currency.ts` (propagate unavailability)
- `packages/logic/src/utils/__tests__/metal.test.ts` (flip default-branch
  assertion)
- `apps/mobile/services/metal-holding-service.ts` (extend + offline auth fix +
  FX snapshot)
- `apps/mobile/services/metal-holding-calculations.ts` (rate-error handling, %
  rounding)
- `apps/mobile/services/sync.ts` (redact log payload, propagate per-table
  errors)
- `apps/mobile/services/supabase.ts` (session-cached `getCurrentUserId`)
- `apps/mobile/hooks/useMetalHoldings.ts` (combined observer, realized P/L,
  error wrap)
- `apps/mobile/hooks/useLiveRatesScreen.ts` (real `onRefresh`, structured
  logger, NaN guards)
- `apps/mobile/hooks/useMarketRates.ts` (UTC vs local decision, structured
  logger, refetch hardening)
- `apps/mobile/components/metals/AddHoldingModal.tsx` (overlay pattern, input
  normalization, registered colors, default 21K, split into subcomponents)
- `apps/mobile/components/metals/HoldingCard.tsx` (Pressable for tap, registered
  colors, sign formatting)
- `apps/mobile/components/metals/MetalsHeroCard.tsx` (`React.memo`, registered
  colors, realized-P/L row, `—` for zero P/L)
- `apps/mobile/components/metals/MetalSplitCards.tsx` (`React.memo`,
  largest-remainder rounding, registered colors)
- `apps/mobile/components/metals/MetalTabs.tsx` (i18n `gold (count)`, `useMemo`
  for animated tuples)
- `apps/mobile/components/metals/LiveRatesStrip.tsx` (`React.memo`, i18n units,
  registered shadow color)
- `apps/mobile/components/metals/EmptyMetalsState.tsx` (asset size verification)
- `apps/mobile/components/live-rates/LiveRatesScreen.tsx` (single FlatList,
  hoist styles, memo refresh)
- `apps/mobile/components/live-rates/LiveRatesHeader.tsx` (replace with
  `PageHeader` usage)
- `apps/mobile/components/live-rates/{MetalCard,GoldHeroCard,CurrencyRow,LiveRatesFooter,LiveRatesEmptyState,CurrencySection}.tsx`
  (`React.memo`, registered colors, i18n)
- `apps/mobile/locales/en/metals.json` + `apps/mobile/locales/ar/metals.json`
  (new keys)
- `apps/mobile/global.css` (extracted `.metals-card`, `.form-input`,
  `.form-label`, `.purity-chip`, etc.)
- `apps/mobile/.gitignore` (add `apps/mobile/.env`)
- `supabase/functions/fetch-metal-rates/index.ts` (CORS restriction + auth
  check)
- `supabase/migrations/008_*.sql` regression: rewrite RLS to
  `(SELECT auth.uid())` (or new mig)

---

## Notes for the planner / product

- The audit framing "track + view rates" is true today, but **without
  sell/dispose, users with active gold holdings will hit a dead-end** the moment
  they convert any to cash. Skipping it for v1 is possible only if you accept
  that the first user who sells gold has to manually delete the holding (and
  lose all P/L history). Strongly recommend Phase 1–5 ship together.
- The **FX snapshotting decision** is not optional for an Egyptian-market app.
  If you postpone it, every realized P/L computed against pre-devaluation EGP
  purchases will be visibly wrong, and you'll have a data-migration debt to
  backfill `purchase_fx_to_usd` later — much harder once user data exists.
- The **product backlog above** is sized for 3–4 sprints of post-v1 work. The
  single biggest user-acquisition feature on it is the **Zakat calculator** — no
  other Egyptian fintech offers it, and it directly anchors gold-as-savings to a
  religious obligation.
