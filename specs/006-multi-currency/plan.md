# Implementation Plan: Multi-Currency Architecture

**Branch**: `006-multi-currency` | **Date**: 2026-02-20 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/006-multi-currency/spec.md)  
**Research**:
[research.md](file:///e:/Work/My%20Projects/Astik/specs/006-multi-currency/research.md)  
**Data
Model**:
[data-model.md](file:///e:/Work/My%20Projects/Astik/specs/006-multi-currency/data-model.md)

## Summary

Refactor Astik from a hardcoded EGP-based currency system to a scalable,
multi-currency architecture where:

1. Exchange rates are stored relative to **USD as the universal base currency**
2. Users select their **preferred display currency** to view all aggregated
   financial data
3. Conversions between **any two currencies** work via the formula:
   `amount_B = amount_A × (rate_A / rate_B)` where `rate_X` = value of 1 unit of
   X in USD (36 currencies supported)
4. The same single API call to metals.dev fetches all data (no cost increase)
5. Default currency is **region-based** (Egypt→EGP, Europe→EUR, else→USD)
6. A **currency selector** in the dashboard and settings allows users to change
   their preferred currency

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: React Native + Expo, WatermelonDB, Supabase,
NativeWind  
**Storage**: PostgreSQL (Supabase) + SQLite (WatermelonDB offline)  
**Testing**: Jest (`npm test` in project root)  
**Target Platform**: Android & iOS (Expo managed workflow)  
**Project Type**: Monorepo (`apps/mobile`, `packages/db`, `packages/logic`,
`supabase/functions`)  
**Constraints**: Offline-first, local-first migrations, 1 API call per 30min,
metals.dev Copper plan ($1.79/mo, 2000 req/mo)

---

## Constitution Check

| Principle                       | Status | Notes                                               |
| ------------------------------- | ------ | --------------------------------------------------- |
| Offline-First Data Architecture | ✅     | All conversions use local WatermelonDB market rates |
| Documented Business Logic       | ✅     | Conversion formulas documented in `@astik/logic`    |
| Type Safety                     | ✅     | All new types/interfaces use strict TypeScript      |
| Service-Layer Separation        | ✅     | `@astik/logic` handles conversion, not UI           |
| Monorepo Package Boundaries     | ✅     | Changes scoped to `packages/db`, `packages/logic`   |
| Local-First Migrations          | ✅     | SQL migration file in `supabase/migrations/`        |

---

## Proposed Changes

Changes are organized by dependency order (foundation → consumers).

### Phase 1: Database Truncation & Schema Migration

> [!IMPORTANT] The remote database will be **fully truncated** before applying
> the migration. All current data is test data and will be discarded. This is
> the simplest and safest approach for a pre-production app.

#### [NEW] [026_multi_currency_usd_base.sql](file:///e:/Work/My%20Projects/Astik/supabase/migrations/026_multi_currency_usd_base.sql)

**Step 1 — Truncate all tables** (order matters for foreign key constraints):

- `TRUNCATE` transactions, transfers, accounts, assets, asset_metals,
  market_rates, daily_snapshot_balance, daily_snapshot_assets,
  daily_snapshot_net_worth (CASCADE)

**Step 2 — Rename `market_rates` columns**:

- All 36 currency columns: `xxx_egp` → `xxx_usd` (e.g., `usd_egp` → `egp_usd`)
- Drop `cnh_egp` column (CNH offshore yuan removed — CNY covers China)
- All 4 metal columns: `xxx_egp_per_gram` → `xxx_usd_per_gram`
- See
  [data-model.md § 2](file:///e:/Work/My%20Projects/Astik/specs/006-multi-currency/data-model.md)
  for the complete mapping

**Step 3 — Rename snapshot table columns**:

- `daily_snapshot_balance`: `total_accounts_egp` → `total_accounts_usd`
- `daily_snapshot_assets`: `total_assets_egp` → `total_assets_usd`
- `daily_snapshot_net_worth`: `total_accounts_egp` → `total_accounts_usd`,
  `total_assets_egp` → `total_assets_usd`, `net_worth_egp` → `net_worth_usd`

**Step 4 — Update snapshot SQL functions**:

- `recalculate_daily_snapshot_balance()` — reference `_usd` columns/output
- `recalculate_daily_snapshot_assets()` — reference `_usd` columns/output
- `recalculate_daily_snapshot_net_worth()` — reference `_usd` columns/output

---

### Phase 2: WatermelonDB Schema & Models (`packages/db`)

**Command**: `npm run db:migrate` (includes `db:push` internally)

This auto-generates:

#### [AUTO] [schema.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/schema.ts)

- All `_egp` column names → `_usd` column names

#### [AUTO] [base-market-rate.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/models/base/base-market-rate.ts)

- All `_egp` field decorators/properties → `_usd`

#### [AUTO] Snapshot base models

- `base-daily-snapshot-balance.ts`, `base-daily-snapshot-assets.ts`,
  `base-daily-snapshot-net-worth.ts` — field renames from `_egp` → `_usd`

#### [AUTO] [supabase-types.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/supabase-types.ts)

- All `_egp` → `_usd` in type definitions

#### [MODIFY] [MarketRate.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/models/MarketRate.ts)

Refactor `getRate()` to support **any-to-any** conversion:

```typescript
/**
 * Convert between any two supported currencies via USD base.
 *
 * Storage: each column stores "value of 1 unit of X in USD".
 * Formula: rate = rateA / rateB
 *
 * Special case: USD has an implicit rate of 1.
 */
getRate(fromCurrency: CurrencyType, toCurrency: CurrencyType): number {
  if (fromCurrency === toCurrency) return 1;
  const fromRate = this.getUsdValue(fromCurrency);
  const toRate = this.getUsdValue(toCurrency);
  return fromRate / toRate;
}

private getUsdValue(currency: CurrencyType): number {
  if (currency === 'USD') return 1;
  const key = `${currency.toLowerCase()}Usd` as keyof MarketRate;
  const rate = this[key] as number;
  if (!rate) throw new Error(`Rate not found for ${currency}`);
  return rate;
}
```

---

### Phase 3: Edge Function (`supabase/functions`)

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/fetch-metal-rates/index.ts)

- Change API URL: `currency=EGP` → `currency=USD`
- Rename `MarketRatesRow` interface: all `_egp` → `_usd` fields
- Update column mapping:
  - `egp_usd: data.currencies.EGP` (value of 1 EGP in USD ≈ 0.021)
  - `eur_usd: data.currencies.EUR` (value of 1 EUR in USD ≈ 1.18)
  - `gold_usd_per_gram: data.metals.gold` (USD per gram ≈ 160.43)
  - etc.
- Note: `data.currencies.USD` will be `1` and is **not stored** (implicit)
- Note: `data.currencies.CNH` is **not stored** (dropped — CNY covers China)

---

### Phase 4: Logic Layer (`packages/logic`)

#### [MODIFY] [currency.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/currency.ts)

**Replace** the EGP-hardcoded functions with a generic conversion:

```typescript
/**
 * Convert an amount from one currency to the user's preferred currency.
 * Uses USD as universal base: result = amount × (rateSource / rateTarget)
 */
export function convertCurrency(
  amount: number,
  sourceCurrency: CurrencyType,
  targetCurrency: CurrencyType,
  marketRates: NonNullable<MarketRate>
): number {
  return amount * marketRates.getRate(sourceCurrency, targetCurrency);
}
```

- **Remove**: `egpToCurrency()`, `currencyToEGP()`, `convertToEGP()`
- **Keep**: `formatCurrency()` (already currency-agnostic), `CURRENCY_SYMBOLS`

#### [MODIFY] [metal.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/metal.ts)

- Rename field references: `goldEgpPerGram` → `goldUsdPerGram`, etc.
- Add `targetCurrency` parameter for converting metal prices to user's preferred
  currency:

```typescript
export function getMetalPrice(
  metalType: MetalType,
  marketRates: NonNullable<MarketRate>,
  targetCurrency: CurrencyType = "USD"
): number {
  let priceInUsd: number;
  switch (metalType) {
    case "GOLD":
      priceInUsd = marketRates.goldUsdPerGram;
      break;
    case "SILVER":
      priceInUsd = marketRates.silverUsdPerGram;
      break;
    case "PLATINUM":
      priceInUsd = marketRates.platinumUsdPerGram;
      break;
    case "PALLADIUM":
      priceInUsd = marketRates.palladiumUsdPerGram;
      break;
    default:
      return 0;
  }
  if (targetCurrency === "USD") return priceInUsd;
  return priceInUsd * marketRates.getRate("USD", targetCurrency);
}
```

#### [MODIFY] [asset-breakdown.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/analytics/asset-breakdown.ts)

- Replace `convertToEGP()` with `convertCurrency()`
- Add `preferredCurrency` parameter:

```typescript
export function calculateAssetBreakdown(
  accounts: Account[],
  assetMetals: AssetMetal[],
  marketRates: MarketRate | null,
  preferredCurrency: CurrencyType = 'EGP'
): AssetBreakdown { ... }
```

#### [MODIFY] [net-worth-calculations.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/net-worth/net-worth-calculations.ts)

- Add `currency` field to `NetWorthData` interface

#### [NEW] [region.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/region.ts)

Region-based default currency detection for all 36 supported currencies:

```typescript
import { getLocales } from "expo-localization";

const REGION_TO_CURRENCY: Record<string, CurrencyType> = {
  // Direct 1:1 country → currency
  AE: "AED",
  AU: "AUD",
  BH: "BHD",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  DK: "DKK",
  DZ: "DZD",
  EG: "EGP",
  GB: "GBP",
  HK: "HKD",
  IN: "INR",
  IQ: "IQD",
  IS: "ISK",
  JO: "JOD",
  JP: "JPY",
  KP: "KPW",
  KR: "KRW",
  KW: "KWD",
  LI: "CHF",
  LY: "LYD",
  MA: "MAD",
  MY: "MYR",
  NO: "NOK",
  NZ: "NZD",
  OM: "OMR",
  QA: "QAR",
  RU: "RUB",
  SA: "SAR",
  SE: "SEK",
  SG: "SGD",
  TN: "TND",
  TR: "TRY",
  US: "USD",
  ZA: "ZAR",
  // Eurozone countries → EUR
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  EE: "EUR",
  FI: "EUR",
  FR: "EUR",
  DE: "EUR",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SK: "EUR",
  SI: "EUR",
  ES: "EUR",
  HR: "EUR",
  AD: "EUR",
  MC: "EUR",
  SM: "EUR",
  VA: "EUR",
};

export function getDefaultCurrencyForRegion(): CurrencyType {
  const regionCode = getLocales()[0]?.regionCode ?? null;
  if (!regionCode) return "USD";
  return REGION_TO_CURRENCY[regionCode] ?? "USD";
}
```

**Dependency**: Requires `npx expo install expo-localization`

---

### Phase 5: Currency Selector UI (`apps/mobile`)

#### Dashboard TopNav Currency Picker

- Add a **dropdown/picker** in the dashboard's top navigation bar
- Displays the current preferred currency with its flag/icon
- On selection: updates `profile.preferredCurrency` in WatermelonDB
- All aggregated values (total balance, net worth, total assets) reactively
  update

#### Settings Screen Currency Section

- Add a **currency selection section** in the settings/profile screen
- Shows the full list of supported currencies with search/filter
- Persists selection to `profile.preferredCurrency`
- Same reactive behavior as the dashboard picker

#### Component Updates

- All components calling `calculateAssetBreakdown()` → pass `preferredCurrency`
  from profile
- All hooks/screens displaying `totalAccounts`, `totalAssets`, `netWorth` → use
  preferred currency for formatting
- Snapshot display: read `_usd` fields, convert to preferred currency
  client-side using `convertCurrency()`

> [!NOTE] The exact components to modify will be identified after running
> `npm run db:migrate` since all `_egp` references will become TypeScript
> compile errors, giving an exhaustive list.

#### Onboarding Default Currency

- During profile creation/onboarding, call `getDefaultCurrencyForRegion()` to
  set the initial `preferred_currency` value

---

## Project Structure

### Documentation (this feature)

```text
specs/006-multi-currency/
├── spec.md              # Feature specification
├── research.md          # API research, costs, reputation, region detection
├── data-model.md        # Schema changes, conversion formulas, ER diagram
├── plan.md              # This file (implementation plan)
└── checklists/
    └── requirements.md  # Requirements checklist
```

### Source Code (affected paths)

```text
supabase/
├── migrations/
│   └── 026_multi_currency_usd_base.sql     # [NEW] Schema migration
└── functions/
    └── fetch-metal-rates/
        └── index.ts                         # [MODIFY] Change currency=USD

packages/db/src/
├── schema.ts                                # [AUTO] db:migrate regenerates
├── supabase-types.ts                        # [AUTO] gen types regenerates
├── migrations.ts                            # [AUTO] db:migrate regenerates
└── models/
    ├── base/
    │   ├── base-market-rate.ts              # [AUTO] db:migrate regenerates
    │   ├── base-daily-snapshot-balance.ts   # [AUTO] db:migrate regenerates
    │   ├── base-daily-snapshot-assets.ts    # [AUTO] db:migrate regenerates
    │   └── base-daily-snapshot-net-worth.ts # [AUTO] db:migrate regenerates
    └── MarketRate.ts                        # [MODIFY] Refactor getRate()

packages/logic/src/
├── utils/
│   ├── currency.ts                          # [MODIFY] Replace EGP functions
│   ├── metal.ts                             # [MODIFY] USD-based prices
│   └── region.ts                            # [NEW] Default currency by region
├── analytics/
│   └── asset-breakdown.ts                   # [MODIFY] Add preferredCurrency
└── net-worth/
    └── net-worth-calculations.ts            # [MODIFY] Add currency to interface

apps/mobile/
├── (dashboard components)                   # [MODIFY] Currency picker + pass preferredCurrency
├── (settings screen)                        # [MODIFY] Currency selection section
└── (onboarding)                             # [MODIFY] Set default currency by region
```

---

## Verification Plan

### Automated Tests

#### Existing test suite

**Command**: `npm test`

Current tests in `apps/mobile/__tests__/` cover transaction validation only —
**no existing tests for currency conversion**. This is a gap we'll fill.

#### New unit tests

**File**: `packages/logic/__tests__/utils/currency.test.ts` [NEW]

| Test Case                           | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| `convertCurrency` identity          | Converting USD→USD returns the same amount                    |
| `convertCurrency` USD→EGP           | `100 × (1 / 0.021) ≈ 4,750 EGP`                               |
| `convertCurrency` EGP→USD           | `4750 × (0.021 / 1) ≈ 100 USD`                                |
| `convertCurrency` EUR→JPY (cross)   | `amount × (eurUsd / jpyUsd)` matches expected                 |
| `convertCurrency` reversibility     | `A→B→A` returns original amount (within ±0.01%)               |
| `convertCurrency` with zero amount  | Returns 0 regardless of currencies                            |
| `getMetalPrice` in USD              | Returns raw `goldUsdPerGram` value                            |
| `getMetalPrice` in EGP              | Returns `goldUsdPerGram × getRate('USD', 'EGP')`              |
| `getDefaultCurrencyForRegion` EG    | Returns 'EGP' when regionCode = 'EG'                          |
| `getDefaultCurrencyForRegion` FR    | Returns 'EUR' when regionCode = 'FR'                          |
| `getDefaultCurrencyForRegion` US    | Returns 'USD' when regionCode = 'US'                          |
| `getDefaultCurrencyForRegion` null  | Returns 'USD' when regionCode is null                         |
| `calculateAssetBreakdown` with pref | Verify breakdown totals change when preferredCurrency changes |

**Command**: `npx jest packages/logic/__tests__/`

> [!NOTE] We need to verify that `packages/logic` has a Jest config or inherits
> one from the root. If not, tests will go in `apps/mobile/__tests__/` instead.

### Manual Verification

1. **Edge Function**: After deploying, invoke manually and verify JSON has
   `_usd` fields with correct USD-based values
2. **TypeScript Build**: Run `npx tsc --noEmit` — zero type errors expected
3. **App Launch**: Run on emulator → dashboard loads, market rates display,
   asset valuations show in preferred currency
4. **Currency Selector**: Change currency in settings/dashboard → all aggregated
   values update
5. **Onboarding**: Fresh install with emulator locale set to Egypt → default
   currency is EGP

---

## Complexity Tracking

No constitution violations. All changes within existing package boundaries.

| Metric                   | Value                   |
| ------------------------ | ----------------------- |
| Files to manually modify | 7                       |
| Files auto-generated     | 6                       |
| New files                | 2                       |
| New SQL migration        | 1                       |
| New test file            | 1                       |
| New dependency           | 1 (`expo-localization`) |
| Estimated implementation | 5–7h                    |
