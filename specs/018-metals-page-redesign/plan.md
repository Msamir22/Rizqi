# Implementation Plan: Metals Page Redesign

**Branch**: `018-metals-page-redesign` | **Date**: 2026-03-18 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/018-metals-page-redesign/spec.md)
**Input**: Feature specification from `/specs/018-metals-page-redesign/spec.md`

### Out of Scope

- **Edit/delete holdings** — tracked in separate GitHub issues
- **Platinum support** — architecture must be extensible, but not implemented

## Summary

Redesign the "My Metals" screen (`metals.tsx`) to replace all hardcoded
placeholders with real data from WatermelonDB (`assets` + `asset_metals`
tables), add portfolio analytics (profit/loss, metal split), implement a premium
add-holding modal with conditional tab visibility, and ensure full dark/light
theme support. Leverages existing `@astik/logic` calculations and `@astik/db`
models.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) **Primary Dependencies**:
React Native + Expo (managed), NativeWind v4, WatermelonDB, React Navigation
(Expo Router) **Storage**: WatermelonDB (local SQLite) synced to Supabase
PostgreSQL **Testing**: Jest + @testing-library/react-native (existing pattern
in `apps/mobile/__tests__/`) **Target Platform**: Android + iOS via Expo
**Project Type**: Mobile (Nx monorepo) **Performance Goals**: < 1s load time for
holdings list, instant tab switching **Constraints**: Offline-first; all
reads/writes via WatermelonDB; no direct API calls for data

## Constitution Check

_GATE: All 7 principles verified._

| #   | Principle                   | Status  | Notes                                                                                            |
| --- | --------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| I   | Offline-First Data          | ✅ PASS | All reads from WatermelonDB. No API calls for holdings data.                                     |
| II  | Documented Business Logic   | ✅ PASS | Profit/loss formula documented in spec. No new business rules needed.                            |
| III | Type Safety                 | ✅ PASS | All new code will use strict types. No `any`. Explicit return types.                             |
| IV  | Service-Layer Separation    | ✅ PASS | New `metal-holding-service.ts` for DB writes. Hook for observation only. Components render only. |
| V   | Premium UI with Theming     | ✅ PASS | NativeWind dark: variants. Schema-driven UI. No hardcoded hex in JSX.                            |
| VI  | Monorepo Package Boundaries | ✅ PASS | Logic stays in `@astik/logic`, service in `apps/mobile/services/`, hook in `apps/mobile/hooks/`. |
| VII | Local-First Migrations      | ✅ PASS | New migration for gold/silver purity enums.                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/018-metals-page-redesign/
├── plan.md              # This file
├── spec.md              # Approved feature specification
├── research.md          # Research findings (not needed — all patterns already clear)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Existing files to MODIFY
apps/mobile/app/(tabs)/metals.tsx                  # Complete rewrite of metals page
apps/mobile/constants/colors.ts                    # Add gold/silver accent colors if needed
packages/logic/src/utils/purity-utils.ts           # Update to use DB purity enums as SSOT
apps/mobile/components/edit-account/ReadOnlyDropdown.tsx  # Refactor to use new reusable Tooltip

# NEW files — Data Layer
supabase/migrations/024_gold_silver_purity_enums.sql  # DB enums for gold karat + silver fineness
apps/mobile/services/metal-holding-service.ts      # DB write operations for metal holdings
apps/mobile/hooks/useMetalHoldings.ts              # Reactive hook for metal holdings data

# NEW files — UI Components
apps/mobile/components/ui/Tooltip.tsx              # Reusable tooltip (extracted from ReadOnlyDropdown)
apps/mobile/components/ui/Skeleton.tsx             # Reusable shimmer skeleton primitive (width, height, borderRadius)
apps/mobile/components/metals/MetalsHeroCard.tsx    # Total portfolio value + profit/loss
apps/mobile/components/metals/MetalSplitCards.tsx   # Gold/Silver portfolio breakdown
apps/mobile/components/metals/MetalTabs.tsx         # Gold/Silver tab switcher
apps/mobile/components/metals/HoldingCard.tsx       # Individual holding card
apps/mobile/components/metals/LiveRatesStrip.tsx    # Live market rates strip
apps/mobile/components/metals/AddHoldingModal.tsx   # Redesigned add holding bottom sheet
apps/mobile/components/metals/EmptyMetalsState.tsx  # Empty state with generated illustration
apps/mobile/components/metals/index.ts              # Barrel export

# Existing files reused (NO changes needed)
packages/logic/src/assets/assets-calculations.ts   # calculateTotalAssets()
packages/logic/src/utils/metal.ts                  # getMetalPrice(), getMetalPriceUsd()
packages/db/src/models/Asset.ts                    # Asset model
packages/db/src/models/AssetMetal.ts               # AssetMetal model with calculateValue()
apps/mobile/hooks/useMarketRates.ts                # Market rates hook
apps/mobile/hooks/usePreferredCurrency.ts          # Preferred currency hook
apps/mobile/components/navigation/PageHeader.tsx   # Supports rightAction prop for + button
```

**Structure Decision**: Mobile app pattern — new components in feature-specific
`components/metals/` directory. Service in `services/`. Hook in `hooks/`. All
logic reuses existing `@astik/logic` functions.

---

## Proposed Changes

### Phase 0: Schema & Foundation

---

#### [NEW] [024_gold_silver_purity_enums.sql](file:///e:/Work/My%20Projects/Astik/supabase/migrations/024_gold_silver_purity_enums.sql)

Create two Postgres enums as single source of truth for purity options:

- `gold_karat_enum`: 24, 22, 21, 18, 14, 10 (all industry-standard karats)
- `silver_fineness_enum`: 999, 950, 925, 900, 850, 800 (all industry-standard
  fineness values)

Research confirmed these are correct:

- **Gold**: 24K (99.9%), 22K (91.7%), 21K (87.5%), 18K (75%), 14K (58.3%), 10K
  (41.7%) — all widely used globally
- **Silver**: 999 (Fine), 950 (French 1st Standard), 925 (Sterling), 900 (Coin),
  850 (European), 800 (Continental)

These enums serve as the authoritative reference for purity dropdowns in the UI.

#### [MODIFY] [purity-utils.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/purity-utils.ts)

Update `GOLD_PURITY_OPTIONS` and `FINENESS_OPTIONS` to align with the DB enum
values (verify current values match — they already do based on research).

---

### Phase 1: Data Layer (Service + Hook)

---

#### [NEW] [Tooltip.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/ui/Tooltip.tsx)

Extract the existing tooltip logic from `ReadOnlyDropdown.tsx` into a reusable
`Tooltip` component:

- Animated fade in/out via `Animated.Value` (200ms duration)
- Auto-dismiss after configurable timeout (default 3s)
- Dark card background with arrow pointer
- Configurable `text`, `position` (top/bottom), and `arrowAlignment`
  (left/center/right)
- Dark/light theme support
- Then refactor `ReadOnlyDropdown` to use the new `Tooltip` component

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Extract & Reuse (DRY)
> - **Why**: The same tooltip pattern is needed in both `ReadOnlyDropdown` and
>   `MetalsHeroCard`. Extracting avoids duplicating animation and positioning
>   logic.
> - **SOLID Check**: Single Responsibility — tooltip handles only display +
>   animation.

---

#### [NEW] [metal-holding-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/metal-holding-service.ts)

Service for creating metal holdings. Follows the existing
`transaction-service.ts` pattern:

- `createMetalHolding(data)` → atomic `database.write()` that creates both
  `Asset` (type=METAL) and `AssetMetal` in a single batch
- Input interface: `CreateMetalHoldingData` with all required/optional fields
  matching the schema
- Gets `userId` from `getCurrentUserId()`

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Service-Layer Separation (Constitution IV)
> - **Why**: DB write logic must not live in hooks or components. Follows the
>   established `transaction-service.ts` pattern exactly.
> - **SOLID Check**: Single Responsibility — service handles only DB operations.

---

#### [NEW] [useMetalHoldings.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useMetalHoldings.ts)

Reactive hook that observes metal holdings from WatermelonDB. Follows the
`useAssetBreakdown.ts` pattern:

- Queries `assets` (where `type=METAL`, `deleted=false`) joined with
  `asset_metals`
- Groups holdings by `metal_type` (GOLD / SILVER)
- Computes per-holding current value, profit/loss %, and aggregates using
  `@astik/logic` utilities
- Returns:
  `{ goldHoldings, silverHoldings, totalValue, totalPurchasePrice, profitLoss, portfolioSplit, isLoading }`
- **Sort order**: Holdings sorted by purchase date descending — newest first
  (FR-024)
- **Duplicate names**: No uniqueness constraint on holding names — duplicates
  allowed

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Observer pattern via WatermelonDB's `observe()` + React
>   state
> - **Why**: Consistent with all existing hooks (`useAssetBreakdown`,
>   `useMarketRates`). Data updates reactively when DB changes.
> - **SOLID Check**: Open/Closed — hook returns processed data; components don't
>   know about DB internals.

---

### Phase 2: UI Components

---

#### [NEW] [MetalsHeroCard.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/MetalsHeroCard.tsx)

Total portfolio value card. Shows:

- Total metals value in preferred currency
- USD equivalent (hidden if preferred currency is USD — FR-006)
- Profit/loss pill with percentage + custom tooltip (FR-007)

---

#### [NEW] [MetalSplitCards.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/MetalSplitCards.tsx)

Two side-by-side summary cards showing Gold and Silver portfolio split. Hidden
when user holds only one metal type (FR-008).

---

#### [NEW] [MetalTabs.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/MetalTabs.tsx)

Gold/Silver tab switcher following Mockup 3 (Jewel Collection) style. Shows item
count + total per tab.

---

#### [NEW] [HoldingCard.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/HoldingCard.tsx)

Individual holding card showing: name, item form, purity badge (using
`formatPurityForDisplay()`), weight, current value, purchase date, profit/loss %
(FR-010).

---

#### [NEW] [LiveRatesStrip.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/LiveRatesStrip.tsx)

Inline market rates strip at bottom of scroll. Gold + Silver prices per gram.
Uses `useMarketRates` hook's `latestRates` and `previousDayRate` for directional
arrows (FR-011).

---

#### [NEW] [AddHoldingModal.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/AddHoldingModal.tsx)

Redesigned bottom sheet modal (Gold-themed Premium style). Key features:

- **Conditional toggle**: `showMetalToggle` prop — hidden when opened from
  per-section button, shown when opened from header ⊕ (FR-019, FR-020)
- **Dynamic title**: "New Gold Holding" / "New Silver Holding" / "New Holding"
  based on entry point
- **Fields**: name, item form pills (Coin/Bar/Jewelry), purity pills (using
  `GOLD_PURITY_OPTIONS` / `FINENESS_OPTIONS` from DB enums as SSOT), weight,
  purchase price, date, notes
- **Live valuation preview**: Real-time calculation using entered weight ×
  purity × live rate (FR-021)
- **Validation**: All required fields enforced; save disabled until valid
  (FR-017)
- **Save button**: "Add to Savings" label
- **Calls**: `createMetalHolding()` from service layer on save
- **Error handling**: On save failure, keep modal open with form data intact +
  show inline error toast at bottom with "Retry" option (FR-026). No duplicate
  name validation needed.
- **Theme**: Full dark/light support (FR-022). Gold accent colors from
  `palette.gold` in `colors.ts` — new colors may be added to `colors.ts` if
  needed, as long as they fit the existing theme.

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Strategy pattern for modal behavior — entry point
>   determines toggle visibility and title via props, not internal state
> - **Why**: Single modal component with configurable behavior avoids code
>   duplication. The entry point acts as a configuration strategy.
> - **SOLID Check**: Open/Closed — new entry points can be added by passing
>   different props without modifying the modal.

---

#### Profit Tooltip (in MetalsHeroCard)

Uses the new reusable `Tooltip` component from `components/ui/Tooltip.tsx`
(extracted from ReadOnlyDropdown). Appears on tap of info icon next to profit
value. Explains how profit is calculated (FR-007). No separate
`ProfitTooltip.tsx` file needed — the `Tooltip` component is generic.

---

#### [NEW] [EmptyMetalsState.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/metals/EmptyMetalsState.tsx)

Empty state when user has no holdings. Uses a **generated illustration** (via
`generate_image` tool) showing precious metals/gold/silver themed artwork.
Includes "Add Your First Holding" prompt button (FR-014). This establishes the
pattern for illustrated empty states across the app.

---

#### [NEW] [Skeleton.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/ui/Skeleton.tsx)

Reusable shimmer skeleton primitive component for loading states:

- Accepts `width`, `height`, `borderRadius` props for flexible layout
  composition
- Animated shimmer effect via `Animated.Value` or `react-native-reanimated`
- Dark/light theme support (different shimmer base colors per theme)
- Each page composes page-specific skeleton layouts from these primitives (e.g.,
  `MetalsPageSkeleton` in `metals.tsx` uses multiple `Skeleton` blocks to match
  the hero card + holding card shapes)
- Establishes the pattern for skeleton loading across the app (FR-025)

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Composable Primitive (Atomic Design)
> - **Why**: A single `Skeleton` primitive can be composed into any
>   page-specific loading layout. Avoids duplicating animation/shimmer logic per
>   page.
> - **SOLID Check**: Single Responsibility — renders only a shimmer block.
>   Open/Closed — new layouts composed without modifying the primitive.

---

### Phase 3: Page Assembly

---

#### [MODIFY] [metals.tsx](<file:///e:/Work/My%20Projects/Astik/apps/mobile/app/(tabs)/metals.tsx>)

Complete rewrite of the metals page. The existing 380-line file with hardcoded
data will be replaced with:

- `PageHeader` with `rightAction` prop for the green ⊕ plus button (FR-019)
- `MetalsHeroCard` for portfolio summary
- `MetalSplitCards` for Gold/Silver breakdown (conditional)
- `MetalTabs` for tab switching
- `FlatList` of `HoldingCard` items (filtered by active tab)
- `AddSectionButton` per tab for per-section add ("+ Add Gold Holding")
- `LiveRatesStrip` at scroll bottom
- `AddHoldingModal` with entry-point-aware props
- **Skeleton loading state**: When `isLoading` is true from `useMetalHoldings`,
  show skeleton shimmer placeholders composed from `Skeleton` primitives
  matching the page layout (FR-025)
- State management: `activeTab`, `modalVisible`, `modalConfig` (toggle
  visibility + pre-selected metal)

---

## Verification Plan

### Unit Tests

#### 1. `metal-holding-service.test.ts`

- **File**: `apps/mobile/__tests__/services/metal-holding-service.test.ts`
- **Covers**: `createMetalHolding()` — verifies both Asset and AssetMetal
  records are created atomically with correct field values
- **Run**: `npx nx test mobile -- --testPathPattern="metal-holding-service"`

#### 2. Existing logic tests

- **Covers**: `calculateTotalAssets()`, purity utils, metal price utils —
  already tested via `@astik/logic` if tests exist
- **Run**: `npx nx test logic` (to verify no regressions)

### Manual Verification

> [!IMPORTANT] Manual testing is critical for this feature since it involves
> complex UI interactions, theme switching, and visual polish. I'll ask you to
> test the following flows on device/emulator.

#### Test 1: Holdings Display

1. Open the app → Navigate to "My Metals" tab
2. Verify total value shows real data (not hardcoded amounts)
3. Switch between Gold and Silver tabs → verify correct holdings appear
4. Verify each card shows: name, purity badge, weight, value, date, profit/loss
   %

#### Test 2: Add Holding (per-section button)

1. On Gold tab, tap "+ Add Gold Holding"
2. Verify modal opens with title "New Gold Holding" and NO metal toggle
3. Fill all required fields → tap "Add to Savings"
4. Verify new holding appears in the Gold tab

#### Test 3: Add Holding (header + button)

1. Tap the green ⊕ button in the page header
2. Verify modal opens with title "New Holding" and metal toggle IS visible
3. Switch between Gold/Silver in the toggle → verify purity options change
4. Fill all fields → save → verify holding appears

#### Test 4: Theme Compatibility

1. Toggle device theme to light mode → verify all elements render correctly
2. Toggle to dark mode → verify all elements adapt (backgrounds, text, borders,
   modal)

#### Test 5: Edge Cases

1. With zero holdings → verify empty state appears
2. With only gold holdings → verify portfolio split cards are hidden
3. Try saving without required fields → verify validation errors
4. Simulate save failure → verify modal stays open with inline error toast and
   retry option
5. Open page → verify skeleton shimmer shows briefly before data loads

## Complexity Tracking

No constitution violations — no complexity justification needed.
