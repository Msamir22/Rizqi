# Implementation Plan: Stats Page Refactor

**Branch**: `003-refactor-stats-page` | **Date**: 2026-02-15 | **Spec**:
[spec.md](file:///E:/Work/My%20Projects/Monyvi/specs/003-refactor-stats-page/spec.md)

## Summary

Extract inline components from `stats.tsx` and `CategoryDrilldownCard.tsx` into
dedicated files, replace all `isDark` ternaries with Tailwind `dark:` variants
(except chart library props), and replace hardcoded `"EGP"` strings with a
`DEFAULT_DISPLAY_CURRENCY` constant and TODO for multi-currency aggregation.

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React Native, Expo, NativeWind v4,
react-native-gifted-charts  
**Storage**: WatermelonDB (local-first)  
**Target Platform**: Android / iOS (Expo managed)  
**Project Type**: Mobile (Nx monorepo)

## Constitution Check

| Gate                                                | Status   | Notes                                                                                 |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| V. Premium UI — no `isDark` ternary in className    | ✗ FAIL   | 11 violations in `CategoryDrilldownCard.tsx`, 0 in `stats.tsx` (already uses `dark:`) |
| V. Premium UI — no hardcoded hex in JSX             | ✓ PASS   | Uses `palette.*` constants                                                            |
| III. Type Safety — no `any`                         | ✓ PASS   |                                                                                       |
| IV. Service-Layer — no business logic in components | ✓ PASS\* | Aggregation logic is view-model computation, acceptable in component                  |
| Dev Workflow — no magic numbers                     | ✗ FAIL   | `"EGP"` hardcoded in 5 places                                                         |

Re-check after implementation: All gates expected to pass.

## Proposed Changes

### Component Extraction

#### [NEW] `components/stats/MonthlyExpenseChart.tsx`

- Move `MonthlyExpenseChart` from `stats.tsx` (lines 34-181) to its own file
- No API changes — self-contained component with own hooks

#### [NEW] `components/stats/QuickStats.tsx`

- Move `QuickStats` from `stats.tsx` (lines 184-252) to its own file
- No API changes — self-contained component with own hooks

#### [NEW] `components/stats/drilldown/DrilldownBreadcrumbs.tsx`

- Move `Breadcrumbs` from `CategoryDrilldownCard.tsx` (lines 72-118)
- Fix `isDark` ternaries → `dark:` variants
- Keep chevron icon `isDark` (prop-based color — constitution exception)

#### [NEW] `components/stats/drilldown/DrilldownCategoryItem.tsx`

- Move `CategoryListItem` from `CategoryDrilldownCard.tsx` (lines 120-173)
- Fix `isDark` ternaries → `dark:` variants
- Keep chevron icon `isDark` (constitution exception)

#### [NEW] `components/stats/drilldown/types.ts`

- Move `CategoryData`, `BreadcrumbItem` interfaces
- Move `CHART_COLORS` constant

#### [MODIFY] `app/(tabs)/stats.tsx`

- Import extracted components, remove inline definitions
- Target: ~25 lines (composition only)

#### [MODIFY] `components/stats/CategoryDrilldownCard.tsx`

- Import extracted sub-components and types
- Fix remaining `isDark` ternaries in main component
- Replace hardcoded `"EGP"` → `DEFAULT_DISPLAY_CURRENCY`
- Keep `getYearMonthBoundaries` inline (also exists in `@monyvi/logic`)
- Target: ~200 lines

### Currency Fix

Replace all `currency: "EGP"` with `DEFAULT_DISPLAY_CURRENCY` constant.

> [!IMPORTANT] Multi-currency aggregation (converting amounts to a common
> display currency) requires market rates integration and is **out of scope**
> for this refactor. A `// TODO:` comment will be added per constitution rules.

## Verification Plan

### Automated

- `npx eslint` on all modified files — 0 errors expected
- `grep -rn 'isDark' components/stats/` — only in chart library prop contexts
  expected
- `grep -rn '"EGP"' components/stats/ app/(tabs)/stats.tsx` — 0 results expected

### Manual

- Open Stats tab on Android emulator, verify visual parity
- Toggle dark mode, verify correct theming
- Tap category drill-down, verify breadcrumb navigation works
