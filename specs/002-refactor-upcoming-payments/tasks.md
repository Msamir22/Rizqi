# Tasks: Refactor Upcoming Payments

**Input**: Design documents from `specs/002-refactor-upcoming-payments/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: Not requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directory structure and shared types

- [x] T001 Create directory
      `apps/mobile/components/dashboard/upcoming-payments/`
- [x] T002 [P] Create shared types file in
      `apps/mobile/components/dashboard/upcoming-payments/types.ts` — extract
      `PayNowModalProps`, `FeaturedPaymentCardProps`, `MiniPaymentItemProps`
      interfaces and re-export `UpcomingPayment` from
      `@/hooks/useUpcomingPayments`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move business logic to proper layers — MUST complete before
sub-component extraction since extracted components will import from these
locations

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add
      `calculateNextDueDate(currentDueDate: Date, frequency: string): Date`
      function to `apps/mobile/utils/dateHelpers.ts` — move from
      `UpcomingPayments.tsx` lines 51-75. This is pure date math that supports
      DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY frequencies with MONTHLY as
      default fallback.
- [x] T004 [P] Add
      `updateRecurringPaymentNextDueDate(paymentId: string, currentDueDate: Date, frequency: string): Promise<void>`
      function to `apps/mobile/services/recurring-payment-service.ts` — move
      from `UpcomingPayments.tsx` lines 77-91. This function does a WatermelonDB
      `database.write` to update the `nextDueDate` field. It should import
      `calculateNextDueDate` from `@/utils/dateHelpers`.

**Checkpoint**: Business logic is now in the service/utility layer.
Sub-components can import from these locations.

---

## Phase 3: User Story 1 — Clean Code & Rule Compliance (Priority: P1) 🎯 MVP

**Goal**: Extract all sub-components into their own files, remove dead code,
enforce all `.agent/rules/` conventions.

**Independent Test**: Open refactored files and verify all agent rules are
satisfied. Run `npx nx lint mobile` and confirm zero violations on the touched
files.

### Implementation for User Story 1

- [x] T005 [P] [US1] Extract `FeaturedPaymentCard` component to
      `apps/mobile/components/dashboard/upcoming-payments/FeaturedPaymentCard.tsx`
      — move from `UpcomingPayments.tsx` lines 333-379. Import
      `FeaturedPaymentCardProps` from `./types`. Import `getPaymentIcon` from
      `@/utils/recurring-helpers`. Import `formatCurrency` from `@astik/logic`.
      Import `palette` from `@/constants/colors`. Replace `formatDueDate` calls
      with `getDueText` from `@/utils/dateHelpers` (pass `payment.nextDueDate`
      instead of `payment.daysUntilDue`).
- [x] T006 [P] [US1] Extract `MiniPaymentItem` component to
      `apps/mobile/components/dashboard/upcoming-payments/MiniPaymentItem.tsx` —
      move from `UpcomingPayments.tsx` lines 385-420. Import
      `MiniPaymentItemProps` from `./types`. Replace `formatDueDate` with
      `getDueText` from `@/utils/dateHelpers`.
- [x] T007 [P] [US1] Extract `PayNowModal` component to
      `apps/mobile/components/dashboard/upcoming-payments/PayNowModal.tsx` —
      move from `UpcomingPayments.tsx` lines 104-326. Import `PayNowModalProps`
      from `./types`. Replace raw `TextInput` with `TextField` from
      `@/components/ui/TextField` (FR-005). Replace `Alert.alert` validation
      with `useToast` from `@/components/ui/Toast` (FR-006). Replace hardcoded
      `#FFFFFF` on `ActivityIndicator` with `"white"` string literal (FR-009).
      Import `updateRecurringPaymentNextDueDate` from
      `@/services/recurring-payment-service` and `createTransaction` from
      `@/services/transaction-service`. Keep `Keyboard.dismiss` via
      `TouchableWithoutFeedback` (FR-008).
- [x] T008 [US1] Create barrel export in
      `apps/mobile/components/dashboard/upcoming-payments/index.ts` — export
      `FeaturedPaymentCard`, `MiniPaymentItem`, `PayNowModal`, and all types
      from `./types`
- [x] T009 [US1] Refactor main
      `apps/mobile/components/dashboard/UpcomingPayments.tsx` — remove all
      extracted code (helper functions, sub-components, interfaces). Remove
      commented-out `EmptyState` component (lines 422-438, FR-007). Import
      sub-components from `./upcoming-payments`. Import `getDueText` from
      `@/utils/dateHelpers` (replaces `formatDueDate`). Target: under 150 lines
      (SC-004).

**Checkpoint**: All code is properly structured, business logic separated,
sub-components extracted. ESLint should report zero violations (SC-001).

---

## Phase 4: User Story 2 — Improved Light & Dark Mode UI (Priority: P2)

**Goal**: Fix hardcoded dark-only styles so all components render correctly in
both light and dark mode.

**Independent Test**: Toggle between light and dark mode on the device. Verify
the Upcoming Bills section, Featured Payment card, Mini Payment items, and Pay
Now modal all look correct in both modes — no invisible text, no clashing
backgrounds.

### Implementation for User Story 2

- [x] T010 [P] [US2] Fix light/dark mode in
      `apps/mobile/components/dashboard/upcoming-payments/FeaturedPaymentCard.tsx`
      — replace dark-only classes: `bg-slate-800/90` →
      `bg-slate-100 dark:bg-slate-800/90`, `text-white` →
      `text-slate-900 dark:text-white`, `bg-nileGreen-800/50` →
      `bg-nileGreen-100 dark:bg-nileGreen-800/50`. Verify
      `border-2 border-nileGreen-600/50` is safe on `View` (not affected by
      NativeWind shadow bug). Ensure `shadow-lg shadow-nileGreen-500/30` is NOT
      on a `TouchableOpacity` or `Pressable` — if it is, move to inline `style`
      prop.
- [x] T011 [P] [US2] Fix light/dark mode in
      `apps/mobile/components/dashboard/upcoming-payments/MiniPaymentItem.tsx` —
      replace dark-only classes: `bg-slate-800/80` →
      `bg-slate-100 dark:bg-slate-800/80`, `text-white` →
      `text-slate-900 dark:text-white`, `bg-slate-700/50` →
      `bg-slate-200 dark:bg-slate-700/50`, `border-slate-700` →
      `border-slate-200 dark:border-slate-700`.
- [x] T012 [P] [US2] Review and verify light/dark mode in
      `apps/mobile/components/dashboard/upcoming-payments/PayNowModal.tsx` — the
      modal already uses proper `dark:` variants for most elements (bg-white
      dark:bg-slate-800, etc.). Verify no remaining hardcoded dark-only styles
      exist. Ensure all `palette` color references used in icon `color` props
      are acceptable per constitution Principle V exception.

**Checkpoint**: Upcoming Bills section renders correctly in both light and dark
mode (SC-002).

---

## Phase 5: User Story 3 — Improved Pay Now Modal UX (Priority: P3)

**Goal**: Polish the Pay Now modal interaction — consistent form components,
inline validation feedback, smooth transitions.

**Independent Test**: Tap "Pay Now" on any upcoming payment, modify the amount,
change the account, and confirm. Verify the transaction is created, next due
date updates, and a success toast appears within 3 seconds.

### Implementation for User Story 3

- [x] T013 [US3] Polish `TextField` integration in
      `apps/mobile/components/dashboard/upcoming-payments/PayNowModal.tsx` —
      ensure the `TextField` `label` prop shows "Amount (EGP)", add `error` prop
      wired to validation state (show "Please enter a valid amount" when invalid
      instead of Alert), use `keyboardType="decimal-pad"`. Ensure
      `containerStyle` aligns with the modal's spacing.
- [x] T014 [US3] Add inline validation feedback in
      `apps/mobile/components/dashboard/upcoming-payments/PayNowModal.tsx` —
      replace `Alert.alert("Invalid Amount", ...)` with an error state on the
      `TextField` component. Track validation error in local state
      (`const [amountError, setAmountError] = useState<string>("")`). Clear
      error on valid input via `onChangeText`. Show toast on successful payment
      instead of Alert.

**Checkpoint**: Pay Now flow completes successfully within 3 seconds (SC-003).
All sub-components follow Single Responsibility Principle (SC-005).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all user stories

- [x] T015 Run ESLint on all modified files using `npx nx lint mobile` — verify
      zero violations on `UpcomingPayments.tsx`, all files in
      `upcoming-payments/`, `dateHelpers.ts`, and `recurring-payment-service.ts`
      (SC-001)
- [x] T016 [P] Verify line count of main
      `apps/mobile/components/dashboard/UpcomingPayments.tsx` is under 150 lines
      (SC-004). Verify each sub-component file contains exactly one component
      (SC-005).
- [x] T017 Visual verification: toggle light/dark mode and confirm Upcoming
      Bills section looks correct in both modes (SC-002). Test Pay Now flow
      end-to-end (SC-003).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Can run in parallel with Phase 1 (T003, T004
  modify different files than T001, T002)
- **User Story 1 (Phase 3)**: Depends on Phase 1 (directory + types) and Phase 2
  (business logic moved)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (files must exist before
  applying style fixes)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (PayNowModal must be extracted
  first)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2). No dependencies on
  other stories.
- **User Story 2 (P2)**: Depends on User Story 1 (Phase 3) — needs extracted
  component files to apply style fixes.
- **User Story 3 (P3)**: Depends on User Story 1 (Phase 3) — needs extracted
  `PayNowModal.tsx` to apply UX improvements.
- **User Stories 2 and 3 can run in parallel** once User Story 1 is complete.

### Within Each User Story

- Files marked [P] can be worked on in parallel
- Barrel export (T008) depends on all extractions (T005, T006, T007) completing
- Main component refactor (T009) depends on barrel export (T008)

### Parallel Opportunities

```text
# Phase 1 + 2 can overlap:
T001 → T002 (sequential in Phase 1)
T003, T004 (parallel in Phase 2, independent files)

# Phase 3 extraction tasks can run in parallel:
T005 (FeaturedPaymentCard) || T006 (MiniPaymentItem) || T007 (PayNowModal)
Then: T008 (barrel) → T009 (main refactor)

# Phase 4 + 5 can run in parallel after Phase 3:
T010 || T011 || T012 (all dark mode fixes, different files)
T013 → T014 (PayNowModal UX, sequential)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (directory + types)
2. Complete Phase 2: Foundational (move business logic)
3. Complete Phase 3: User Story 1 (extract all sub-components)
4. **STOP and VALIDATE**: Run ESLint, verify structure, check line count
5. This alone satisfies SC-001, SC-004, SC-005

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add User Story 1 → Code structure refactored → Validate (MVP!)
3. Add User Story 2 → Light/dark mode fixed → Validate (SC-002)
4. Add User Story 3 → Pay Now UX polished → Validate (SC-003)
5. Polish → Final verification across all success criteria

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test tasks generated (not requested in spec)
- `formatDueDate` in current component is replaced by existing `getDueText` from
  `dateHelpers.ts` — do NOT create a new function
- Commit after each phase for clean Git history
