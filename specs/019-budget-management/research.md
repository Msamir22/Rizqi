# Research: Budget Management UI

**Branch**: `019-budget-management` | **Date**: 2026-03-19

## Decisions

### 1. Navigation Pattern — Budget Screen Placement

- **Decision**: Budgets are accessible from the app drawer (already configured
  in `AppDrawer.tsx` under the MANAGEMENT section with route `/budgets`). The
  `budgets.tsx` route is a standalone page, not a bottom tab.
- **Rationale**: The bottom tab navigator is already full. The drawer already
  has a Budgets entry at route `/budgets`, so no drawer changes are needed —
  only the route file must be created.
- **Alternatives considered**:
  - New bottom tab → rejected by user (no space in tab bar)
  - Nested under Stats tab → rejected because budgets need their own CRUD flow

### 2. Budget Detail & Form Navigation

- **Decision**: Use Expo Router file-based routes: `app/budget-detail.tsx` and
  `app/create-budget.tsx` (reused for edit)
- **Rationale**: Follows existing patterns (`add-transaction.tsx`,
  `edit-transaction.tsx`, `create-recurring-payment.tsx`). Route params pass the
  budget ID for detail/edit.
- **Alternatives considered**:
  - Bottom sheet for form → rejected because the form has too many fields for a
    sheet
  - Modal route → rejected because existing forms use full-screen routes

### 3. Actions Bottom Sheet — Implementation Approach

- **Decision**: Use a custom modal component (similar to existing patterns)
  instead of `@gorhom/bottom-sheet`
- **Rationale**: The project does not currently use `@gorhom/bottom-sheet`.
  Existing modals use React Native's `Modal` or custom view overlays. Adding a
  new dependency for one use case is not justified.
- **Alternatives considered**:
  - Install `@gorhom/bottom-sheet` → rejected to avoid new dependency
  - `ActionSheetIOS` → rejected, Android incompatible

### 4. Spending Aggregation — Query Strategy

- **Decision**: Use WatermelonDB queries to aggregate spending by category +
  date range on-device
- **Rationale**: Offline-first (Constitution Principle I). Aggregation is a sum
  of EXPENSE transactions filtered by `category_id` (including subcategories)
  and `date` within the budget's current period boundaries.
- **Alternatives considered**:
  - Server-side aggregation → rejected, violates offline-first principle
  - Pre-computed spending column on budgets table → rejected, stale data risk

### 5. Alert Trigger Mechanism

- **Decision**: Check budget thresholds in the `createTransaction` flow
  (post-creation callback)
- **Rationale**: FR-011 specifies alerts trigger only after transaction
  creation. The service layer can check affected budgets after a write and
  return alert metadata to the UI layer.
- **Alternatives considered**:
  - Background observer → over-complex, reactive queries would fire on every DB
    change
  - Navigation-time check → explicitly excluded by spec clarification Q2

### 6. Circular Progress Ring — Component Approach

- **Decision**: Use `react-native-svg` for custom circular progress ring
  component
- **Rationale**: The project already uses `react-native-svg` (dependency of
  `react-native-gifted-charts`). A custom `CircularProgress` component gives
  full control over color thresholds, animations, and the inner percentage text.
- **Alternatives considered**:
  - `react-native-circular-progress` package → new dependency, less control
  - Simple View-based approach → no curved progress rendering possible

### 7. Date Range Picker — Implementation

- **Decision**: Build a custom calendar bottom sheet using existing date
  utilities
- **Rationale**: The custom period picker needs specific features (quick
  presets, dual date inputs, calendar grid) that off-the-shelf pickers don't
  provide in the required design style.
- **Alternatives considered**:
  - `react-native-calendars` → would need heavy customization to match dark
    theme
  - Expo DateTimePicker → only single date, not ranges

### 8. Chart Library for Spending Trend

- **Decision**: Reuse `react-native-gifted-charts` (BarChart) already installed
- **Rationale**: Proven in `MonthlyExpenseChart.tsx`. Same bar chart pattern
  fits the weekly spending trend visualization. Avoids new dependencies.
- **Alternatives considered**: None — clear reuse case.
