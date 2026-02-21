# Feature Specification: Multi-Currency Architecture

**Feature Branch**: `006-multi-currency`  
**Created**: 2026-02-19  
**Status**: Draft  
**Input**: User description: "Refactor from hardcoded EGP single-currency to a
scalable, multi-currency architecture where users select their preferred display
currency."

## Assumptions

- EGP remains the default currency for new users (Egyptian market focus)
- The application is not yet in production; breaking schema changes are
  acceptable
- The metals.dev API `currency` parameter supports dynamic base currencies at no
  additional API cost (verified: same endpoint, same call count)
- Cross-currency conversion accuracy of ±0.01% is acceptable for personal
  finance tracking (not trading)
- Currency selection does not change the currency that existing accounts are
  denominated in — it only changes the **display/aggregation** currency for
  totals, net worth, and dashboards

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Totals in Preferred Currency (Priority: P1)

A user opens the Astik app and sees all aggregated financial data — total
balance, total assets, net worth — displayed in their preferred currency. An
Egyptian user with USD and EUR accounts sees their total balance converted to
EGP. A user who later relocates or prefers USD sees the same data displayed in
USD totals.

**Why this priority**: This is the core value of the multi-currency feature.
Without correct currency aggregation, the dashboard and all financial summaries
are meaningless to non-EGP users.

**Independent Test**: Can be fully tested by creating accounts in multiple
currencies, setting the preferred currency to USD, and verifying that the total
balance card shows correctly converted USD amounts.

**Acceptance Scenarios**:

1. **Given** a user has 3 accounts (EGP 50,000 / USD 1,000 / EUR 500) and
   preferred currency is EGP, **When** they view the dashboard, **Then** the
   total balance is displayed as the sum of all accounts converted to EGP using
   the latest market rates
2. **Given** a user has the same 3 accounts and preferred currency is USD,
   **When** they view the dashboard, **Then** the total balance is displayed as
   the sum of all accounts converted to USD using the latest market rates
3. **Given** a user has no accounts, **When** they view the dashboard with any
   preferred currency, **Then** the total balance shows 0 in that currency with
   the correct symbol/format

---

### User Story 2 - Change Preferred Display Currency (Priority: P1)

A user navigates to their profile or settings screen and selects a different
preferred display currency from a list of supported currencies. All aggregated
values throughout the app immediately reflect the new currency.

**Why this priority**: This is the user-facing mechanism that enables the entire
feature. Without the ability to change the preferred currency, the architecture
improvements have no user value.

**Independent Test**: Can be tested by changing the preferred currency in
settings and navigating to the dashboard to verify totals update.

**Acceptance Scenarios**:

1. **Given** a user's preferred currency is EGP, **When** they change it to USD
   in settings, **Then** all aggregated amounts (total balance, net worth, asset
   valuations) display in USD
2. **Given** a user changes preferred currency, **When** they close and reopen
   the app, **Then** the preferred currency persists and displays correctly
3. **Given** a user changes preferred currency, **When** they view individual
   account balances, **Then** each account still shows its native currency
   amount (only aggregated totals change)

---

### User Story 3 - Accurate Cross-Currency Conversion (Priority: P1)

The system performs all currency conversions using a universal base (USD) stored
from the metals.dev API. Any supported currency can be converted to any other
supported currency accurately, without relying on EGP as an intermediary.

**Why this priority**: Data integrity is foundational. If conversions are
inaccurate, all financial displays are wrong regardless of how well the UI
works.

**Independent Test**: Can be tested by comparing the app's conversion of EUR→JPY
against the known market rate, ensuring the result matches within acceptable
tolerance (±0.01%).

**Acceptance Scenarios**:

1. **Given** market rates are available, **When** converting 100 EUR to USD,
   **Then** the result matches `100 / (EUR rate per 1 USD)` within ±0.01%
2. **Given** market rates are available, **When** converting any currency A to
   any currency B, **Then** the result is consistent and reversible (`A→B→A`
   returns the original amount within rounding tolerance)
3. **Given** market rates are stale (over 24 hours), **When** conversion is
   needed, **Then** the system uses the most recent available rates and
   indicates staleness to the user

---

### User Story 4 - Metal Valuations in Preferred Currency (Priority: P2)

A user who owns gold assets sees their gold valuations (and other precious
metals) displayed in their preferred currency, not hardcoded to EGP.

**Why this priority**: Gold tracking is a core Astik feature for the Egyptian
market. Users who set USD as their preferred currency need metal valuations in
USD.

**Independent Test**: Can be tested by adding a gold asset and switching
preferred currency, verifying the displayed value changes proportionally to the
exchange rate.

**Acceptance Scenarios**:

1. **Given** a user owns 10g of 24K gold and preferred currency is EGP, **When**
   they view assets, **Then** the value shows `10 × gold_price_egp_per_gram`
2. **Given** the same gold asset and preferred currency is USD, **When** they
   view assets, **Then** the value shows `10 × gold_price_usd_per_gram`

---

### User Story 5 - Historical Snapshots in User's Currency (Priority: P3)

Daily snapshots (balance, assets, net worth) are stored or can be computed in a
way that supports displaying historical trends in the user's preferred currency,
even if they change their preferred currency after the snapshot was taken.

**Why this priority**: Historical accuracy matters for trend charts and
performance tracking, but it is a secondary concern compared to real-time
display.

**Independent Test**: Can be tested by viewing trend charts after changing
preferred currency and verifying the historical data is re-computed correctly.

**Acceptance Scenarios**:

1. **Given** a user has 30 days of snapshot history in EGP, **When** they change
   preferred currency to USD, **Then** trend charts recalculate and display all
   historical values in USD using the rates that were current at each snapshot
   date
2. **Given** no historical rates exist for a particular date, **When**
   displaying historical trends, **Then** the system uses the nearest available
   rate and indicates approximation

---

### Edge Cases

- What happens when the metals.dev API returns an error and no rates are
  available? → Display using last known rates with a staleness indicator
- What happens when a user sets their preferred currency to one that isn't in
  the supported list? → Only supported currencies are selectable; the picker
  prevents invalid selections
- What happens when two accounts have the same name but different currencies and
  the user aggregates them? → Each account retains its own currency; only the
  aggregated total uses the preferred currency
- What happens during the transition from EGP-based storage to USD-based
  storage? → A data migration converts existing EGP-based rates to USD-based
  rates using known conversion factors

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to select their preferred display currency
  from a list of supported currencies
- **FR-002**: System MUST display all aggregated financial amounts (total
  balance, net worth, total assets) in the user's preferred currency
- **FR-003**: System MUST perform cross-currency conversion between any two
  supported currencies without relying on a hardcoded intermediary
- **FR-004**: System MUST persist the user's preferred currency selection across
  sessions
- **FR-005**: System MUST display individual account and transaction amounts in
  their native (original) currency, regardless of preferred display currency
- **FR-006**: System MUST value precious metal assets (gold, silver, platinum,
  palladium) in the user's preferred currency
- **FR-007**: System MUST fetch and store exchange rates in a currency-agnostic
  format that does not assume a specific base currency in column names or data
  model
- **FR-008**: System MUST default to EGP as the preferred currency for new users
- **FR-009**: System MUST display the correct currency symbol or code for the
  preferred currency (e.g., $, €, EGP)
- **FR-010**: System MUST support displaying historical financial trends in the
  user's current preferred currency

### Key Entities

- **Market Rates**: Exchange rates and metal prices stored relative to a
  universal base currency (USD). Contains rate values for all supported
  currencies and metals, with timestamps indicating freshness
- **User Profile**: Extended with `preferred_currency` (already exists) —
  determines the display currency used for aggregated values throughout the app
- **Supported Currencies**: The set of currencies available for user selection
  (currently 37 currencies from the metals.dev API plus EGP)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can change their preferred display currency and see all
  aggregated values update within 1 second
- **SC-002**: Cross-currency conversion accuracy is within ±0.01% of the source
  API rates
- **SC-003**: No additional API calls are required compared to the current
  single-currency architecture (same 1 call per 30 minutes to metals.dev)
- **SC-004**: Adding support for a new display currency requires zero code
  changes (only configuration/data additions)
- **SC-005**: All existing financial data remains accurately accessible after
  the migration from EGP-based to currency-agnostic storage
- **SC-006**: Metal asset valuations (gold, silver, platinum, palladium) display
  correctly in any supported preferred currency
