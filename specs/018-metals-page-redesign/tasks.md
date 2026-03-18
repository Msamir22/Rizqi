# Tasks: Metals Page Redesign

**Input**: Design documents from `/specs/018-metals-page-redesign/`
**Prerequisites**: plan.md ✅, spec.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US6) from spec.md
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Create feature directory structure and barrel exports

- [ ] T001 Create component directory `apps/mobile/components/metals/` and
      barrel export `apps/mobile/components/metals/index.ts`

---

## Phase 2: Schema & Shared Infrastructure

**Purpose**: DB purity enums (single source of truth), reusable Tooltip
component

- [ ] T002 [P] Create SQL migration
      `supabase/migrations/034_gold_silver_purity_enums.sql` — define
      `gold_karat_enum` (24, 22, 21, 18, 14, 10) and `silver_fineness_enum`
      (999, 950, 925, 900, 850, 800) Postgres enums as SSOT for purity options
- [ ] T003 [P] Verify and update `packages/logic/src/utils/purity-utils.ts` —
      ensure `GOLD_PURITY_OPTIONS` and `FINENESS_OPTIONS` align with DB enum
      values (research confirms current values are correct)
- [ ] T004 [P] Extract reusable `Tooltip` component from
      `apps/mobile/components/edit-account/ReadOnlyDropdown.tsx` into
      `apps/mobile/components/ui/Tooltip.tsx` — animated fade in/out,
      auto-dismiss timeout, dark card bg + arrow, configurable
      text/position/alignment, dark/light theme support. Then refactor
      `ReadOnlyDropdown` to use the new `Tooltip`
- [ ] T004b [P] Create reusable `Skeleton` shimmer primitive in
      `apps/mobile/components/ui/Skeleton.tsx` — accepts `width`, `height`,
      `borderRadius` props, animated shimmer effect, dark/light theme support.
      Establishes the pattern for skeleton loading across the app (FR-025)

---

## Phase 3: Foundational Data Layer (⚠️ BLOCKS all user stories)

**Purpose**: Service + hook that ALL UI phases depend on

- [ ] T005 [P] Create `CreateMetalHoldingData` interface and
      `createMetalHolding()` service in
      `apps/mobile/services/metal-holding-service.ts` — atomic
      `database.write()` creating both `Asset` (type=METAL) and `AssetMetal`
      records, following `transaction-service.ts` pattern
- [ ] T006 [P] Create `useMetalHoldings` hook in
      `apps/mobile/hooks/useMetalHoldings.ts` — observe `assets` (type=METAL,
      deleted=false) with `asset_metals`, group by metal_type, compute
      per-holding current value + profit/loss % + aggregates using
      `@astik/logic` utilities. **Sort**: purchase date descending — newest
      first (FR-024). **Duplicates**: no name uniqueness constraint. Returns:
      `goldHoldings`, `silverHoldings`, `totalValue`, `totalPurchasePrice`,
      `profitLoss`, `portfolioSplit`, `isLoading`

**Checkpoint**: Data layer ready — holdings can be read reactively and new
holdings can be created

---

## Phase 4: User Story 1 — View Total Metals Portfolio Value (Priority: P1) 🎯 MVP

**Goal**: User sees total portfolio value, USD equivalent, and profit/loss with
info tooltip on the My Metals screen

**Independent Test**: Open My Metals → verify total value shows real data, USD
equivalent renders (or hidden if currency is USD), and profit/loss pill with
tooltip works

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create `EmptyMetalsState` component in
      `apps/mobile/components/metals/EmptyMetalsState.tsx` — empty state with
      **generated illustration** (gold/silver themed artwork via
      `generate_image`) + "Add Your First Holding" prompt, dark/light theme
      support
- [ ] T008 [US1] Create `MetalsHeroCard` component in
      `apps/mobile/components/metals/MetalsHeroCard.tsx` — total portfolio value
      in preferred currency, conditional USD equivalent (hidden if USD),
      profit/loss pill with reusable `Tooltip` from `components/ui/Tooltip.tsx`
      (FR-004, FR-005, FR-006, FR-007), dark/light theme support

**Checkpoint**: Hero card renders real portfolio data with profit tooltip

---

## Phase 5: User Story 2 — View Individual Metal Holdings by Type (Priority: P1)

**Goal**: User can switch between Gold/Silver tabs and see individual holding
cards for each metal type

**Independent Test**: Create gold + silver holdings → switch tabs → verify
correct holdings appear per tab with all card data (name, purity, weight, value,
date, P/L%)

### Implementation for User Story 2

- [ ] T009 [P] [US2] Create `MetalTabs` component in
      `apps/mobile/components/metals/MetalTabs.tsx` — Gold/Silver tab switcher
      (Mockup 3 Jewel Collection style) with item count + total per tab,
      dark/light theme support (FR-009)
- [ ] T010 [P] [US2] Create `HoldingCard` component in
      `apps/mobile/components/metals/HoldingCard.tsx` — individual holding card
      showing name, item form icon (handle null `item_form` by omitting icon),
      purity badge (via `formatPurityForDisplay()`), weight, current value,
      purchase date, profit/loss % with green/red coloring (FR-010), dark/light
      theme support

**Checkpoint**: Tab switching filters holdings correctly; cards show all
required data

---

## Phase 6: User Story 3 — Portfolio Breakdown by Metal Type (Priority: P2)

**Goal**: When user holds both gold and silver, two summary cards show the
portfolio split (hidden if single metal type)

**Independent Test**: Create only gold holdings → verify split cards hidden. Add
silver → verify both cards appear with correct percentages and item counts

### Implementation for User Story 3

- [ ] T011 [US3] Create `MetalSplitCards` component in
      `apps/mobile/components/metals/MetalSplitCards.tsx` — two horizontal
      summary cards (Gold/Silver) showing metal name, total value, percentage of
      portfolio, item count. Conditionally hidden when only one metal type held
      (FR-008), dark/light theme support

**Checkpoint**: Split cards appear/hide correctly based on held metal types

---

## Phase 7: User Story 4 — View Live Market Rates (Priority: P2)

**Goal**: User sees current live gold and silver prices per gram at the bottom
of the scrollable content

**Independent Test**: Scroll to bottom → verify gold and silver prices per gram
render with directional arrows matching `useMarketRates` data

### Implementation for User Story 4

- [ ] T012 [US4] Create `LiveRatesStrip` component in
      `apps/mobile/components/metals/LiveRatesStrip.tsx` — inline strip showing
      gold + silver prices per gram using `useMarketRates` hook's `latestRates`
      and `previousDayRate` for directional arrows (FR-011). Show "Rates
      unavailable" when no data. dark/light theme support

**Checkpoint**: Live rates strip shows accurate per-gram prices with up/down
arrows

---

## Phase 8: User Story 5 — Add New Metal Holding (Priority: P2)

**Goal**: User can add holdings via redesigned bottom-sheet modal with
conditional tab visibility based on entry point

**Independent Test**: Tap "+ Add Gold Holding" → verify title "New Gold
Holding" + no toggle. Tap header ⊕ → verify title "New Holding" + toggle
visible. Fill all fields → save → verify holding appears

### Implementation for User Story 5

- [ ] T013 [US5] Create `AddHoldingModal` component in
      `apps/mobile/components/metals/AddHoldingModal.tsx` — Gold-themed Premium
      bottom sheet with:
  - `showMetalToggle` prop (false from per-section button, true from header ⊕)
  - Dynamic title ("New Gold/Silver Holding" or "New Holding") per entry point
    (FR-020)
  - Fields: name, item form pills (Coin/Bar/Jewelry), purity pills using
    `GOLD_PURITY_OPTIONS`/`FINENESS_OPTIONS` (from DB enums as SSOT), weight,
    purchase price, date, notes
  - Live valuation preview row (FR-021)
  - Form validation — all required fields enforced (FR-017)
  - "Add to Savings" save button label
  - Calls `createMetalHolding()` on save
  - **Error handling**: On save failure, keep modal open with form data intact +
    show inline error toast at bottom with "Retry" option (FR-026). No duplicate
    name validation needed.
  - Gold accent colors from `palette.gold` in `colors.ts` — add new colors if
    needed
  - Full dark/light theme support (FR-022)

**Checkpoint**: Modal opens with correct tab visibility per entry point; save
creates holding that appears in correct tab

---

## Phase 9: User Story 6 — Page Assembly + Theme Support (Priority: P1)

**Goal**: Assemble all components into the final metals.tsx page with full
dark/light theme compatibility

**Independent Test**: Toggle device theme → verify all elements (page + modal)
render correctly in both modes. Verify all sections appear in correct order.

### Implementation for User Story 6

- [ ] T014 [US6] Update barrel export in
      `apps/mobile/components/metals/index.ts` with all component exports
- [ ] T015 [US6] Rewrite `apps/mobile/app/(tabs)/metals.tsx` — complete rewrite
      composing:
  - `PageHeader` with `rightAction` for green ⊕ button (FR-019)
  - `MetalsHeroCard` (or `EmptyMetalsState` if no holdings)
  - `MetalSplitCards` (conditional)
  - `MetalTabs` with active tab state
  - `FlatList<HoldingCard>` filtered by active tab
  - `AddSectionButton` per tab ("+ Add Gold/Silver Holding")
  - `LiveRatesStrip` at scroll bottom
  - `AddHoldingModal` with `modalConfig: { showToggle, preSelectedMetal }` state
  - **Skeleton loading**: When `isLoading` from `useMetalHoldings`, show
    skeleton shimmer placeholders composed from `Skeleton` primitives matching
    the page layout (FR-025)
  - Remove all hardcoded placeholder data

**Checkpoint**: Full page renders with real data, all sections visible, both
themes work correctly

---

## Phase 10: Polish & Cross-Cutting

**Purpose**: Final cleanup, performance, and verification

- [ ] T016 Review all components for NativeWind dark: variant completeness — no
      `isDark` ternaries in className props (Constitution V exception: `isDark`
      allowed only for icon/component color props)
- [ ] T017 Verify `FlatList` usage with `keyExtractor`, `removeClippedSubviews`,
      and `maxToRenderPerBatch` for performance optimization
- [ ] T018 Run TypeScript compilation check — `npx nx typecheck mobile` — ensure
      no type errors
- [ ] T019 Run `npm run db:push` to apply purity enum migration, then
      `npm run db:migrate` to regenerate WatermelonDB schema
- [ ] T020 Manual verification on device — run through all 5 verification test
      flows from plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — immediate
- **Schema (Phase 2)**: Depends on Phase 1 for T004 only; T002, T003 are
  independent
- **Foundational (Phase 3)**: Depends on Phase 2 — BLOCKS all user stories
- **US1 (Phase 4)**: Depends on Phase 3 + T004 (Tooltip)
- **US2 (Phase 5)**: Depends on Phase 3
- **US3 (Phase 6)**: Depends on Phase 3
- **US4 (Phase 7)**: Depends on Phase 3
- **US5 (Phase 8)**: Depends on Phase 3
- **US6 (Phase 9)**: Depends on ALL previous phases (assembly)
- **Polish (Phase 10)**: Depends on Phase 9

### Parallel Opportunities

```text
# Phase 2 (all can run in parallel):
T002 (purity enums) ∥ T003 (verify purity-utils) ∥ T004 (Tooltip extraction)

# Phase 3 (can run in parallel):
T005 (service) ∥ T006 (hook)

# After Phase 3, these can ALL run in parallel:
T007 + T008  (US1: Empty state + Hero card)
T009 + T010  (US2: Tabs + Cards)
T011         (US3: Split cards)
T012         (US4: Live rates)
T013         (US5: Add modal)
```

---

## Summary

| Metric                      | Value                                             |
| --------------------------- | ------------------------------------------------- |
| **Total tasks**             | 21                                                |
| **Setup**                   | 1 task                                            |
| **Schema & Infrastructure** | 4 tasks (enums, purity verify, Tooltip, Skeleton) |
| **Foundational**            | 2 tasks (service + hook)                          |
| **US1 (Hero)**              | 2 tasks                                           |
| **US2 (Holdings)**          | 2 tasks                                           |
| **US3 (Split)**             | 1 task                                            |
| **US4 (Rates)**             | 1 task                                            |
| **US5 (Modal)**             | 1 task                                            |
| **US6 (Assembly)**          | 2 tasks                                           |
| **Polish**                  | 5 tasks                                           |
| **Parallelizable**          | 8 tasks marked [P]                                |
| **MVP scope**               | Phase 1–5 (US1 + US2 = 11 tasks)                  |
