# Tasks: Fix SMS Scan Reliability & UX

**Input**: Design documents from `specs/011-sms-flow-fixes/` **Prerequisites**:
plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (DB Migration & Schema)

**Purpose**: Add `sms_body_hash` to transfers table and regenerate WatermelonDB
schema

- [ ] T001 Create migration file
      `supabase/migrations/030_add_sms_body_hash_to_transfers.sql` — ALTER TABLE
      transfers ADD COLUMN sms_body_hash TEXT + partial index
- [ ] T002 Run `npm run db:push` to apply migration 030 to remote Supabase
- [ ] T003 Run `npm run db:migrate` to regenerate WatermelonDB schema, types,
      and migrations in `packages/db/src/`
- [ ] T004 Verify `base-transfer.ts` has `smsBodyHash` field, `schema.ts` has
      column, `migrations.ts` has addColumns step

**Checkpoint**: Database schema updated. `transfers` table has `sms_body_hash`.

---

## Phase 2: Foundational (SMS Normalization Utility)

**Purpose**: Create the normalization function that all dedup logic depends on

**⚠️ CRITICAL**: US1 dedup tasks depend on this

- [ ] T005 Add `normalizeSmsBody(body: string): string` function in
      `apps/mobile/services/sms-sync-service.ts` — strip zero-width chars
      (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`), normalize line endings, collapse
      whitespace, trim
- [ ] T006 Update hash computation in `apps/mobile/services/sms-sync-service.ts`
      (~L225) to call `normalizeSmsBody(body)` before passing to hash function

**Checkpoint**: SMS body normalization is in place. Hash is now stable.

---

## Phase 3: User Story 1 — Rescan Dedup (Priority: P1) 🎯 MVP

**Goal**: Rescan never shows already-saved transactions or transfers

**Independent Test**: Save SMS transactions (including ATM withdrawal as
transfer) → rescan → verify 0 duplicates appear

### Implementation for User Story 1

- [ ] T007 [US1] Extend `loadExistingSmsHashes()` in
      `apps/mobile/services/sms-sync-service.ts` to also query `transfers` table
      for `sms_body_hash` and merge into the returned `Set<string>`
- [ ] T008 [US1] Update ATM-withdrawal transfer saving in
      `apps/mobile/services/batch-sms-transactions.ts` to set `smsBodyHash` on
      the transfer record (same as done for transactions ~L238)
- [ ] T009 [US1] Manual test: save 3+ SMS transactions and 1+ ATM transfer →
      rescan → verify 0 duplicates

**Checkpoint**: US1 complete — dedup covers both transactions and transfers.

---

## Phase 4: User Story 2 — Account Setup Back & Cancel (Priority: P1)

**Goal**: Account Setup screen has back arrow (→ SuccessState) and cancel button
(→ discard + dashboard)

**Independent Test**: Navigate to Account Setup → tap back → verify return to
SuccessState. Tap cancel → verify discard + return to tabs.

### Implementation for User Story 2

- [ ] T010 [US2] Add `onBack` and `onCancel` props to `AccountSetupStepProps`
      interface in `apps/mobile/components/sms-sync/AccountSetupStep.tsx`
- [ ] T011 [US2] Add header bar to `AccountSetupStep` in
      `apps/mobile/components/sms-sync/AccountSetupStep.tsx` — back arrow
      (chevron-back, left) + close icon (right, same pattern as sms-review.tsx
      L249-251)
- [ ] T012 [US2] Wire `onBack` callback in `apps/mobile/app/sms-scan.tsx` — set
      step state back to SuccessState (preserve scan results)
- [ ] T013 [US2] Wire `onCancel` callback in `apps/mobile/app/sms-scan.tsx` —
      clear all parsed data + navigate to `/(tabs)`
- [ ] T014 [US2] Manual test: navigate to Account Setup → tap back → confirm
      SuccessState. Tap cancel → confirm dashboard with data cleared.

**Checkpoint**: US2 complete — Account Setup has both navigation options.

---

## Phase 5: User Story 3 — Account Setup Loading State (Priority: P2)

**Goal**: Show skeleton loaders while account suggestions load; disable CTA

**Independent Test**: Navigate to Account Setup → observe 1-2s loading window →
verify skeleton cards appear and CTA is disabled

### Implementation for User Story 3

- [ ] T015 [US3] Add `isLoading` state to `AccountSetupStep` in
      `apps/mobile/components/sms-sync/AccountSetupStep.tsx` — starts `true`,
      flips to `false` after `buildInitialAccountState` resolves
- [ ] T016 [US3] Create skeleton card placeholder component (2-3 animated
      pulsing `View` elements) in
      `apps/mobile/components/sms-sync/AccountSetupStep.tsx`
- [ ] T017 [US3] Conditionally render skeleton cards while `isLoading` is true,
      real cards when false, in
      `apps/mobile/components/sms-sync/AccountSetupStep.tsx`
- [ ] T018 [US3] Disable "Create accounts & review" button while `isLoading` —
      grey out with `opacity-50` and `disabled` prop in
      `apps/mobile/components/sms-sync/AccountSetupStep.tsx`
- [ ] T019 [US3] Manual test: navigate to Account Setup → confirm skeleton cards
      display during load, CTA disabled, smooth transition to real cards

**Checkpoint**: US3 complete — loading state is polished and CTA is gated.

---

## Phase 6: User Story 4 — Scan Progress Text Alignment (Priority: P3)

**Goal**: Progress text sits below pipeline card without overlapping

**Independent Test**: Start SMS scan → observe progress text position → verify
no overlap

### Implementation for User Story 4

- [ ] T020 [US4] Fix `ScanHintText` spacing in
      `apps/mobile/components/sms-sync/SmsScanProgress.tsx` — adjust
      margins/padding in the bottom action area (~L122-134) to prevent overlap
      with pipeline status card
- [ ] T021 [US4] Manual test: start SMS scan → verify progress text is below
      pipeline card with proper spacing, no jitter on percentage update

**Checkpoint**: US4 complete — scan progress text properly aligned.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Final cleanup and validation

- [ ] T022 [P] Update `apps/mobile/__tests__/services/sms-sync-service.test.ts`
      — add test cases for `normalizeSmsBody` (whitespace, zero-width chars,
      line endings)
- [ ] T023 Run full quickstart.md validation from
      `specs/011-sms-flow-fixes/quickstart.md`
- [ ] T024 Commit all changes, push to `011-sms-flow-fixes`, create PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (schema must exist first)
- **Phase 3 (US1 Dedup)**: Depends on Phase 2 (normalization must exist)
- **Phase 4 (US2 Back/Cancel)**: Depends on Phase 1 only — **can run in parallel
  with Phase 3**
- **Phase 5 (US3 Loading)**: Depends on Phase 4 (modifies same file)
- **Phase 6 (US4 Text)**: No cross-dependencies — **can run in parallel with
  Phase 3+**
- **Phase 7 (Polish)**: Depends on all phases complete

### Parallel Opportunities

```text
After Phase 2 completes:
  ├── Phase 3 (US1 Dedup)        ← can start
  ├── Phase 4 (US2 Back/Cancel)  ← can start in parallel
  └── Phase 6 (US4 Text)         ← can start in parallel

After Phase 4 completes:
  └── Phase 5 (US3 Loading)      ← depends on US2 (same file)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Migration → Phase 2: Normalization → Phase 3: US1 Dedup
2. **STOP and VALIDATE**: Rescan produces 0 duplicates
3. This alone resolves the two critical dedup bugs (#67, #62)

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Test dedup independently → Critical bugs fixed ✅
3. Phase 4 (US2) → Test back/cancel independently → Navigation unblocked ✅
4. Phase 5 (US3) → Test loading state independently → Polished setup ✅
5. Phase 6 (US4) → Test text alignment independently → Clean scan screen ✅
6. Phase 7 → Polish, tests, PR ✅

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Total tasks: 24
- US1: 3 tasks, US2: 5 tasks, US3: 5 tasks, US4: 2 tasks
- Setup: 4 tasks, Foundational: 2 tasks, Polish: 3 tasks
