# Research: Multi-Currency Architecture

**Branch**: `006-multi-currency` | **Date**: 2026-02-19  
**Spec**: [spec.md](file:///e:/Work/My%20Projects/Astik/specs/006-multi-currency/spec.md)

---

## 1. metals.dev API Behavior

### Dynamic Currency Parameter

The metals.dev API endpoint
`https://api.metals.dev/v1/latest?api_key=KEY&currency=XXX&unit=g` supports a
dynamic `currency` parameter. Changing from `currency=EGP` to `currency=USD`
does **not** increase API call count — it's the same single request.

**Actual API response** (with `currency=USD`, fetched 2026-02-20):

```json
{
  "status": "success",
  "currency": "USD",
  "unit": "g",
  "metals": {
    "gold": 160.426,
    "silver": 2.5117,
    "platinum": 66.5207,
    "palladium": 54.2401,
    "lbma_gold_am": 160.466,
    "lbma_gold_pm": 160.9081,
    "...": "additional LBMA/MCX/IBJA benchmarks omitted"
  },
  "currencies": {
    "EGP": 0.0210523309,
    "EUR": 1.1767955605,
    "GBP": 1.3458170334,
    "AED": 0.2722940776,
    "BTC": 67304.2623789365,
    "USD": 1,
    "...": "170+ currencies total"
  },
  "timestamps": {
    "metal": "2026-02-20T00:38:03.716Z",
    "currency": "2026-02-20T00:37:14.906Z"
  }
}
```

> [!IMPORTANT] **Semantic clarification**: The `currencies` values represent
> **how much of 1 unit of that currency is worth in USD**, NOT "how many units
> per 1 USD".
>
> - `currencies.EGP = 0.0210523309` → 1 EGP = **$0.021 USD** (i.e. 1 EGP is
>   worth ~2 cents)
> - `currencies.EUR = 1.1767955605` → 1 EUR = **$1.18 USD**
> - `currencies.GBP = 1.3458170334` → 1 GBP = **$1.35 USD**
> - `currencies.BTC = 67304.26` → 1 BTC = **$67,304 USD**
> - `currencies.USD = 1` → 1 USD = **$1 USD** (identity)
>
> To get "how many EGP per 1 USD": `1 / 0.0210523309 = 47.50 EGP`

**Semantics when `currency=USD`**:

- `metals.gold = 160.426` → gold costs **$160.43 USD per gram**
- `metals.silver = 2.5117` → silver costs **$2.51 USD per gram**
- `currencies.EGP = 0.0210523309` → 1 EGP = **0.021 USD** (or 1 USD ≈ 47.5 EGP)
- `currencies.EUR = 1.1767955605` → 1 EUR = **1.18 USD** (EUR is worth more than
  USD)

The column schema stores these values directly. Cross-conversion via USD:
`amount_in_B = amount_in_A × (rate_A / rate_B)` where `rate_X` = value of 1 unit
of X in USD.

### Supported Currencies

The API returns **170+ currencies** when `currency=USD`. We currently store 36
of them in `market_rates` (the ones relevant to our user base):

| Code | Country/Region       | Code | Country/Region |
| ---- | -------------------- | ---- | -------------- |
| AED  | United Arab Emirates | MAD  | Morocco        |
| AUD  | Australia            | MYR  | Malaysia       |
| BHD  | Bahrain              | NOK  | Norway         |
| BTC  | Bitcoin (crypto)     | NZD  | New Zealand    |
| CAD  | Canada               | OMR  | Oman           |
| CHF  | Switzerland          | QAR  | Qatar          |
| CNY  | China (Yuan)         | RUB  | Russia         |
| DKK  | Denmark              | SAR  | Saudi Arabia   |
| DZD  | Algeria              | SEK  | Sweden         |
| EGP  | Egypt                | SGD  | Singapore      |
| EUR  | Eurozone             | TND  | Tunisia        |
| GBP  | United Kingdom       | TRY  | Turkey         |
| HKD  | Hong Kong            | USD  | United States  |
| INR  | India                | ZAR  | South Africa   |
| IQD  | Iraq                 | ISK  | Iceland        |
| JOD  | Jordan               | KPW  | North Korea    |
| JPY  | Japan                | KRW  | South Korea    |
| KWD  | Kuwait               | LYD  | Libya          |

Plus 4 metals: Gold, Silver, Platinum, Palladium.

> [!NOTE] Adding a new currency requires zero code changes — just add the column
> in a migration and map it from the API response in the edge function.

---

## 2. API Pricing Comparison

### metals.dev (Current Provider)

| Plan     | Price    | Requests/mo | Per-Request |
| -------- | -------- | ----------- | ----------- |
| Free     | $0       | 100         | —           |
| Copper   | $1.79/mo | 2,000       | $0.0009     |
| Silver   | $9.99/mo | 10,000      | $0.001      |
| Gold     | $24.99   | 30,000      | $0.0008     |
| Platinum | $49.99   | 100,000     | $0.0005     |

**Our usage**: 30-min intervals × 24h × 30 days = **1,440 calls/month** →
**Copper plan ($1.79/mo)** is sufficient.

### Competitor Analysis

| Provider            | Free Tier  | Cheapest Paid  | Metals+Currencies?  | Notes                                 |
| ------------------- | ---------- | -------------- | ------------------- | ------------------------------------- |
| **metals.dev**      | 100 req/mo | $1.79/mo (2K)  | ✅ Both in 1 call   | Best value — combined endpoint        |
| GoldAPI.io          | 100 req/mo | $9.99/mo       | Metals only         | No currency rates; needs 2nd provider |
| MetalpriceAPI       | 50 req/mo  | $10/mo         | ✅ Both             | Higher cost, no clear advantage       |
| Metals-API          | Limited    | $4.99/mo (200) | ✅ Both             | Lower free tier, higher per-req cost  |
| Exchange Rates API  | 1,500/mo   | $7.99/mo       | ✅ Both             | Higher free tier but 4x the price     |
| Fixer.io            | 100 req/mo | $14.99/mo      | Currencies + BTC/Au | Limited metal support                 |
| Open Exchange Rates | 1,000/mo   | $12/mo         | Currencies only     | No metals; needs 2nd provider         |

### Decision

**Stick with metals.dev**. Reasons:

1. **Single API call** for both metals AND 37 currencies (competitors often need
   2 APIs)
2. **Cheapest combined option** at $1.79/mo for our usage pattern
3. **Already integrated** — only requires changing `currency=EGP` →
   `currency=USD`
4. Dynamic `currency` parameter = no extra cost to change base currency

---

## 3. Fetch Frequency Analysis

| Interval   | Calls/Month | Plan Needed        | Data Freshness  |
| ---------- | ----------- | ------------------ | --------------- |
| 60 min     | 720         | Copper ($1.79)     | Hourly          |
| **30 min** | **1,440**   | **Copper ($1.79)** | **Half-hourly** |
| 15 min     | 2,880       | Silver ($9.99)     | Quarter-hourly  |
| 5 min      | 8,640       | Silver ($9.99)     | Near real-time  |

**Decision**: **30-minute intervals** — best balance of freshness vs. cost.
Stays within Copper plan ($1.79/mo). Personal finance tracking doesn't need
minute-level accuracy.

---

## 4. Universal Base Currency: Why USD?

### Requirements

- Enable any-to-any currency conversion without hardcoded pairs
- Single source of truth for all exchange rates
- Minimal API transformation (ideally 1:1 mapping)

### Options Evaluated

| Option                | Pros                                           | Cons                                          |
| --------------------- | ---------------------------------------------- | --------------------------------------------- |
| **USD as base**       | API returns native USD values; global standard | EGP users see 1 extra conversion step         |
| EGP as base (current) | Direct for Egyptian users                      | Breaks for non-EGP users; locks architecture  |
| EUR as base           | EU standard                                    | Not natively returned by API; extra transform |

### Decision

**USD as universal base**. When the metals.dev API is called with
`currency=USD`:

- Metal prices are in USD/gram (native, no transformation)
- Currency rates are "units per 1 USD" (native, no transformation)
- Cross-conversion formula:
  `amount_target = amount_source × (target_per_usd / source_per_usd)`
- Reverse: `amount_source = amount_target × (source_per_usd / target_per_usd)`

**Validation**: `A→B→A` roundtrip returns the original amount within floating
point tolerance (±0.01%).

---

## 5. Impact Analysis on Current Codebase

### Files Directly Referencing EGP-Based Rates

| File                                                                                                                 | Usage                                                  | Impact                                                 |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| [base-market-rate.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/models/base/base-market-rate.ts)           | 37 `_egp` field decorators                             | AUTO: regenerated by `db:migrate`                      |
| [MarketRate.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/models/MarketRate.ts)                            | `getRate()` hardcodes EGP logic                        | MANUAL: refactor to USD-based any-to-any               |
| [currency.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/currency.ts)                              | `convertToEGP()`, `egpToCurrency()`, `currencyToEGP()` | MANUAL: replace with `convertCurrency()`               |
| [metal.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/metal.ts)                                    | `goldEgpPerGram`, `silverEgpPerGram`, etc.             | MANUAL: rename to `_usd` variants                      |
| [asset-breakdown.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/analytics/asset-breakdown.ts)            | Calls `convertToEGP()`                                 | MANUAL: switch to `convertCurrency()`                  |
| [fetch-metal-rates/index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/fetch-metal-rates/index.ts)      | `currency=EGP` hardcoded, `_egp` interface             | MANUAL: change to `currency=USD`, rename interface     |
| [025_sync_snapshot_tables.sql](file:///e:/Work/My%20Projects/Astik/supabase/migrations/025_sync_snapshot_tables.sql) | Snapshot functions reference `_egp` columns            | SUPERSEDED: new migration 026 replaces these functions |
| [schema.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/schema.ts)                                           | `_egp` column definitions                              | AUTO: regenerated by `db:migrate`                      |
| [supabase-types.ts](file:///e:/Work/My%20Projects/Astik/packages/db/src/supabase-types.ts)                           | `_egp` type definitions                                | AUTO: regenerated by `supabase gen types`              |

### Existing Infrastructure

- **`preferred_currency`** field already exists in `BaseProfile` model and
  Supabase `profiles` table — no schema change needed
- **`formatCurrency()`** is already currency-agnostic — no changes needed
- **`CURRENCY_SYMBOLS`** map covers all 37 currencies — no changes needed
- **No existing unit tests** for currency conversion functions (gap to fill)

---

## 6. metals.dev Reputation & Accuracy Analysis

### Data Sources & Methodology

metals.dev aggregates data from **15+ trusted providers**, including commercial
sources, exchanges, and global banks. Their proprietary algorithm reconciles
multiple real-time data points to ensure precision. Sources include:

- **LBMA** (London Bullion Market Association) — the global benchmark for
  precious metals
- **LME** (London Metal Exchange) — industrial metals
- **MCX** (Multi Commodity Exchange, India)
- **IBJA** (India Bullion and Jewellers Association)
- **European Central Bank** — forex rates

### Update Frequency

- Real-time data with **max 60-second delay** on higher-tier plans
- 10-minute updates on lower-tier plans
- This is faster than competitors (GoldAPI: 1–5 min, MetalpriceAPI: 10+ min)

### Uptime & Reliability

- Claims **99.999% uptime** over the past 12 months
- Enterprise-grade infrastructure with 256-bit SSL encryption
- Dedicated status page for service monitoring

### Trust Scores (Third-Party Reviews)

| Provider       | Trust Score           | Source        | Notes                                                 |
| -------------- | --------------------- | ------------- | ----------------------------------------------------- |
| **metals.dev** | **4.5/5 (Excellent)** | Trustpilot    | 36 reviews; praised for support & API                 |
| GoldAPI.io     | **Low**               | ScamAdviser   | "Shady hosting", hidden owner, suspected fake reviews |
| MetalpriceAPI  | **32.9/100**          | Scam Detector | Labeled "questionable"; advised against use           |

### Accuracy Verification

The actual API response (2026-02-20) shows:

- `gold = 160.426 USD/gram` → at ~31.1g/troy oz = **$4,989/oz**
  (cross-reference: gold spot price on 2026-02-20 was ~$4,985–5,000/oz ✅)
- `EUR = 1.1767955605` → 1 EUR = $1.18 (matches ECB published rate ✅)
- `GBP = 1.3458170334` → 1 GBP = $1.35 (matches Bank of England rate ✅)
- `EGP = 0.0210523309` → 1 USD = 47.50 EGP (matches Central Bank of Egypt rate
  ✅)

### Decision

**metals.dev is accurate and reliable.** It is the clear choice:

1. Strongest trust score among precious metals API providers
2. Data sourced from LBMA (the industry gold standard — literally)
3. Verified accuracy against central bank rates
4. Competitors have concerning trust scores from independent review sites

---

## 7. Region-Based Default Currency

### Requirement

The default `preferred_currency` for new users should be auto-detected from
their device region for **all 36 supported currencies**. If the user's region
doesn't map to any supported currency, default to USD.

### Technical Approach: `expo-localization`

**Library**: `expo-localization` (part of the Expo SDK)  
**Method**: `getLocales()` returns an array of locale objects with a
`regionCode` property (ISO 3166-1 alpha-2 country code).

```typescript
import { getLocales } from "expo-localization";

const locale = getLocales()[0]; // User's primary locale
// locale.regionCode = 'EG' | 'FR' | 'US' | etc.
```

### Region → Currency Mapping (Complete)

```typescript
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

function getDefaultCurrencyForRegion(): CurrencyType {
  const regionCode = getLocales()[0]?.regionCode ?? null;
  if (!regionCode) return "USD";
  return REGION_TO_CURRENCY[regionCode] ?? "USD";
}
```

### Key Design Notes

- **Denmark (DK) → DKK** and **Sweden (SE) → SEK** correctly map to their own
  currencies (EU members but NOT Eurozone)
- **BTC** has no country mapping (appropriately excluded)
- Non-Eurozone EU countries whose currencies we don't support (PL→PLN, HU→HUF,
  CZ→CZK, etc.) fall through to USD
- **Liechtenstein (LI) → CHF** (uses Swiss Franc)

### Technical Complexity

**Low complexity.** Key considerations:

1. `expo-localization` is **not currently installed** — requires
   `npx expo install expo-localization`
2. `regionCode` can be `null` on some devices (fallback to USD)
3. This logic runs **once during onboarding** (when user profile is created),
   not on every app launch
4. The user can always override via settings — this is just the initial default
5. No network request needed — region is derived from device locale settings

---

## 8. Risk Assessment

| Risk                                         | Likelihood | Mitigation                                                  |
| -------------------------------------------- | ---------- | ----------------------------------------------------------- |
| metals.dev API response format changes       | Low        | Response validated by TypeScript interface                  |
| Floating point precision in cross-conversion | Medium     | Use ±0.01% tolerance; round to 2 decimals for display       |
| WatermelonDB migration bump causes data loss | Low        | Pre-production; database will be truncated before migration |
| Breaking existing mobile UI references       | Medium     | TypeScript compiler catches all `_egp` references           |
| `regionCode` is null on user's device        | Low        | Falls back to USD as safe default                           |
