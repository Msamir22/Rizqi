# Tasks: Stats Page Refactor

**Branch**: `003-refactor-stats-page`  
**Plan**: [plan.md](file:///E:/Work/My%20Projects/Monyvi/specs/003-refactor-stats-page/plan.md)

## Phase 1: Extract Types and Constants

- [ ] **T1**: Create `components/stats/drilldown/types.ts` — move
      `CategoryData`, `BreadcrumbItem`, `CHART_COLORS`,
      `DEFAULT_DISPLAY_CURRENCY`

## Phase 2: Extract Sub-Components

- [ ] **T2**: Create `components/stats/drilldown/DrilldownBreadcrumbs.tsx` —
      extract from `CategoryDrilldownCard.tsx`, fix `isDark` ternaries
- [ ] **T3**: Create `components/stats/drilldown/DrilldownCategoryItem.tsx` —
      extract from `CategoryDrilldownCard.tsx`, fix `isDark` ternaries, fix
      `"EGP"` → constant
- [ ] **T4**: Create `components/stats/drilldown/index.ts` — barrel export

## Phase 3: Refactor CategoryDrilldownCard

- [ ] **T5**: Rewrite `CategoryDrilldownCard.tsx` — import extracted components,
      fix `isDark` ternaries, fix `"EGP"` → constant

## Phase 4: Extract Stats Screen Components

- [ ] **T6**: Create `components/stats/MonthlyExpenseChart.tsx` — extract from
      `stats.tsx`, fix `"EGP"` → constant
- [ ] **T7**: Create `components/stats/QuickStats.tsx` — extract from
      `stats.tsx`, fix `"EGP"` → constant

## Phase 5: Simplify Stats Screen

- [ ] **T8**: Rewrite `app/(tabs)/stats.tsx` — import extracted components,
      composition only

## Phase 6: Verification

- [ ] **T9**: Run ESLint on all modified/new files
- [ ] **T10**: Grep for remaining `isDark` ternaries and `"EGP"` hardcodes
