# Stats Module — First-Release Audit

**Date:** 2026-04-28 **Scope:** `apps/mobile/app/(tabs)/stats.tsx`,
`apps/mobile/app/charts.tsx`, `apps/mobile/components/stats/**`,
`apps/mobile/hooks/useAnalytics.ts`, `packages/logic/src/analytics/**` **Goal:**
Full-polish readiness assessment for v1.

---

## TL;DR — Release Verdict

**Not ready.** The stats module ships visible-but-wrong numbers in two places
(MoM card, multi-currency totals) and is effectively unreachable by most users
(no bottom-tab entry). The drilldown UX has a stable-color regression and a
hidden "top 6" cliff. The charts route is a "Coming Soon" placeholder
duplicating the stats tab.

There are **3 P0 blockers** that change the _meaning_ of numbers shown to users
— those must land before any release. Beyond that, the module is functionally
solid; remaining items are polish, missing translations, perf nits, and a strong
list of product enhancements that should be triaged into v1.1+.

---

## Module Map

| File                                                    | LOC | Role                                                                       |
| ------------------------------------------------------- | --- | -------------------------------------------------------------------------- |
| `app/(tabs)/stats.tsx`                                  | 38  | Composer — `<QuickStats/> <MonthlyExpenseChart/> <CategoryDrilldownCard/>` |
| `app/charts.tsx`                                        | 69  | **Placeholder** — "Coming Soon", duplicates `/stats` route                 |
| `components/stats/QuickStats.tsx`                       | 100 | Avg monthly spend + MoM % card                                             |
| `components/stats/MonthlyExpenseChart.tsx`              | 190 | Grouped bar chart (income vs expense), 6m/12m toggle                       |
| `components/stats/CategoryDrilldownCard.tsx`            | 290 | Donut + L1→L2→L3 drilldown with breadcrumbs                                |
| `components/stats/drilldown/DrilldownBreadcrumbs.tsx`   | 65  | Breadcrumb trail                                                           |
| `components/stats/drilldown/DrilldownCategoryItem.tsx`  | 84  | Single category row                                                        |
| `components/stats/drilldown/types.ts`                   | 46  | `CategoryData`, `BreadcrumbItem`, `CHART_COLORS`                           |
| `hooks/useAnalytics.ts`                                 | 383 | 4 hooks — only 2 actually used by stats components                         |
| `packages/logic/src/analytics/transaction-analytics.ts` | 263 | Pure aggregation functions (tested)                                        |

**Routing reality:** Stats is reachable **only via the side drawer**
(`AppDrawer.tsx:106-110`). It is not in the bottom tab bar
(`CustomBottomTabBar.tsx:68` — `TAB_ORDER` contains only
`index, accounts, transactions, metals`). For a personal-finance app, the
analytics view _is_ the value prop; hiding it in the drawer is a UX cliff.

---

## P0 — Release Blockers (numbers are wrong)

### P0-1. QuickStats "vs Last Month" is comparing the wrong months

[apps/mobile/components/stats/QuickStats.tsx:31-45](apps/mobile/components/stats/QuickStats.tsx:31)

```ts
const currentMonth = summaries[0];
const lastMonth = summaries[1];
```

`useMonthlySummaries` returns months in **chronological order** (oldest →
newest, see [useAnalytics.ts:357](apps/mobile/hooks/useAnalytics.ts:357) —
`for (let i = months - 1; i >= 0; i--)` pushes oldest first). With
`SUMMARY_MONTHS = 3`, `summaries[0]` is **3 months ago**, `summaries[1]` is **2
months ago**. The "vs Last Month" arrow + percentage is comparing months **3 → 2
months ago**, labeled as current vs last.

Avg-monthly-spend math is correct (it's an average); only the MoM card is wrong.

**Fix:** Read from the end of the array (or invert the iteration):
`summaries[summaries.length - 1]` for current, `summaries[summaries.length - 2]`
for last. Add a unit test against `useMonthlySummaries`'s ordering contract.

### P0-2. Multi-currency aggregation is meaningless

All analytics functions (`calculateMonthlyTotals`, `aggregateByCategory`,
`generateMonthlyChartData`) sum the raw `Transaction.amount` field across
**all** transactions regardless of `Transaction.currency`
([base-transaction.ts:43](packages/db/src/models/base/base-transaction.ts:43) —
`currency!: CurrencyType`).

For a user with EGP + USD + Gold accounts (Monyvi's stated audience), the bar
chart, the avg, the MoM, and the donut are all summing dimensionless numbers —
e.g. 1,000 EGP + 50 USD = "1050". The `formatCurrency` call then slaps the
user's preferred currency symbol on it, claiming the result _is_ that currency.

**Fix:** Pre-release, **at minimum** filter to a single currency (the user's
preferred currency) and label the screen accordingly, or drop multi-currency
users from the screen with a friendly message. The proper fix is FX-normalize at
aggregation time using `market_rates` — but that's a multi-day workstream.
Recommend P0-min (filter) for v1, P1 (FX-normalize) for v1.1.

### P0-3. `charts.tsx` ships as "Coming Soon" and duplicates `/stats`

[apps/mobile/app/charts.tsx](apps/mobile/app/charts.tsx)

The route `/charts` exists, renders a "Coming Soon" placeholder, uses the same
`t("stats")` title as the real stats tab, and violates project styling rules
(`style={{ color: theme.text.primary }}` instead of the `text-text-primary`
class — [charts.tsx:38-49](apps/mobile/app/charts.tsx:38)).

**Fix:** Delete `app/charts.tsx`. The route is not linked from anywhere I could
find via grep. If it was reserved for a future "Charts" expansion, do that work
in `(tabs)/stats.tsx` — don't ship a dead route.

---

## P1 — Bugs & Correctness

### P1-1. Drilldown is hardcoded to expenses only

[CategoryDrilldownCard.tsx:62](apps/mobile/components/stats/CategoryDrilldownCard.tsx:62)
— `Q.where("type", "EXPENSE")`. There's no income breakdown. Either add an
INCOME/EXPENSE toggle, or rename the card to "Expense Breakdown" so the title
doesn't lie.

### P1-2. Hardcoded English month labels in chart

[transaction-analytics.ts:168-181](packages/logic/src/analytics/transaction-analytics.ts:168)
— `["Jan", "Feb", ..., "Dec"]` hardcoded. Arabic locale users see English. Use
`Intl.DateTimeFormat(locale, { month: "short" })` or i18n keys.

### P1-3. Hardcoded English breadcrumb seed

[CategoryDrilldownCard.tsx:44](apps/mobile/components/stats/CategoryDrilldownCard.tsx:44)
— `{ id: null, name: "All Categories", level: 0 }`. Add `t("all_categories")`.

### P1-4. Hardcoded accessibility hint

[DrilldownCategoryItem.tsx:49](apps/mobile/components/stats/drilldown/DrilldownCategoryItem.tsx:49)
— `accessibilityHint={hasChildren ? "Tap to drill down" : undefined}`.
Translate.

### P1-5. Period labels `"6m"` / `"12m"` not translated

[MonthlyExpenseChart.tsx:22, 92](apps/mobile/components/stats/MonthlyExpenseChart.tsx:22)
— locale-neutral but Arabic users would benefit from `٦ شهور` / `١٢ شهر`.

### P1-6. `Math.round` percentages don't sum to 100%

[transaction-analytics.ts:131](packages/logic/src/analytics/transaction-analytics.ts:131)
— `Math.round((total / totalExpenses) * 100)`. Categories can sum to 99% or
101%. Either use `toFixed(1)` and render decimals, or use largest-remainder
rounding so they sum to 100.

### P1-7. Top-6 cliff in drilldown list

[CategoryDrilldownCard.tsx:276](apps/mobile/components/stats/CategoryDrilldownCard.tsx:276)
— `currentLevelData.slice(0, 6)`. The donut renders all categories; the list
silently truncates to 6. User sees a slice in the donut that has no row in the
legend below. Either:

- Show all and scroll, or
- Show top 5 + an "Other (n)" aggregate row.

### P1-8. Category colors are unstable across drilldowns and re-sorts

[CategoryDrilldownCard.tsx:166](apps/mobile/components/stats/CategoryDrilldownCard.tsx:166)
— color is reassigned by **filtered+sorted index** in the current view. The same
category gets a different color when the user drills in, drills out, or when the
sort order shifts because amounts changed. Visually jarring and breaks the "Food
= orange" mental model.

**Fix:** Allocate color **once per category id** (e.g. hash the id into the
palette, or store color on the category record — `Category.color` already exists
per
[transaction-analytics.ts:132](packages/logic/src/analytics/transaction-analytics.ts:132)).

### P1-9. Stale month boundary across midnight

[CategoryDrilldownCard.tsx:35-36, 50-74](apps/mobile/components/stats/CategoryDrilldownCard.tsx:35)
— `currentMonth` and `currentYear` are computed inline from `new Date()`. If the
user keeps the app open across the midnight of the last day of the month, the
`useEffect` does not re-subscribe with the new month boundaries (deps don't
change because the values were captured at mount). Low-impact but real.

**Fix:** Listen to `AppState` `active` and recompute boundaries, or compute
boundaries inside the effect.

### P1-10. Two parallel observers on `transactions` for income & expense

[MonthlyExpenseChart.tsx:35-44](apps/mobile/components/stats/MonthlyExpenseChart.tsx:35)
— `useMonthlyChartData(months, undefined, "EXPENSE")` and `(..., "INCOME")` run
two concurrent subscriptions on the same table. Cheaper to subscribe once (no
`type` filter) and split locally in `useMemo`.

### P1-11. Errors are logged to `console.error` only — no UI surface

[useAnalytics.ts:70, 87, 156, 167, 253, 264, 343](apps/mobile/hooks/useAnalytics.ts:70)
— every hook tracks `error` state and exposes it, but no component reads it. A
WatermelonDB query failure shows the spinner forever. Either wire the error into
the components or remove the unused state.

Also violates the project logger rule (`console.log` / `console.error` in
production code per [CLAUDE.md](CLAUDE.md)). Use a structured logger.

### P1-12. Skeleton-loading rule violated in 3 places

Per [.claude/rules/skeleton-loading.md](.claude/rules/skeleton-loading.md),
`ActivityIndicator` is forbidden for content loading. Used in:

- [QuickStats.tsx:55](apps/mobile/components/stats/QuickStats.tsx:55)
- [MonthlyExpenseChart.tsx:118](apps/mobile/components/stats/MonthlyExpenseChart.tsx:118)
- [CategoryDrilldownCard.tsx:229](apps/mobile/components/stats/CategoryDrilldownCard.tsx:229)

Replace with `<Skeleton>` compositions matching each card's shape.

### P1-13. `charts.tsx` styling violates project rules

Already covered in P0-3, but specifically: uses
`style={{ color: theme.text.primary }}` (forbidden — see Prohibited Patterns in
[CLAUDE.md](CLAUDE.md)), and `style={{ backgroundColor: theme.background }}`
instead of NativeWind classes.

### P1-14. Dead hooks `useCategoryBreakdown` and `useComparison`

[useAnalytics.ts:107, 190](apps/mobile/hooks/useAnalytics.ts:107) — fully
implemented, never called from anywhere. `CategoryDrilldownCard` writes its own
observe subscription instead of using `useCategoryBreakdown`. Either delete the
dead code or refactor `CategoryDrilldownCard` to use the hook (and add
`accountIds` filter support — see product gaps below).

### P1-15. `getMonthBoundaries` and `getYearMonthBoundaries` are duplicates

[transaction-analytics.ts:15, 231](packages/logic/src/analytics/transaction-analytics.ts:15)
— same function, same implementation, two names. `getMonthBoundaries` is unused.
Delete.

### P1-16. No unit tests for hooks or components

`packages/logic/src/analytics/__tests__/transaction-analytics.test.ts` covers
the pure logic well, but `useAnalytics.ts` and the three stats components have
no tests. Given P0-1 is exactly the kind of bug a hook test would have caught,
this is a release-readiness gap.

---

## P2 — Performance

Most of these are micro-optimizations on already-fast code. Listed for
completeness; pick the cheap wins.

### P2-1. Missing `useMemo` on derived chart data

- [MonthlyExpenseChart.tsx:49-68](apps/mobile/components/stats/MonthlyExpenseChart.tsx:49)
  — `chartData` array built every render
- [MonthlyExpenseChart.tsx:71-73](apps/mobile/components/stats/MonthlyExpenseChart.tsx:71)
  — `totalExpenses`, `totalIncome`, `netSavings` recomputed every render
- [CategoryDrilldownCard.tsx:199-204](apps/mobile/components/stats/CategoryDrilldownCard.tsx:199)
  — `pieData` rebuilt every render
- [CategoryDrilldownCard.tsx:176](apps/mobile/components/stats/CategoryDrilldownCard.tsx:176)
  — `totalAmount` reduce every render
- [QuickStats.tsx:34-45](apps/mobile/components/stats/QuickStats.tsx:34) —
  `avgExpense`, `percentageChange` recomputed every render

### P2-2. Drilldown walk-up is O(N × depth) per memo recompute

[CategoryDrilldownCard.tsx:122-150](apps/mobile/components/stats/CategoryDrilldownCard.tsx:122)
— for each transaction, walks up the category tree until matching the current
level. With 1000+ tx and a deep tree this could become noticeable (every observe
emit recomputes). Pre-computing a `transactionId → ancestorAtEachLevel` map once
would amortize this.

### P2-3. `Map<string, CategoryData>` is rebuilt on every category change

[CategoryDrilldownCard.tsx:77-107](apps/mobile/components/stats/CategoryDrilldownCard.tsx:77)
— fine in practice (categories are static), but the inner
`parent.childrenIds.push` mutates a value typed `readonly string[]` (the
`readonly` modifier on the interface only prevents reassignment, not mutation).
The accompanying comment acknowledges this; cleaner to either drop the
`readonly` or build children arrays in a separate pass.

### P2-4. Two observers when one would do

See P1-10 above.

---

## P3 — Translation Audit Summary

All translation keys used by stats exist in both `en/common.json` and
`ar/common.json`. Hardcoded strings remaining:

| Location                                                                                            | String                | Suggested key                     |
| --------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------- |
| [CategoryDrilldownCard.tsx:44](apps/mobile/components/stats/CategoryDrilldownCard.tsx:44)           | `"All Categories"`    | `all_categories`                  |
| [DrilldownCategoryItem.tsx:49](apps/mobile/components/stats/drilldown/DrilldownCategoryItem.tsx:49) | `"Tap to drill down"` | `tap_to_drill_down`               |
| [transaction-analytics.ts:168-181](packages/logic/src/analytics/transaction-analytics.ts:168)       | `["Jan", ..., "Dec"]` | use `Intl.DateTimeFormat(locale)` |
| [MonthlyExpenseChart.tsx:22, 92](apps/mobile/components/stats/MonthlyExpenseChart.tsx:22)           | `"6m"` / `"12m"`      | `period_6m`, `period_12m`         |

Bonus: `useLocale().language` is wired into `accessibilityLanguage` correctly in
`DrilldownCategoryItem` — but the `accessibilityLabel` interpolates a percentage
with `.toFixed(1)` which always produces Western Arabic numerals (`27.3%`, not
`٢٧٫٣٪`). Verify against `formatCurrency`'s locale formatting — if it normalizes
numerals correctly, the same approach should be used for the percentage in the
a11y label.

---

## P4 — Security

Stats is read-only over local WatermelonDB. No user input, no network calls, no
auth. Risk surface is limited to:

- **`console.error` of WatermelonDB errors**
  ([useAnalytics.ts](apps/mobile/hooks/useAnalytics.ts) — 7 sites). Errors may
  include row data in their messages. Low risk but the project rule forbids raw
  `console.*` in production. Switch to the structured logger.

No other findings.

---

## P5 — Product Gaps & Enhancement Backlog

These are not bugs; they're "what would a user actually expect from a Stats
screen in a personal-finance app". Triage these into v1 / v1.1 / v2 based on
your roadmap.

### Discoverability & navigation (S — small)

- **G-1.** Add Stats as a 5th bottom tab, or replace one of the existing tabs.
  Currently 80% of users will never find it.
- **G-2.** Surface a "View full stats" link from the home dashboard.
- **G-3.** Tappable category leaf → list of transactions in that category for
  the period. Currently leaf rows are disabled with no exit.

### Time period & filters (M — medium)

- **G-4.** Period selector for the donut chart: This month, Last month, Last 3
  months, This year, Custom. Today's "This Month" lock means the donut is
  near-empty on the 1st of every month.
- **G-5.** Account filter — `useAnalytics` already accepts `accountIds`; expose
  a filter chip in the UI ("All accounts ▾").
- **G-6.** Income/Expense toggle on the donut (P1-1 above is the bug; this is
  the feature).

### Insights (the killer feature) (M)

- **G-7.** "You spent X% more on Food this month than your 6-month average." One
  sentence > one chart. Build on top of `useMonthlySummaries` +
  `aggregateByCategory`.
- **G-8.** "Top growing category" / "Top shrinking category" callouts.
- **G-9.** Tie to budgets — "You've spent 67% of your Groceries budget with 12
  days left." The budgets module exists; the stats screen ignores it.

### Net worth & assets (M)

- **G-10.** Net worth trend chart (line/area). Monyvi tracks Gold + USD savings
  — this is the headline metric for the user. Bigger draw than expense bars.
- **G-11.** Asset allocation donut (Cash vs Card vs Gold vs USD).

### Spending patterns (L — larger)

- **G-12.** Daily spending heatmap / calendar view. Reveals weekend vs weekday,
  payday cycles.
- **G-13.** Recurring vs one-off split (`recurring-payments` module already
  exists).
- **G-14.** Top merchants / counterparties (using transaction note / merchant
  fields if present).

### Onboarding & empty states (S)

- **G-15.** First-time empty state. Today: spinner → "no spending data". Replace
  with a guided card that suggests adding a transaction (link to mic / SMS scan
  / manual add).
- **G-16.** Per-card empty states matching shape (skeleton → meaningful zero
  state, not a generic message).

### Sharing & export (S–M)

- **G-17.** Share monthly summary as image/PDF. Egyptian users frequently share
  with spouse/family.
- **G-18.** Export to CSV.

### Polish (S)

- **G-19.** Pull-to-refresh on the ScrollView (even though data is observed and
  live, RTR provides a freshness signal).
- **G-20.** Per-card "Last updated X ago" hint when sync timestamp is stale.

### Multi-currency (M, prerequisite: P0-2)

- **G-21.** Once FX normalization is in, allow user to switch the display
  currency on the fly without affecting account currencies.

---

## Recommended Release Cut

If "first release" means "ship next sprint":

**Must land (P0):**

1. Fix QuickStats MoM math (P0-1) — 30 min + test
2. Filter analytics to user's preferred currency, label the screen "Spending in
   EGP" (P0-2 minimum) — 2-3h
3. Delete `charts.tsx` (P0-3) — 5 min

**Should land (P1 cluster, ~1-2 days):**

- Translations sweep (P1-2..P1-5) — half day
- Skeleton replacements (P1-12) — half day
- Top-6 cliff fix (P1-7) — 1h
- Stable category colors (P1-8) — 2h
- Hardcode `EXPENSE` → rename card title or add toggle (P1-1) — 1h
- Wire error UI or remove dead error state (P1-11) — 1h
- Delete dead hooks `useCategoryBreakdown`, `useComparison`,
  `getMonthBoundaries` (P1-14, P1-15) — 30 min
- Add hook tests for `useMonthlySummaries` ordering (regression guard) — 1h

**Nice to have (P2/P3, ~half day):** memoization passes, structured logger swap.

**Defer to v1.1 (G items):** discoverability tab move (G-1) is high-ROI and
small — consider pulling it forward. Insights (G-7..G-9) and net worth trend
(G-10) are the next big features.

---

## Out-of-Scope Notes

- The `(tabs)/_layout.tsx` `TAB_LABELS` are hardcoded in English (not
  stats-specific, but observed during the audit). Should be flagged separately.
- The `useAllCategories` context dependency is healthy; no changes needed.
- The pure-logic test coverage at
  `packages/logic/src/analytics/__tests__/transaction-analytics.test.ts` is
  solid — keep building on it.
