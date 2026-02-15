# Implementation Plan: Refactor Upcoming Payments

**Branch**: `002-refactor-upcoming-payments` | **Date**: 2026-02-14 | **Spec**:
[spec.md](file:///E:/Work/My%20Projects/Astik/specs/002-refactor-upcoming-payments/spec.md)
**Input**: Feature specification from
`specs/002-refactor-upcoming-payments/spec.md`

## Summary

Refactor the `UpcomingPayments.tsx` component (559 lines) to comply with all
project rules in `.agent/rules/`. Extract business logic to `dateHelpers.ts` and
`recurring-payment-service.ts`, split sub-components into a dedicated
`upcoming-payments/` subdirectory, fix light/dark mode support, replace raw
`TextInput` with `TextField`, and remove dead code.

## Technical Context

**Language/Version**: TypeScript (strict mode) **Primary Dependencies**: React
Native, Expo, NativeWind v4, WatermelonDB, `@astik/db`, `@astik/logic`
**Storage**: WatermelonDB (local SQLite), Supabase (cloud sync) **Testing**:
Manual visual verification (light/dark mode toggle), ESLint **Target Platform**:
Android/iOS via Expo **Project Type**: Mobile (monorepo) **Performance Goals**:
60fps scrolling, <3s Pay Now completion **Constraints**: Offline-first,
NativeWind shadow bug on interactive components **Scale/Scope**: Single
component refactoring — 1 main file → 5+ files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                                     |
| ----------------------------- | ------- | ------------------------------------------------------------------------- |
| I. Offline-First              | ✅ Pass | No changes to data flow; transactions created locally                     |
| II. Documented Business Logic | ✅ Pass | No new business rules introduced                                          |
| III. Type Safety              | ✅ Pass | All functions have explicit return types; no `any`                        |
| IV. Service-Layer Separation  | ⚠️ Fix  | Current file violates — business logic in component. Plan addresses this. |
| V. Premium UI / Theming       | ⚠️ Fix  | Hardcoded dark-only styles. Plan adds proper `dark:` variants.            |
| VI. Monorepo Boundaries       | ✅ Pass | All code stays in `apps/mobile`                                           |
| VII. Local-First Migrations   | ✅ N/A  | No schema changes                                                         |

**Post-design re-check**: Both IV and V violations are resolved by the plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-refactor-upcoming-payments/
├── spec.md              ✅ Complete
├── plan.md              ✅ This file
├── research.md          ✅ Complete
└── checklists/
    └── requirements.md  ✅ Complete
```

### Source Code Changes

```text
apps/mobile/
├── components/
│   └── dashboard/
│       ├── UpcomingPayments.tsx          # MODIFY → slim orchestrator (~100 lines)
│       └── upcoming-payments/           # NEW directory
│           ├── index.ts                 # NEW barrel export
│           ├── FeaturedPaymentCard.tsx   # NEW (extracted)
│           ├── MiniPaymentItem.tsx       # NEW (extracted)
│           ├── PayNowModal.tsx           # NEW (extracted)
│           └── types.ts                 # NEW (shared interfaces)
├── utils/
│   └── dateHelpers.ts                   # MODIFY → add calculateNextDueDate
└── services/
    └── recurring-payment-service.ts     # MODIFY → add updateNextDueDate
```

## Detailed Change Plan

### Phase 1: Extract Types (FR-004)

**File**: `components/dashboard/upcoming-payments/types.ts` [NEW]

Extract from current `UpcomingPayments.tsx`:

- `PayNowModalProps` interface (lines 40-45)
- `FeaturedPaymentCardProps` interface (lines 328-331)
- `MiniPaymentItemProps` interface (lines 381-383)
- Re-export `UpcomingPayment` from `useUpcomingPayments` for convenience

---

### Phase 2: Move Business Logic (FR-001)

**File**: `apps/mobile/utils/dateHelpers.ts` [MODIFY]

- Add `calculateNextDueDate(currentDueDate: Date, frequency: string): Date`
  (moved from component lines 51-75)
- **Key discovery**: `formatDueDate` in the component is **redundant** — the
  file already has `getDueText(date)` which has identical output. Components
  should use `getDueText` directly instead.

**File**: `apps/mobile/services/recurring-payment-service.ts` [MODIFY]

- Add
  `updateRecurringPaymentNextDueDate(paymentId: string, currentDueDate: Date, frequency: string): Promise<void>`
  (moved from component lines 77-91)
- This function does a WatermelonDB `database.write` — fits alongside existing
  `createRecurringPayment`

---

### Phase 3: Extract Sub-Components (FR-004, FR-002, FR-003)

**File**: `upcoming-payments/FeaturedPaymentCard.tsx` [NEW]

Extract from lines 333-379. Apply styling fixes:

- Replace `bg-slate-800/90` → `bg-slate-100 dark:bg-slate-800/90`
- Replace `text-white` → `text-slate-900 dark:text-white`
- Replace `border-nileGreen-600/50` → validate NativeWind shadow bug (this is a
  `View`, not `TouchableOpacity`, so it's safe)
- `FeaturedPaymentCard` receives `onPayNow` callback as prop

**File**: `upcoming-payments/MiniPaymentItem.tsx` [NEW]

Extract from lines 385-420. Apply styling fixes:

- Replace `bg-slate-800/80` → `bg-slate-100 dark:bg-slate-800/80`
- Replace `text-white` → `text-slate-900 dark:text-white`

**File**: `upcoming-payments/PayNowModal.tsx` [NEW]

Extract from lines 104-326. Apply fixes:

- Replace raw `TextInput` with `TextField` component (FR-005)
- Replace `Alert.alert` for validation with `useToast` (FR-006)
- Replace hardcoded `#FFFFFF` on `ActivityIndicator` with `palette.white` or
  `"white"` (FR-009)
- All `palette` color references in `color` props are acceptable per the
  `isDark` exception rule in constitution Principle V
- Keep `Keyboard.dismiss` via `TouchableWithoutFeedback` (FR-008)

---

### Phase 4: Create Barrel Export (FR-004)

**File**: `upcoming-payments/index.ts` [NEW]

```typescript
export { FeaturedPaymentCard } from "./FeaturedPaymentCard";
export { MiniPaymentItem } from "./MiniPaymentItem";
export { PayNowModal } from "./PayNowModal";
export type {
  PayNowModalProps,
  FeaturedPaymentCardProps,
  MiniPaymentItemProps,
} from "./types";
```

---

### Phase 5: Slim Down Main Component (FR-007, SC-004)

**File**: `UpcomingPayments.tsx` [MODIFY]

- Remove all extracted code (helper functions, sub-components, types)
- Remove commented-out `EmptyState` component (FR-007)
- Import sub-components from `./upcoming-payments`
- Import `getDueText` from `@/utils/dateHelpers` (replaces `formatDueDate`)
- Apply light/dark mode fixes to the remaining container:
  - `bg-slate-100/50 dark:bg-slate-800/50` → already correct
  - Verify all text classes have both light and dark variants
- Target: ~100-150 lines

---

### Phase 6: Final Polish & Verification

- Run ESLint to verify zero violations (SC-001)
- Visual test in both light and dark mode (SC-002)
- Test the Pay Now flow end-to-end (SC-003)
- Verify file counts and line counts (SC-004, SC-005)

## Complexity Tracking

No constitution violations need justification. All changes align with
established principles.
