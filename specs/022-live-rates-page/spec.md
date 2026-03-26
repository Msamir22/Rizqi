# Feature Specification: Live Rates Page

**GitHub Issue**:
[#99 — Feature: "Live Rates" Page for Precious Metals & Currencies](https://github.com/Msamir22/Astik/issues/99)
**Created**: 2026-03-26 **Status**: Draft **Input**: Create a dedicated "Live
Rates" screen that displays real-time exchange rates for precious metals (Gold
24K/21K/18K, Silver, Platinum) and supported fiat currencies (USD, EUR, SAR,
etc. vs the user's preferred currency). The screen uses a unified scrollable
layout with no tabs — metals are displayed as cards at the top, followed by an
inline currency list.

---

## Approved Design Direction

The approved design is **Mockup 4 (Unified Scrollable)** with the following
modifications applied during review:

| Section           | Design                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Header            | Back arrow + "Live Rates" title + green "● Live" indicator                                  |
| Hero Gold Card    | Prominent card with 24K price, subtitle, trend %. Contains 21K/18K chips inline             |
| Other Metals      | Side-by-side Silver and Platinum cards with colored left borders                            |
| Currencies Header | "Currencies" label + search icon + dynamic "vs [preferred currency]" badge                  |
| Currency List     | 10 currencies shown by default. Each row: flag + code + name + rate + change %              |
| Load More         | "See all currencies →" link expands the list inline                                         |
| Sticky Footer     | Fixed footer docked to bottom: "Updated X min ago" timestamp                                |
| Access Points     | Accessible from the Dashboard (via existing LiveRates strip) and from the navigation Drawer |

---

## Out of Scope

- **Historical price charts** — Price history and trend charts for metals or
  currencies will be addressed in a future feature
  ([#160](https://github.com/Msamir22/Astik/issues/160)).
- **Currency conversion calculator** — Interactive converter between currencies
  is not part of this screen
  ([#161](https://github.com/Msamir22/Astik/issues/161)).
- **Push notifications** — Alerts for price thresholds or significant changes
  are out of scope ([#162](https://github.com/Msamir22/Astik/issues/162)).
- **Favorite/pinned currencies** — User-customizable currency list ordering will
  be addressed later ([#163](https://github.com/Msamir22/Astik/issues/163)).

---

## Clarifications

### Session 2026-03-26

- Q: What should the screen show while rates are loading on first render? → A:
  Skeleton shimmer placeholders matching the final layout shape (hero card
  skeleton + smaller card skeletons + currency row skeletons), consistent with
  the Metals page loading pattern.
- Q: When a user taps on a metal card or currency row, should anything happen? →
  A: No action on tap — items are display-only. Tap behavior may be added later
  when historical charts (#160) are implemented.
- Q: Should the Live Rates screen support pull-to-refresh? → A: Yes —
  pull-to-refresh triggers a manual rate fetch and updates the footer timestamp.
  Serves as a fallback when real-time connection drops.
- Q: How should exchange rates be formatted (decimal places)? → A: 2 decimal
  places for both metals and currencies, with trailing zeros hidden (e.g., "EGP
  4,850.87" or "50.45 EGP", but "EGP 4,850" not "EGP 4,850.00").
- Q: Does the "Updated X min ago" footer auto-refresh its relative timestamp? →
  A: Yes, auto-refresh the relative timestamp every 60 seconds (timer-based) to
  ensure staleness indicator is accurate even if no new rates arrive.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — View Precious Metal Rates at a Glance (Priority: P1)

A user navigates to the Live Rates screen and immediately sees the current gold
price per gram in their preferred currency, prominently displayed in a hero
card. The hero card shows the 24K pure gold price, with 21K and 18K prices as
compact chips within the same card. Below the gold card, silver and platinum
rates are shown in side-by-side cards.

**Why this priority**: Gold is the most tracked precious metal in the Egyptian
market. Users need to see the gold rate quickly and at a glance — this is the
primary reason they visit this screen.

**Independent Test**: Can be tested by opening the Live Rates screen and
verifying that the hero gold card displays the correct 24K, 21K, and 18K prices
per gram in the user's preferred currency, and that silver and platinum cards
display correct values with trend indicators.

**Acceptance Scenarios**:

1. **Given** market rates are available, **When** the user opens the Live Rates
   screen, **Then** they see a hero gold card displaying the 24K price per gram
   in their preferred currency (e.g., "EGP 4,850/g"), the subtitle "24 Karat ·
   Pure Gold", and a trend percentage (e.g., "▲ 1.2% today") in green for
   positive or red for negative change.
2. **Given** market rates are available, **When** the user views the hero gold
   card, **Then** they also see two compact chips showing 21K and 18K prices per
   gram (calculated from 24K price × purity fraction: 0.875 for 21K, 0.75 for
   18K).
3. **Given** market rates are available, **When** the user views below the hero
   card, **Then** they see two side-by-side cards for Silver and Platinum, each
   showing the metal name, price per gram, and trend indicator.
4. **Given** market rates are stale or unavailable (e.g., offline), **When** the
   user opens the screen, **Then** the last cached rates are displayed with a
   visual staleness indicator, or a "Rates unavailable" message is shown if no
   cached data exists.

---

### User Story 2 — View Fiat Currency Exchange Rates (Priority: P1)

Below the metals section, the user sees a scrollable list of fiat currency
exchange rates. The list header shows "Currencies" with a dynamic badge
indicating the base currency (e.g., "vs USD" reflecting the user's preferred
currency). By default, 10 currencies are visible, with a "See all currencies →"
link to expand the full list inline.

**Why this priority**: Egyptian users frequently monitor USD, EUR, and SAR rates
against EGP. This is the second key use case of the Live Rates screen.

**Independent Test**: Can be tested by verifying the currency list renders with
correct flag emojis, currency codes, full names, exchange rates, and change
percentages.

**Acceptance Scenarios**:

1. **Given** market rates are available, **When** the user scrolls to the
   Currencies section, **Then** they see a list of 10 currency rows by default,
   each showing: flag emoji, currency code (bold), full currency name, exchange
   rate value (converted to the user's preferred currency), and a change
   percentage badge.
2. **Given** the user's preferred currency is EGP, **When** the currencies
   header renders, **Then** the badge shows "vs EGP" and all rates are displayed
   as X EGP per unit of foreign currency.
3. **Given** the user's preferred currency is USD, **When** the currencies
   header renders, **Then** the badge shows "vs USD" and rates reflect
   conversions to USD.
4. **Given** a currency rate has not changed since the previous day, **When**
   the row renders, **Then** the change badge shows "0.00%" in a neutral/muted
   style.
5. **Given** 10 currencies are displayed, **When** the user taps "See all
   currencies →", **Then** the full list of supported currencies expands inline
   (no navigation to a new screen).

---

### User Story 3 — Search Currencies (Priority: P2)

The user can tap a search icon in the Currencies section header to filter the
currency list by code or name. The search is instant and filters the visible
list without navigating away.

**Why this priority**: With 35 supported currencies, search improves
discoverability but is secondary to viewing the default set of most relevant
currencies.

**Independent Test**: Can be tested by tapping the search icon, typing a partial
currency name or code, and verifying the list filters correctly.

**Acceptance Scenarios**:

1. **Given** the user taps the search icon, **When** a search input appears,
   **Then** the currency list filters in real-time as the user types.
2. **Given** the user types "SAR", **When** the list filters, **Then** only the
   Saudi Riyal row is displayed.
3. **Given** the user types "Dollar", **When** the list filters, **Then** all
   currencies with "Dollar" in the name are displayed (US Dollar, Canadian
   Dollar, etc.).
4. **Given** the user clears the search input, **When** the list resets,
   **Then** the default 10 currencies are shown (or the full expanded list if
   previously expanded).
5. **Given** the user searches for a non-existent currency, **When** no results
   match, **Then** an empty state message is shown (e.g., "No currencies found")
   and the "See all currencies →" link is hidden.

---

### User Story 4 — Live Connection Status & Staleness (Priority: P2)

The user can see a live connection indicator in the header showing whether the
app has an active real-time connection for rate updates. A sticky footer shows
the time since the last rate update.

**Why this priority**: Trust in rate freshness is critical for a finance app.
Users need confidence that they are seeing up-to-date data.

**Independent Test**: Can be tested by verifying the "● Live" indicator reflects
the Supabase real-time connection status, and the footer timestamp updates
correctly.

**Acceptance Scenarios**:

1. **Given** the app has an active Supabase real-time subscription, **When** the
   user views the header, **Then** a green dot and "Live" label are displayed.
2. **Given** the real-time connection is lost, **When** the user views the
   header, **Then** the indicator changes to a gray dot and the "Live" label
   remains visible but muted.
3. **Given** rates were last updated 5 minutes ago, **When** the user views the
   sticky footer, **Then** it shows a clock icon (🕐) followed by "Updated 5 min
   ago".
4. **Given** rates were updated just now, **When** the footer renders, **Then**
   it shows "Updated just now".

---

### User Story 5 — Dark and Light Theme Support (Priority: P1)

The entire Live Rates screen must be fully compatible with both dark and light
themes, using the app's existing theme system and Tailwind dark: variants.

**Why this priority**: Theme compatibility is a non-negotiable requirement for
all Astik screens.

**Independent Test**: Can be tested by toggling the device theme and verifying
all elements render correctly in both modes.

**Acceptance Scenarios**:

1. **Given** the user's device is in dark mode, **When** they open Live Rates,
   **Then** the background uses slate-900, cards use slate-800, text is white,
   and accent colors render correctly against the dark surface.
2. **Given** the user's device is in light mode, **When** they open Live Rates,
   **Then** all backgrounds, text, cards, and badges use light theme colors with
   appropriate contrast.

---

### User Story 6 — Navigation to Live Rates (Priority: P1)

A user can access the Live Rates screen from two entry points: (1) tapping the
existing live rates strip on the Dashboard, and (2) selecting "Live Rates" from
the navigation Drawer.

**Why this priority**: The screen needs to be discoverable and easily accessible
from the primary navigation surfaces.

**Independent Test**: Can be tested by tapping the dashboard rates strip and the
drawer entry, verifying both navigate to the Live Rates screen.

**Acceptance Scenarios**:

1. **Given** a user is on the Dashboard, **When** they tap the live rates
   summary strip, **Then** they are navigated to the full Live Rates screen.
2. **Given** a user opens the Drawer, **When** they tap "Live Rates", **Then**
   they are navigated to the Live Rates screen.
3. **Given** a user is on the Live Rates screen, **When** they tap the back
   arrow, **Then** they return to the previous screen.

---

### Edge Cases

- What happens when **market rates are stale** (older than the freshness
  threshold)? → Show the last cached rates with a visual staleness indicator
  (e.g., amber dot instead of green, "Updated 2h ago" in the footer).
- What happens when **market rates have never been fetched** (first launch,
  offline)? → Show an illustration image with a "Rates unavailable" message
  (consistent with the empty state illustrations used in the Metals page and
  Budget Dashboard).
- What happens when the user's **preferred currency changes**? → All displayed
  rates re-convert immediately using the new preferred currency. The "vs [X]"
  badge updates dynamically.
- What happens when the **gold 21K/18K prices** need to be calculated? → Derive
  from the 24K rate × purity fraction (0.875 for 21K, 0.75 for 18K). These are
  not separate API fields.
- What happens when the **currency list is fully expanded** and the user then
  searches? → Search filters the full expanded list. Clearing search returns to
  the full expanded state.
- What happens when the user's **preferred currency is the same as a listed
  currency**? → That currency row MUST be hidden from the list since showing a
  1.00 identity conversion provides no value.
- What happens when **Palladium** is in the schema but not shown? → Palladium is
  intentionally excluded from the UI for now, even though the `market_rates`
  schema includes `palladium_usd_per_gram`. The architecture should support
  adding it later.
- What happens while **rates are loading** on first render? → Show skeleton
  shimmer placeholders matching the page layout shape (hero card skeleton +
  metal card skeletons + currency row skeletons). Uses the reusable `Skeleton`
  primitive component from `components/ui/Skeleton.tsx`.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display the current gold 24K price per gram in the
  user's preferred currency, prominently in a hero card.
- **FR-002**: System MUST calculate and display gold 21K and 18K prices by
  multiplying the 24K price by the respective purity fractions (0.875 and 0.75).
- **FR-003**: System MUST display silver and platinum prices per gram in
  side-by-side cards below the hero gold card.
- **FR-004**: System MUST display trend indicators (up/down/flat) for each metal
  by comparing the current rate to the previous day's rate.
- **FR-005**: System MUST display a scrollable list of fiat currency exchange
  rates, showing 10 currencies by default.
- **FR-006**: Each currency row MUST display: flag emoji (from
  `CURRENCY_INFO_MAP`), currency code, full currency name, exchange rate in the
  user's preferred currency, and a change percentage badge.
- **FR-007**: System MUST provide a "See all currencies →" link that expands the
  full list of supported currencies inline (no navigation).
- **FR-008**: System MUST provide a search capability (via search icon in the
  Currencies header) that filters currencies by code or name in real-time.
- **FR-009**: The Currencies section header MUST display a dynamic "vs [X]"
  badge reflecting the user's preferred currency.
- **FR-010**: System MUST display a live connection indicator in the header:
  green dot + "Live" text when the Supabase real-time subscription is active,
  gray dot + muted "Live" text when disconnected.
- **FR-011**: System MUST display a sticky footer fixed to the bottom of the
  screen showing a clock icon (🕐) followed by "Updated X min ago" based on the
  `market_rates.updated_at` timestamp.
- **FR-012**: System MUST convert all prices to the user's preferred currency
  using the `convertCurrency` utility from `@astik/logic`.
- **FR-013**: System MUST re-derive all displayed values when the user's
  preferred currency changes.
- **FR-014**: System MUST show the last cached rate with a staleness indicator
  when live rates are unavailable. If no cached data exists, an illustration
  image with a "Rates unavailable" message MUST be shown (consistent with the
  empty state style used in the Metals page and Budget Dashboard).
- **FR-015**: System MUST be navigable from the Dashboard live rates strip
  (tapping it opens the Live Rates screen) and from the navigation Drawer.
- **FR-016**: System MUST render correctly in both dark and light themes using
  the existing design system colors.
- **FR-017**: System MUST use data exclusively from the existing `market_rates`
  table and the `useMarketRates` hook — no new API endpoints or data sources are
  required.
- **FR-018**: The architecture MUST support adding new metals (e.g., Palladium)
  by only: (1) adding a new `MetalCard` instance in the screen, and (2) adding a
  `getMetalPrice` call in the hook — no structural changes to hooks or screen
  layout required.
- **FR-019**: System MUST default the initial 10 currencies to the most relevant
  for the target market (MENA + major global), ordered by relevance (EGP, USD,
  SAR, AED, EUR, GBP, KWD, QAR, BHD, OMR).
- **FR-020**: System MUST hide the currency row for the user's preferred
  currency from the list (identity conversion provides no value).
- **FR-021**: System MUST hide the "See all currencies →" link when search
  results are empty (empty state message is shown instead).
- **FR-022**: While rates data is loading on first render, the page MUST show
  skeleton shimmer placeholders matching the page layout shape (hero card
  skeleton + metal card skeletons + currency row skeletons). Uses the reusable
  `Skeleton` primitive component from `components/ui/Skeleton.tsx`.
- **FR-023**: System MUST support pull-to-refresh on the scroll view, triggering
  a manual rate fetch and updating the footer timestamp on completion.
- **FR-024**: All rate values MUST be formatted to a maximum of 2 decimal places
  for both metals and currencies, with trailing zeros hidden (e.g., "4,850.87"
  not "4,850.00"; "50.4" not "50.40").
- **FR-025**: The "Updated X min ago" relative timestamp in the footer MUST
  auto-refresh every 60 seconds (timer-based) to accurately reflect the data
  staleness, irrespective of new data arriving from the subscription.

### Key Entities

- **Market Rate**: Live pricing data with exchange rates for 35 currencies (vs
  USD) and precious metal prices (gold, silver, platinum, palladium) per gram in
  USD. Key attributes: `usd_to_X` for each currency, `gold_usd_per_gram`,
  `silver_usd_per_gram`, `platinum_usd_per_gram`, `updated_at`. Source: existing
  `market_rates` table with real-time Supabase subscription.
- **Currency Info**: Display metadata for supported currencies. Key attributes:
  code, name, symbol, flag emoji. Source: existing `CURRENCY_INFO_MAP` from
  `@astik/logic`.

---

## Assumptions

- The existing `useMarketRates` hook provides sufficiently fresh rate data,
  including `latestRates`, `previousDayRate`, `isConnected`, and `isStale` — all
  needed for this feature.
- The `convertCurrency` utility from `@astik/logic` can convert between any two
  supported currencies using the market rates object.
- The gold 21K and 18K prices are not stored separately — they are derived from
  the 24K price × purity fraction.
- The "previous day rate" already available from `useMarketRates` is sufficient
  for computing trend percentages. The trend represents current vs previous day.
- The default 10 currencies are ordered by relevance to the Egyptian target
  market. The order is configurable but not user-customizable in this release.
- Currency search is client-side filtering of the already-loaded currency list
  (max 35 items) — no server-side search is needed.
- The existing `LiveRates.tsx` dashboard component can be extended to navigate
  to this new screen on tap, without breaking its current behavior.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can view all metal rates (Gold 24K/21K/18K, Silver,
  Platinum) within 1 second of opening the Live Rates screen.
- **SC-002**: All displayed rates match the data from the `market_rates` table —
  zero hardcoded values.
- **SC-003**: Trend percentages are accurate to within 0.01% when compared
  against manual calculation using current and previous day rates.
- **SC-004**: The currency list renders 10 items by default and expands to the
  full 35 on "See all currencies" tap without navigation.
- **SC-005**: Currency search filters results in under 100ms for any query.
- **SC-006**: All UI elements render correctly in both dark and light themes
  without visual artifacts or illegible text.
- **SC-007**: The "Updated X min ago" footer accurately reflects the
  `market_rates.updated_at` timestamp.
- **SC-008**: Both navigation entry points (Dashboard strip, Drawer)
  successfully navigate to the Live Rates screen.

---

## UI Design Reference

The approved mockup is available in the Stitch project:
[View in Stitch](https://stitch.withgoogle.com/projects/7247906301334054900)

| Section           | Style                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Hero Gold Card    | Full-width, slate-800 bg, left border 3px gold (#D97706), 28px price, 21K/18K chips inside |
| Silver/Platinum   | Side-by-side cards, slate-800 bg, colored left borders (silver #A0A0A0, platinum #94A3B8)  |
| Currencies Header | "Currencies" label + search icon + "vs [X]" badge (#10B981 tint)                           |
| Currency Rows     | Flag + code + name + rate + change badge, 48px height, dividers                            |
| Sticky Footer     | Fixed docked bottom, "Updated X min ago", #475569 text                                     |
| Header            | Back arrow + "Live Rates" + green "● Live" indicator                                       |
