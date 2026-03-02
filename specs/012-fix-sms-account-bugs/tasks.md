# Tasks: Fix SMS Transaction & Default Cash Account Bugs

**Input**: Design documents from `/specs/012-fix-sms-account-bugs/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: Included — plan specifies new `account-service.test.ts` and
verification of existing `transaction-validation.test.ts`.

**Organization**: Tasks grouped by user story for independent implementation and
testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed — existing monorepo. This phase covers
foundational code changes that block all user stories.

- [x] T001 Update `detectCurrencyFromDevice` to return `CurrencyType | null`
      instead of falling back to `"USD"` in
      `apps/mobile/utils/currency-detection.ts`
- [x] T002 Update `ensureCashAccount` to accept optional `currency` param and
      add currency-aware idempotency check (query `currency` column alongside
      `type=CASH`) in `apps/mobile/services/account-service.ts`
- [x] T003 [P] Remove `SHOW_CASH_TOAST_KEY` constant from
      `apps/mobile/constants/storage-keys.ts`

**Checkpoint**: Foundation ready — currency detection returns null when
unsupported, account service supports explicit currency param with
currency-aware dedup. Toast key removed.

---

## Phase 2: User Story 1 — Default Cash Account Created Once at Correct Time (Priority: P1) 🎯 MVP

**Goal**: Move Cash account creation to a dedicated final onboarding step with
currency picker (when needed), friendly loading/success UI, and no-duplicate
guarantee.

**Independent Test**: Complete onboarding → verify 1 Cash account in local
currency exists. Restart 3× → verify no duplicates. Simulate detection failure →
verify currency picker appears.

### Tests for User Story 1

- [ ] T004 [US1] Create `apps/mobile/__tests__/services/account-service.test.ts`
      with 6 test cases: (1) creates cash with detected currency, (2) returns
      existing without duplicate (same currency), (3) returns `CURRENCY_UNKNOWN`
      when currency is null, (4) creates with explicit currency param, (5)
      allows different-currency cash accounts, (6) handles DB write failure
      gracefully

### Implementation for User Story 1

- [x] T005 [P] [US1] Create `CurrencyPickerStep` component in
      `apps/mobile/components/onboarding/CurrencyPickerStep.tsx` — full-screen
      currency picker with search bar, `SUPPORTED_CURRENCIES` list, EGP
      pre-selected, radio selection, "Continue" always enabled, dark/light mode
      via NativeWind. Props:
      `onCurrencySelected: (currency: CurrencyType) => void`. Mockups:
      `currency_picker_dark_1772405159474.png`,
      `currency_picker_light_mode_1772405050220.png`
- [x] T006 [P] [US1] Create `WalletCreationStep` component in
      `apps/mobile/components/onboarding/WalletCreationStep.tsx` — loading state
      ("Getting your wallet ready… Even pharaohs kept track of their gold!"),
      success state ("✨ Wallet Created — You're All Set!") with reanimated
      animation, error state (brief message), "Let's Go!" button. Props:
      `userId`, `currency`, `onComplete`, `onError`. Mockups:
      `wallet_created_dark_mode_1772405063538.png`,
      `wallet_created_light_mode_1772405071248.png`
- [x] T007 [US1] Refactor `onboarding.tsx` to use multi-phase flow
      (`carousel → currency-picker? → wallet-creation`) in
      `apps/mobile/app/onboarding.tsx` — add `OnboardingPhase` state, call
      `detectCurrencyFromDevice()` after carousel, show `CurrencyPickerStep` if
      null, then `WalletCreationStep`, remove fire-and-forget
      `ensureCashAccount` call, remove `SHOW_CASH_TOAST_KEY` import and usage
- [x] T008 [US1] Update `index.tsx` retry logic — remove `SHOW_CASH_TOAST_KEY`
      import and `.setItem()` call, keep silent `ensureCashAccount()` retry (no
      flag, no toast) in `apps/mobile/app/index.tsx`
- [x] T009 [US1] Remove toast display code from dashboard — remove
      `SHOW_CASH_TOAST_KEY` import, `AsyncStorage.getItem`, toast rendering, and
      `AsyncStorage.removeItem` calls in `apps/mobile/app/(tabs)/index.tsx`

**Checkpoint**: User Story 1 fully functional — new onboarding flow with
currency picker and wallet creation step, silent retry on launch, no dashboard
toast, no duplicates.

---

## Phase 3: User Story 2 — Chevron Expands SMS Body vs Card Opens Edit Modal (Priority: P2)

**Goal**: Separate the chevron expand/collapse action from the card body edit
action in SMS Transaction Review.

**Independent Test**: Tap chevron → SMS body expands. Tap again → collapses. Tap
card body → edit modal opens. Checkbox toggles independently.

### Implementation for User Story 2

- [x] T010 [US2] Refactor `SmsTransactionItem` to separate chevron into its own
      `Pressable` with `hitSlop={12}` for 44×44pt touch target in
      `apps/mobile/components/sms-sync/SmsTransactionItem.tsx` — remove
      `onLongPress` from main card `Pressable`, wrap chevron `Ionicons` in a
      dedicated `Pressable` with `onPress={handleToggleExpand}`, increase icon
      size from 14 to 16px, add padding for visual balance while keeping card
      clean

**Checkpoint**: User Story 2 functional — chevron tap is distinct from card body
tap, maintains clean card layout.

---

## Phase 4: User Story 3 — Edit Transaction Modal Validates Required Fields (Priority: P2)

**Goal**: Prevent saving transactions with missing required fields (account,
amount, category) and ensure edits only persist on explicit save.

**Independent Test**: Open edit modal → clear account → save → see error. Enter
0 amount → save → see error. Close without saving → verify no changes persisted.

### Implementation for User Story 3

- [x] T011 [US3] Add currency filtering to `SmsTransactionReview` — filter out
      transactions with `currency` not in `SUPPORTED_CURRENCIES` before
      rendering in `apps/mobile/components/sms-sync/SmsTransactionReview.tsx`
- [ ] T012 [US3] Add validation to Edit Transaction modal in
      `SmsTransactionReview.tsx` — call `validateTransactionForm` from
      `transaction-validation.ts` before save, show inline error messages for
      missing `account_id`, invalid `amount`, missing `category`, block save on
      validation failure

**Checkpoint**: User Story 3 functional — unrecognized currencies filtered, edit
modal validates required fields, edits only persist on save.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup across all stories.

- [ ] T013 [P] Run TypeScript compilation check —
      `cd apps/mobile && npx tsc --noEmit`
- [ ] T014 [P] Run all unit tests —
      `cd apps/mobile && npx jest --config jest.config.js`
- [ ] T015 Verify no remaining references to `SHOW_CASH_TOAST_KEY` in the
      codebase via grep
- [ ] T016 Update spec.md status from "Draft" to "Implemented" in
      `specs/012-fix-sms-account-bugs/spec.md`

**Checkpoint**: All stories verified, no regressions, type-safe, toast cleanup
confirmed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1 — Cash Account)**: Depends on T001, T002, T003 from Phase 1
- **Phase 3 (US2 — Chevron UX)**: Depends on Phase 1 completion only
  (independent of US1)
- **Phase 4 (US3 — Edit Validation)**: Depends on Phase 1 completion only
  (independent of US1 and US2)
- **Phase 5 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on T001 (currency detection) and T002 (account service).
  Can start after Phase 1.
- **US2 (P2)**: No dependency on US1. Can start after Phase 1 (only needs
  `SmsTransactionItem.tsx`).
- **US3 (P2)**: No dependency on US1 or US2. Can start after Phase 1 (only needs
  `SmsTransactionReview.tsx`).

### Within Each User Story

- T004 (tests) → T005, T006 (components, parallel) → T007 (onboarding
  integration) → T008, T009 (cleanup, parallel)
- T010 is standalone within US2
- T011, T012 are sequential within US3 (filter before validation)

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 — all different files, can run in parallel
- **US1**: T005 and T006 can run in parallel (different new files)
- **US1**: T008 and T009 can run in parallel (different files)
- **US2 and US3**: Entirely independent, can run in parallel with each other and
  with US1 (after Phase 1)
- **Phase 5**: T013 and T014 can run in parallel

---

## Parallel Example: User Story 1

```text
# Phase 1 — all parallel:
T001: Update currency-detection.ts (return null)
T002: Update account-service.ts (currency-aware)
T003: Remove SHOW_CASH_TOAST_KEY from storage-keys.ts

# US1 tests:
T004: Write account-service.test.ts

# US1 components — parallel:
T005: Create CurrencyPickerStep.tsx
T006: Create WalletCreationStep.tsx

# US1 integration:
T007: Refactor onboarding.tsx

# US1 cleanup — parallel:
T008: Update index.tsx
T009: Update (tabs)/index.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: User Story 1 (T004–T009)
3. **STOP and VALIDATE**: Run tests, complete onboarding manually, verify no
   duplicates
4. This alone fixes issues #42, #43, #44

### Incremental Delivery

1. Setup + US1 → Cash account bugs fixed (MVP) — 3 issues resolved
2. Add US2 → Chevron UX fixed — 1 more issue resolved
3. Add US3 → Edit validation — 1 more issue resolved
4. Polish → All 5 issues resolved, ready to ship

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- No schema migrations needed — code-only changes
- Commit after each phase or logical group
- Total: **16 tasks** across 5 phases
