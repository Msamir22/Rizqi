# Tasks: Edit Account & Delete Account

**Input**: Design documents from `/specs/001-edit-delete-account/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Unit tests included per plan verification section.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations + shared service layer + validation updates

- [x] T001 Create SQL migration for balance adjustment categories in
      `supabase/migrations/032_seed_balance_adjustment_categories.sql`
- [x] T002 [P] Create SQL migration for default account unique constraint in
      `supabase/migrations/033_add_default_account_constraint.sql`
- [x] T003 Apply migrations and regenerate WatermelonDB schema via
      `npm run db:push && npm run db:migrate`
- [x] T004 Update `account-validation.ts` to allow negative balance for edits in
      `apps/mobile/validation/account-validation.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service functions and reusable components that ALL user
stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `checkAccountNameUniqueness` function in
      `apps/mobile/services/edit-account-service.ts`
- [x] T006 [P] Create `updateAccount` function in
      `apps/mobile/services/edit-account-service.ts`
- [x] T007 [P] Create `deleteAccountWithCascade` function (cascade:
      transactions, transfers, bank_details, debts, recurring_payments) in
      `apps/mobile/services/edit-account-service.ts`
- [x] T008 [P] Create `createBalanceAdjustmentTransaction` function in
      `apps/mobile/services/edit-account-service.ts`
- [x] T009 Create unit tests for all edit-account-service functions (including
      cascade delete of debts + recurring_payments) in
      `apps/mobile/__tests__/services/edit-account-service.test.ts`
- [x] T010 [P] Create `ReadOnlyDropdown` component (disabled dropdown with lock
      icon + custom styled tooltip, not native) in
      `apps/mobile/components/edit-account/ReadOnlyDropdown.tsx`
- [x] T011 Create `useEditAccountForm` hook (pre-filled form state, dirty
      tracking, inline uniqueness validation with 300ms debounce) in
      `apps/mobile/hooks/useEditAccountForm.ts`

**Checkpoint**: Foundation ready — service layer tested, reusable components
available, user story implementation can now begin

---

## Phase 3: User Story 5 — Navigate to Edit Account (Priority: P1) 🎯 MVP Entry Point

**Goal**: Wire navigation so users can tap on any account card to open the Edit
Account screen

**Independent Test**: Tap an account card from the Accounts tab or Dashboard →
verify the Edit Account screen opens with correct account data pre-filled

### Implementation for User Story 5

- [x] T012 [US5] Create Edit Account route screen with `useLocalSearchParams` to
      receive account ID as param in `apps/mobile/app/edit-account.tsx`
- [x] T013 [US5] Update `AccountCard` to navigate to
      `edit-account?id={accountId}` on press in
      `apps/mobile/components/accounts/AccountCard.tsx`
- [x] T014 [P] [US5] Update `AccountsSection` (Dashboard) to navigate to
      `edit-account?id={accountId}` on account card press in
      `apps/mobile/components/dashboard/AccountsSection.tsx`

**Checkpoint**: At this point, tapping any account card navigates to the Edit
Account screen with the correct account loaded

---

## Phase 4: User Story 1 — Edit Account Details (Priority: P1)

**Goal**: Full edit form with pre-fill, validation, save with dirty-state
button, and success toast

**Independent Test**: Open Edit Account → modify name and balance → tap Save →
verify changes persist and toast appears

### Implementation for User Story 1

- [x] T015 [US1] Create `useUpdateAccount` hook (calls `updateAccount` service,
      shows toast, navigates back) in `apps/mobile/hooks/useUpdateAccount.ts`
- [x] T016 [US1] Implement Edit Account form layout (header with avatar + type
      badge, pre-filled TextFields, BankDetailsSection, default toggle) in
      `apps/mobile/app/edit-account.tsx`
- [x] T017 [US1] Wire `useEditAccountForm` + `useUpdateAccount` into the Edit
      Account screen with dirty-state Save button in
      `apps/mobile/app/edit-account.tsx`
- [x] T018 [US1] Add inline name uniqueness validation (debounced 300ms, shows
      error under name field) in `apps/mobile/app/edit-account.tsx`

**Checkpoint**: Users can edit all account fields, see real-time validation, and
save changes with feedback

---

## Phase 5: User Story 2 — Read-Only Fields Communication (Priority: P1)

**Goal**: Account type and currency shown as locked dropdowns with explanatory
tooltip

**Independent Test**: Open Edit Account → verify type and currency dropdowns
show lock icons and cannot be opened → tap lock icon → see tooltip

### Implementation for User Story 2

- [x] T019 [US2] Integrate `ReadOnlyDropdown` for account type field with lock
      icon and "Cannot be changed after creation" tooltip in
      `apps/mobile/app/edit-account.tsx`
- [x] T020 [US2] Integrate `ReadOnlyDropdown` for currency field with lock icon
      and "Cannot be changed after creation" tooltip in
      `apps/mobile/app/edit-account.tsx`

**Checkpoint**: Read-only fields are clearly communicated with lock icons and
tooltips

---

## Phase 6: User Story 6 — Balance Adjustment Tracking (Priority: P1)

**Goal**: When balance is changed, present a bottom sheet offering silent update
or tracked transaction

**Independent Test**: Change balance → tap Save → verify bottom sheet appears
with correct calculations → select "Track as Transaction" → verify new
transaction created under Balance Adjustment category

### Implementation for User Story 6

- [x] T021 [US6] Create `BalanceChangedSheet` component (displays
      previous/new/diff, two radio options, confirm button) in
      `apps/mobile/components/edit-account/BalanceChangedSheet.tsx`
- [x] T022 [US6] Wire `BalanceChangedSheet` into Edit Account save flow (show
      when balance differs, skip when unchanged) in
      `apps/mobile/app/edit-account.tsx`
- [x] T023 [US6] Connect "Track as Transaction" option to
      `createBalanceAdjustmentTransaction` service in
      `apps/mobile/hooks/useUpdateAccount.ts`

**Checkpoint**: Balance changes are either silently applied or tracked as
transactions with full audit trail

---

## Phase 7: User Story 3 — Delete Account with Confirmation (Priority: P2)

**Goal**: Danger zone card + confirmation bottom sheet showing impact → cascade
soft-delete

**Independent Test**: Open Edit Account → tap Delete → verify bottom sheet shows
linked records count → confirm → verify account and all linked records removed,
toast "Account deleted"

### Implementation for User Story 3

- [x] T024 [US3] Create `DeleteAccountSheet` component (warning icon, account
      name/balance, linked records count, cancel/confirm buttons) in
      `apps/mobile/components/edit-account/DeleteAccountSheet.tsx`
- [x] T025 [US3] Create `useDeleteAccount` hook (calls
      `deleteAccountWithCascade` service, shows toast, navigates back) in
      `apps/mobile/hooks/useDeleteAccount.ts`
- [x] T026 [US3] Add "Delete Account" danger zone card to Edit Account screen
      and wire `DeleteAccountSheet` in `apps/mobile/app/edit-account.tsx`

**Checkpoint**: Delete flow works end-to-end with confirmation, cascade delete,
toast, and navigation

---

## Phase 8: User Story 4 — Default Account Protection on Delete (Priority: P2)

**Goal**: Handle deletion of default account without leaving broken state

**Independent Test**: Set an account as default → delete it → verify no account
has `is_default = true` and accounts list shows correctly

### Implementation for User Story 4

- [x] T027 [US4] Add default account handling logic to
      `deleteAccountWithCascade` (clear `is_default` flag, do not auto-promote)
      in `apps/mobile/services/edit-account-service.ts`
- [x] T028 [US4] Add unit test for deleting default account scenario in
      `apps/mobile/__tests__/services/edit-account-service.test.ts`

**Checkpoint**: Deleting the default account correctly clears the flag without
breaking the accounts list

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T029 [P] Verify all edit/delete operations work offline (airplane mode)
      and sync when reconnected
- [ ] T030 [P] Verify dark mode styling for all new components (Edit Account
      screen, bottom sheets, ReadOnlyDropdown)
- [x] T031 Run full TypeScript compilation check via
      `npx nx run mobile:typecheck`
- [x] T032 Run existing test suite to verify no regressions via
      `npx nx test mobile`
- [x] T033 Update `docs/business/business-decisions.md` with new business rules
      (balance adjustment categories, name uniqueness per user+currency, cascade
      delete scope, default account constraint)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migrations applied, validation
  updated) — BLOCKS all user stories
- **US5 Navigation (Phase 3)**: Depends on Phase 2 — BLOCKS US1, US2, US6 (need
  a screen to navigate to)
- **US1 Edit (Phase 4)**: Depends on Phases 2 + 3
- **US2 Read-Only (Phase 5)**: Depends on Phase 4 (form must exist to add
  read-only fields)
- **US6 Balance (Phase 6)**: Depends on Phase 4 (save flow must exist to
  intercept)
- **US3 Delete (Phase 7)**: Depends on Phase 2 + 3 only (independent of edit
  flow)
- **US4 Default Protection (Phase 8)**: Depends on Phase 7 (delete must work
  first)
- **Polish (Phase 9)**: Depends on all user stories complete

### User Story Dependencies

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundational)
  ↓
Phase 3 (US5: Navigation) ──────────────────┐
  ↓                                          ↓
Phase 4 (US1: Edit) ─────┐     Phase 7 (US3: Delete)
  ↓                ↓      ↓                  ↓
Phase 5 (US2)  Phase 6 (US6)   Phase 8 (US4: Default Protection)
  ↓                ↓                  ↓
  └────────────────┴──────────────────┘
                   ↓
             Phase 9 (Polish)
```

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different migration files)
- **Phase 2**: T005/T006/T007/T008 are in the same file but logically
  independent functions; T010 is a separate component [P]
- **Phase 3**: T013 and T014 can run in parallel (different files)
- **Phase 4 vs Phase 7**: US1 (Edit) and US3 (Delete) can run in parallel after
  Phase 3
- **Phase 5 vs Phase 6**: US2 (Read-Only) and US6 (Balance) can run in parallel
  after Phase 4
- **Phase 9**: T029 and T030 can run in parallel

---

## Parallel Example: After Phase 3

```bash
# Can launch US1 and US3 in parallel:
Developer A: Phase 4 (US1: Edit Account form + save)
Developer B: Phase 7 (US3: Delete flow + cascade)
```

---

## Implementation Strategy

### MVP First (US5 + US1 Only)

1. Complete Phase 1: Setup (2 migrations + validation update)
2. Complete Phase 2: Foundational (service layer + tests + reusable components)
3. Complete Phase 3: US5 — Navigation wired
4. Complete Phase 4: US1 — Edit form with save
5. **STOP and VALIDATE**: Test editing an account end-to-end
6. Can ship with edit-only functionality

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US5 → Navigation wired
3. Add US1 → Edit works → **MVP! 🎉**
4. Add US2 → Read-only fields polished
5. Add US6 → Balance tracking available
6. Add US3 + US4 → Delete with protection
7. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
