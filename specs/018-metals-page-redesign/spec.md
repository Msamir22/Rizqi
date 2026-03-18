# Feature Specification: Metals Page Redesign

**GitHub Issue**:
[#36 — Wire `metals.tsx` to real data instead of hardcoded placeholders](https://github.com/Msamir22/Astik/issues/36)  
**Created**:
2026-03-18  
**Status**: Draft  
**Input**: Redesign the "My Metals" screen to display real user metal holdings
from the database, replacing all hardcoded placeholders with dynamic data.
Include portfolio analytics, profit/loss tracking, and a polished UI with
dark/light theme support.

---

## Clarifications

### Session 2026-03-18

- Q: Are edit/delete operations for existing holdings in scope? → A: Out of
  scope — add only. Edit and delete will be addressed in separate issues.
- Q: What should the modal show if createMetalHolding() fails? → A: Keep modal
  open + show inline error toast at bottom with retry option. Form data stays
  intact.
- Q: What should the page show while useMetalHoldings is loading? → A: Skeleton
  shimmer placeholders matching the final layout (hero card + card skeletons).
  Use a reusable `Skeleton` primitive component in `components/ui/Skeleton.tsx`
  that each page can compose into page-specific layouts.
- Q: How should holdings be sorted within each tab? → A: Newest first (purchase
  date descending).
- Q: Should duplicate holding names be allowed? → A: Yes, allow duplicates — no
  uniqueness constraint on names.

---

## Out of Scope

- **Edit holdings** — Modifying existing metal holding details (tracked in
  separate GitHub issue)
- **Delete holdings** — Removing metal holdings (tracked in separate GitHub
  issue)
- **Platinum support** — Future extensibility is required in architecture, but
  Platinum is not implemented in this feature

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — View Total Metals Portfolio Value (Priority: P1)

A user opens the "My Metals" tab and immediately sees their total metals
portfolio value displayed in their preferred currency, with a USD equivalent. A
profit/loss indicator shows how their portfolio has performed since purchase,
with an info tooltip explaining what the profit value means.

**Why this priority**: This is the core value proposition — users need to see
their aggregate wealth at a glance. Without this, the screen provides no value.

**Independent Test**: Can be tested by creating metal holdings and verifying the
total value, USD conversion, and profit/loss calculation render correctly using
live market rates.

**Acceptance Scenarios**:

1. **Given** a user has gold and silver holdings, **When** they open the My
   Metals screen, **Then** they see the total portfolio value in their preferred
   currency (e.g., "EGP 132,450"), the USD equivalent (e.g., "≈ $2,649 USD"),
   and a profit/loss pill (e.g., "+EGP 34,250 (+34.9%) all time"). If the user's
   preferred currency is USD, the USD equivalent line is hidden.
2. **Given** a user has no metal holdings, **When** they open the My Metals
   screen, **Then** they see a total value of "0" and an empty state encouraging
   them to add their first holding.
3. **Given** a user taps the info tooltip beside the profit value, **When** a
   well-styled custom tooltip appears (not the native OS tooltip), **Then** it
   explains that profit is calculated as the difference between the current
   market value and the total purchase price of all holdings.

---

### User Story 2 — View Individual Metal Holdings by Type (Priority: P1)

A user can switch between Gold and Silver tabs to see their individual holdings
for each metal type. Each holding card displays the asset name, item form
(Jewelry, Bar, Coin), purity (karat or fineness), weight in grams, current
market value, purchase date, and profit/loss percentage.

**Why this priority**: Users need detailed per-item visibility to understand
each holding's performance. This is the main interaction surface of the screen.

**Independent Test**: Can be tested by creating holdings of different metal
types and verifying the tab switching, card data, and profit/loss calculations.

**Acceptance Scenarios**:

1. **Given** a user has gold holdings, **When** they tap the "Gold" tab,
   **Then** they see only gold holding cards, each showing: asset name, item
   form icon, purity badge, weight, current value, purchase date, and
   profit/loss percentage.
2. **Given** a user has silver holdings, **When** they tap the "Silver" tab,
   **Then** they see only silver holding cards with the same information
   structure.
3. **Given** a user's holding has increased in market value since purchase,
   **When** the card renders, **Then** the profit/loss shows a positive
   percentage in green (e.g., "+12.5%").
4. **Given** a user's holding has decreased in market value since purchase,
   **When** the card renders, **Then** the profit/loss shows a negative
   percentage in red (e.g., "-2.1%").

---

### User Story 3 — Portfolio Breakdown by Metal Type (Priority: P2)

When a user holds both gold and silver, two summary cards appear showing the
split — each card displays the metal name, total value, percentage of portfolio,
and item count. This section is hidden when the user holds only one metal type.

**Why this priority**: Provides portfolio insight at a glance but is secondary
to individual holding details.

**Independent Test**: Can be tested by creating holdings of one metal type
(verifying section is hidden), then adding a second type (verifying both summary
cards appear with correct percentages).

**Acceptance Scenarios**:

1. **Given** a user has both gold and silver holdings, **When** they view the My
   Metals screen, **Then** two summary cards appear side by side: one for Gold
   (e.g., "EGP 112k · 85% · 3 items") and one for Silver (e.g., "EGP 20k · 15% ·
   1 item").
2. **Given** a user has only gold holdings (no silver), **When** they view the
   screen, **Then** the portfolio breakdown section is not visible.
3. **Given** a user has only silver holdings (no gold), **When** they view the
   screen, **Then** the portfolio breakdown section is not visible.

---

### User Story 4 — View Live Market Rates (Priority: P2)

A user can see the current live gold and silver market rates in a subtle strip
at the bottom of the scrollable content, showing price per gram and a
directional indicator (up/down).

**Why this priority**: Contextual market data helps users make informed
decisions but is supplementary to portfolio data.

**Independent Test**: Can be tested by verifying market rate data renders from
the existing `useMarketRates` hook and matches the latest available rate.

**Acceptance Scenarios**:

1. **Given** market rates are available, **When** the user scrolls to the bottom
   of their holdings, **Then** they see a live rate strip showing gold price per
   gram with a directional arrow and silver price per gram with a directional
   arrow (matching the dashboard LiveRates component format).
2. **Given** market rates are unavailable or loading, **When** the user views
   the rate strip, **Then** a placeholder or loading indicator is shown instead
   of stale data.

---

### User Story 5 — Add New Metal Holding (Priority: P2)

A user can add new metal holdings via a redesigned bottom-sheet modal. The modal
can be opened from two entry points with different behavior:

**Entry Point 1 — Per-section button** (e.g., "+ Add Gold Holding" or "+ Add
Silver Holding"): The metal type is pre-selected and the metal type toggle is
**hidden** in the modal. Title shows "New Gold Holding" or "New Silver Holding".

**Entry Point 2 — Page header plus button** (green ⊕ icon in the top-right
header): The modal opens with the metal type toggle **visible**, allowing the
user to choose Gold or Silver. Title shows "New Holding".

The modal includes fields for: name, metal type toggle (conditionally visible),
item form (Coin, Bar, Jewelry), purity dropdown (predefined options per metal
type), weight in grams, purchase price (required), purchase date, and optional
notes. A live valuation preview shows the current market value estimate.

**Why this priority**: Without the ability to add holdings, the screen cannot
populate with data. The existing modal needs a full redesign to include all
required fields.

**Independent Test**: Can be tested by tapping each entry point, verifying
correct tab visibility, filling all fields, saving, and verifying the holding
appears.

**Acceptance Scenarios**:

1. **Given** the user is on the Gold tab, **When** they tap "+ Add Gold
   Holding", **Then** the modal opens with Gold pre-selected, the metal toggle
   is hidden, the title shows "New Gold Holding", and gold purity options (24K,
   22K, 21K, 18K, 14K) are displayed.
2. **Given** the user is on the Silver tab, **When** they tap "+ Add Silver
   Holding", **Then** the modal opens with Silver pre-selected, the metal toggle
   is hidden, and silver purity options (999, 925, 900) are displayed.
3. **Given** the user taps the header plus button (⊕), **When** the modal opens,
   **Then** the metal toggle is visible, defaulting to Gold, and the title shows
   "New Holding".
4. **Given** the user fills all required fields and taps Save, **When** the
   holding is created, **Then** it appears in the correct metal tab with the
   correct data.
5. **Given** the user has not filled all required fields, **When** they attempt
   to save, **Then** validation errors highlight the missing fields and the save
   is prevented.

---

### User Story 6 — Dark and Light Theme Support (Priority: P1)

The entire metals screen — including the main page AND the add holding modal —
must be fully compatible with both dark and light themes, using the app's
existing theme system and Tailwind dark: variants. All text, backgrounds,
borders, badges, buttons, and modal surfaces must adapt correctly.

**Why this priority**: Theme compatibility is a non-negotiable requirement for
all Astik screens.

**Independent Test**: Can be tested by toggling the device theme and verifying
all elements render correctly in both modes.

**Acceptance Scenarios**:

1. **Given** the user's device is in light mode, **When** they open My Metals,
   **Then** all backgrounds, text, cards, badges, and buttons use the light
   theme colors.
2. **Given** the user's device is in dark mode, **When** they open My Metals,
   **Then** all elements switch to dark theme colors (slate-900 bg, slate-800
   cards, white text, etc.).
3. **Given** the user opens the add holding modal in light mode, **When** the
   modal renders, **Then** the sheet bg, form card, inputs, purity pills, save
   button, and valuation preview all use light theme colors.
4. **Given** the user opens the add holding modal in dark mode, **When** the
   modal renders, **Then** all elements use dark theme colors (slate-900 sheet,
   slate-800 cards, gold accents, white text).

---

### Edge Cases

- What happens when a user has **zero holdings** of any type? → Show an empty
  state with a prompt to add their first holding.
- What happens when **market rates are unavailable** (e.g., offline, API down)?
  → Show the last cached rate if available, or a "Rates unavailable" message.
  Profit/loss calculations should use the last known rate or show "N/A".
- What happens with **purity selection**? → Purity is selected from a predefined
  dropdown (not free text). Gold options: 24K, 22K, 21K, 18K, 14K. Silver
  options: 999, 925, 900. The stored `purity_fraction` maps to these display
  values.
- What happens when a holding has **no item_form** set? → Default to showing
  just the metal type without a form label.
- What happens when a holding has **no purchase_price**? → Purchase price is a
  required field. The add modal enforces this validation — users cannot save a
  holding without entering a purchase price.
- What happens when the **preferred currency changes**? → All displayed values
  should re-convert using the new preferred currency rate.
- What happens when **saving a new holding fails** (e.g., DB write error)? → The
  modal stays open with all form data intact. An inline error toast/snackbar
  appears at the bottom of the modal with a "Retry" option. The modal is NOT
  dismissed.
- What happens while **holdings data is loading** on first render? → Show
  skeleton shimmer placeholders matching the page layout shape (hero card
  skeleton + holding card skeletons). Uses a reusable `Skeleton` primitive
  component from `components/ui/Skeleton.tsx`.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST fetch all user metal holdings by joining `assets`
  (where `type = 'METAL'`) with `asset_metals` from the local WatermelonDB
  database.
- **FR-002**: System MUST calculate each holding's current market value using
  the formula: `weight_grams × purity_fraction × live_market_rate_per_gram`.
- **FR-003**: System MUST calculate profit/loss per holding as:
  `((current_value - purchase_price) / purchase_price) × 100`.
- **FR-004**: System MUST aggregate total portfolio value as the sum of all
  individual holding current values.
- **FR-005**: System MUST display all monetary values in the user's preferred
  currency using the existing `convertCurrency` utility.
- **FR-006**: System MUST display a USD equivalent of the total portfolio value.
  If the user's preferred currency is already USD, the USD equivalent line MUST
  be hidden.
- **FR-007**: System MUST show a well-styled custom tooltip (not the native OS
  tooltip) next to the profit/loss value explaining how profit is calculated.
- **FR-008**: System MUST show a portfolio breakdown section (Gold vs Silver
  split with percentages and item counts) only when the user holds more than one
  metal type.
- **FR-009**: System MUST provide Gold/Silver tab switching that filters
  displayed holdings by `metal_type`.
- **FR-010**: System MUST display the following for each holding card: asset
  name (`assets.name`), item form (`asset_metals.item_form`), purity badge
  (converted from `purity_fraction` to karat/fineness display), weight in grams
  (`asset_metals.weight_grams`), current market value, purchase date
  (`assets.purchase_date`), and profit/loss percentage.
- **FR-011**: System MUST show a live market rates strip with gold and silver
  prices per gram (matching the dashboard LiveRates format) and directional
  indicators.
- **FR-012**: System MUST show an "Add [Metal] Holding" button per active tab
  that opens the add modal with the metal type pre-selected and the metal toggle
  hidden.
- **FR-019**: The page header MUST include a plus button (⊕) that opens the add
  modal with the metal type toggle visible (user picks the metal).
- **FR-020**: The modal title MUST be "New [Metal] Holding" when opened from a
  per-section button, and "New Holding" when opened from the header plus button.
- **FR-021**: The modal MUST show a live valuation preview row that estimates
  the current market value based on entered weight, purity, and live rates.
- **FR-016**: The add modal MUST include fields for: name (required), metal type
  toggle, item form dropdown (Coin, Bar, Jewelry), purity dropdown (predefined
  options per metal type, not free text), weight in grams (required), purchase
  price (required), purchase date (required), and notes (optional).
- **FR-017**: Purchase price MUST be a required field — holdings cannot be saved
  without it.
- **FR-018**: Purity options MUST be predefined per metal type: Gold → 24K, 22K,
  21K, 18K, 14K; Silver → 999, 925, 900.
- **FR-013**: System MUST render correctly in both dark and light themes using
  the existing design system colors.
- **FR-022**: The add holding modal MUST be fully compatible with both dark and
  light themes — all surfaces, inputs, pills, buttons, and text must adapt
  correctly.
- **FR-014**: System MUST show an appropriate empty state when the user has no
  metal holdings.
- **FR-015**: The architecture MUST be extensible to support additional metal
  types (e.g., Platinum) in the future without major refactoring.
- **FR-023**: System MUST show last cached rate when live rates are unavailable,
  or a "Rates unavailable" message if no cached data exists.
- **FR-024**: Holdings within each tab MUST be sorted by purchase date
  descending (newest first).
- **FR-025**: While holdings data is loading, the page MUST show skeleton
  shimmer placeholders matching the page layout shape. A reusable `Skeleton`
  primitive component (`components/ui/Skeleton.tsx`) MUST be used.
- **FR-026**: If `createMetalHolding()` fails, the modal MUST stay open with
  form data intact and display an inline error toast at the bottom with a retry
  option.

### Key Entities

- **Asset**: Parent entity representing any investment holding. Key attributes:
  name, type (METAL), purchase_price, purchase_date, currency, is_liquid.
  Related to the user.
- **Asset Metal**: Child entity for metal-type assets. Key attributes:
  metal_type (GOLD, SILVER), weight_grams, purity_fraction, item_form (Coin,
  Bar, Jewelry, or null).
- **Market Rate**: Live pricing data. Key attributes: gold_usd_per_gram,
  silver_usd_per_gram. Used for valuation calculations.

---

## Assumptions

- The existing `useMarketRates` hook provides sufficiently fresh rate data for
  valuation calculations.
- Purity is stored as `purity_fraction` (0.0–1.0) and converted to display
  format (e.g., 0.875 → "21K" for gold, 0.999 → "999" for silver) using the
  existing `purity-utils.ts` utilities.
- The add holding modal needs a full redesign — it currently has minimal fields
  (type toggle, karat selection, weight) and lacks name, item form, purchase
  price, purchase date, and notes.
- Profit/loss is calculated as "all time" (purchase price vs current value), not
  daily or period-based.
- The live rates directional arrow (up/down) can be derived by comparing the
  current rate to the previous day's rate from `market_rates` history, or
  simplified to always show the current rate without direction if historical
  comparison data is not readily available.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can see their total metals portfolio value within 1 second
  of opening the My Metals screen.
- **SC-002**: All holding cards display correct real data from the database —
  zero hardcoded placeholder values remain.
- **SC-003**: Profit/loss percentages are accurate to within 0.1% when compared
  against manual calculation using the same market rates.
- **SC-004**: Tab switching between Gold and Silver filters holdings instantly
  (no visible loading delay).
- **SC-005**: The portfolio breakdown section correctly hides when only one
  metal type is held, and shows accurate percentages when both types are
  present.
- **SC-006**: All UI elements render correctly in both dark and light themes
  without visual artifacts, missing colors, or illegible text.
- **SC-007**: The info tooltip beside profit successfully communicates the
  calculation method to 90% of users on first tap.

---

## UI Design Reference

The approved design is a mix of elements from 4 generated mockups:

| Section               | Source                      | Style                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero / Total Value    | Mockup 4 (Clean Wealth)     | Light, minimal, left-aligned with profit pill + info tooltip                                                                                                                                                                                                               |
| Portfolio Split Cards | Mockup 4 (Clean Wealth)     | Two horizontal cards (Gold/Silver), hidden if single metal                                                                                                                                                                                                                 |
| Metal Tabs            | Mockup 3 (Jewel Collection) | Dark-styled tab bar with dot indicators, item count + total                                                                                                                                                                                                                |
| Holding Cards         | Mockup 2/4 hybrid           | Light cards with name, purity badge, weight, form, date, P/L%                                                                                                                                                                                                              |
| Add Button            | Mockup 4 (Clean Wealth)     | Dashed gold/silver border outline button                                                                                                                                                                                                                                   |
| Live Rates Strip      | Mockup 4 (Clean Wealth)     | Inline strip at bottom of scroll, subtle, no floating                                                                                                                                                                                                                      |
| **Add Holding Modal** | **Gold-themed Premium**     | **Dark bottom sheet with gold accents. Conditional toggle: hidden from per-section button, visible from header ⊕. Fields: name, form pills, purity pills, weight, price, date, notes. Live valuation preview. Gold save button. Must support both dark AND light themes.** |
| Page Header           | Mixed                       | "My Metals" title left + green ⊕ plus button right                                                                                                                                                                                                                         |
