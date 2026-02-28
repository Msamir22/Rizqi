# Tasks: Refine AI SMS Parsing Accuracy

**Input**: Design documents from `/specs/010-refine-ai-parsing/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: No project initialization needed — all infrastructure exists.

_No tasks — this is a modification feature on an existing codebase._

---

## Phase 2: Foundational (Edge Function Changes)

**Purpose**: The Edge Function must be deployed first because the client depends
on the updated response schema (new `confidenceScore` field, removed
`accountSuggestions`). All user story tasks depend on this phase.

**⚠️ CRITICAL**: Client-side changes (Phases 3–6) depend on the Edge Function
returning the updated response shape.

- [ ] T001 [P] Add `confidenceScore` property (type: `"number"`, 0.0–1.0) to the
      transaction schema and add it to the transaction `required` array in
      `buildResponseSchema` in `supabase/functions/parse-sms/index.ts`
- [ ] T002 [P] Remove the entire `accountSuggestions` property block and remove
      `"accountSuggestions"` from the top-level `required` array in
      `buildResponseSchema` in `supabase/functions/parse-sms/index.ts`
- [ ] T003 Add confidence score rule ("Rate your confidence 0.0–1.0") and
      counterparty rule ("Counterparty MUST NEVER equal financialEntity") to
      `buildSystemPrompt` in `supabase/functions/parse-sms/index.ts`
- [ ] T004 Strengthen category rule in `buildSystemPrompt` to say "MUST NOT
      invent/combine/modify category names" in
      `supabase/functions/parse-sms/index.ts`
- [ ] T005 Remove `ACCOUNT SUGGESTION RULES` block, `accountContext` variable,
      and `existingAccounts` parameter from `buildSystemPrompt` in
      `supabase/functions/parse-sms/index.ts`
- [ ] T006 Remove `existingAccounts` from the prompt builder call in the
      handler/`processWithRetry` function in
      `supabase/functions/parse-sms/index.ts`
- [ ] T007 Deploy updated Edge Function and verify response shape (has
      `confidenceScore`, no `accountSuggestions`)

**Checkpoint**: Edge Function returns updated schema — client work can begin.

---

## Phase 3: User Story 1 — AI Returns Real Confidence Scores (Priority: P1) 🎯 MVP

**Goal**: Replace hardcoded 0.85 confidence with real AI-generated scores and
display visual confidence tags on transaction cards.

**Independent Test**: Run SMS scan → verify each transaction card shows a
coloured confidence tag. No card shows exactly `0.85`.

- [ ] T008 [US1] Add `readonly confidenceScore: number` to `AiSmsTransaction`
      interface in `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T009 [US1] Add `confidenceScore` validation to `isValidAiTransaction`
      (typeof number, clamp to 0.0–1.0) in
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T010 [US1] Replace hardcoded `confidence: 0.85` with
      `Math.min(1, Math.max(0, aiTx.confidenceScore))` in `mapAiTransactions` in
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T011 [US1] Add confidence tag chip to `SmsTransactionItem` bottom row
      (≥0.8 emerald "High Confidence", 0.5–0.79 amber "Needs Review", <0.5 red
      "Low Confidence") in
      `apps/mobile/components/sms-sync/SmsTransactionItem.tsx`

**Checkpoint**: Confidence scores flow end-to-end from AI → review list with
visual tags.

---

## Phase 4: User Story 2 — AI Only Returns Valid Categories (Priority: P1)

**Goal**: Enforce predefined categories and prevent AI from hallucinating
non-existent category names.

**Independent Test**: Scan SMS including ATM withdrawals → verify every category
is a valid `system_name` from the category tree. No "cash withdrawal" or
fabricated names.

- [ ] T012 [US2] Add category validation to `mapAiTransactions`: check
      `categorySystemName` against a known category list, fall back to `"other"`
      and log warning if unrecognized, in
      `apps/mobile/services/ai-sms-parser-service.ts`

**Checkpoint**: All parsed transactions have valid categories from the
predefined tree.

---

## Phase 5: User Story 3 — AI Never Uses Bank Name as Merchant (Priority: P2)

**Goal**: Prevent the AI from setting the bank/wallet sender as the counterparty
field.

**Independent Test**: Scan SMS from QNB/CIB → verify counterparty shows merchant
name or empty/"Unknown", never the bank name.

- [ ] T013 [US3] Add counterparty guard to `mapAiTransactions`: if
      `counterparty` equals `financialEntity` (case-insensitive), set
      counterparty to `""`, in `apps/mobile/services/ai-sms-parser-service.ts`

**Checkpoint**: No transaction has the bank name as counterparty.

---

## Phase 6: User Story 4 — Deterministic Account Suggestions (Priority: P2)

**Goal**: Replace AI-generated account suggestions with deterministic derivation
from the bank registry. Remove `accountSuggestions` from the AI response
pipeline entirely.

**Independent Test**: Run SMS scan during onboarding → verify suggestions match
bank registry entries only, no merchants/duplicates/Cash, max 5 cards.

### Step A: Build the deterministic suggestion logic

- [ ] T014 [US4] Create `mapRegistryType` helper function (`'bank'→'BANK'`,
      `'wallet'→'DIGITAL_WALLET'`, `'fintech'→'BANK'`) in
      `apps/mobile/utils/build-initial-account-state.ts`
- [ ] T015 [US4] Create `buildDeterministicSuggestions(groups, matchedSenders)`
      function: iterate groups from `groupTransactionsBySender`, call
      `isKnownFinancialSender` on each `senderAddress`, create
      `ParsedSmsAccountSuggestion` from registry match, exclude "Cash", sort by
      count desc, limit to 5, mark most frequent as `isDefault`, in
      `apps/mobile/utils/build-initial-account-state.ts`
- [ ] T016 [US4] Update `buildInitialAccountState` to remove `aiSuggestions`
      parameter, derive `matchedSenderSet` from `matchGroupsToExistingAccounts`
      result, call `buildDeterministicSuggestions(groups, matchedSenderSet)`,
      and feed result into existing `suggestionsToCards()`, in
      `apps/mobile/utils/build-initial-account-state.ts`

### Step B: Remove `accountSuggestions` from AI pipeline

- [ ] T017 [P] [US4] Remove `AiAccountSuggestion` interface,
      `isValidAiAccountSuggestion` function, `getAccountSuggestions` function,
      and `mapAiAccountSuggestions` function from
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T018 [US4] Remove `accountSuggestions` from `ChunkAiResult` and
      `AiParseResult` interfaces, remove suggestion parsing from
      `parseAiResponse`, remove suggestion accumulation from main export
      function, remove `existingAccounts` from `ParseSmsContext` in
      `apps/mobile/services/ai-sms-parser-service.ts`

### Step C: Remove `accountSuggestions` threading from downstream files

- [ ] T019 [P] [US4] Remove `accountSuggestions` from `SmsSyncResult` interface
      and returned object in `apps/mobile/services/sms-sync-service.ts`
- [ ] T020 [P] [US4] Remove `accountSuggestions` state and setter from
      `apps/mobile/context/SmsScanContext.tsx`
- [ ] T021 [P] [US4] Remove `accountSuggestions` state, setter, and return field
      from `apps/mobile/hooks/useSmsScan.ts`
- [ ] T022 [US4] Remove `accountSuggestions` from props, update
      `buildInitialAccountState(transactions, db)` call, remove from `useEffect`
      deps in `apps/mobile/components/sms-sync/AccountSetupStep.tsx`
- [ ] T023 [P] [US4] Remove `accountSuggestions` prop from `AccountSetupStep`
      usage in `apps/mobile/app/sms-review.tsx`
- [ ] T024 [P] [US4] Remove `setCtxAccountSuggestions` call in
      `apps/mobile/app/sms-scan.tsx`

**Checkpoint**: Account suggestions derived deterministically from bank
registry. No AI hallucinations. Max 5 cards.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T025 Run `npx tsc --noEmit` and fix any TypeScript compilation errors
- [ ] T026 Run `npx eslint` and fix any linting errors
- [ ] T027 Manual end-to-end SMS scan test: verify all 4 user stories work
      together

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — can start immediately
- **Phases 3–5 (US1–US3)**: Depend on Phase 2 completion (Edge Function
  deployed)
- **Phase 6 (US4)**: Depends on Phase 2 completion; Step B/C depend on Step A
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (Confidence)**: Independent after Phase 2
- **US2 (Categories)**: Independent after Phase 2
- **US3 (Counterparty)**: Independent after Phase 2
- **US4 (Account Suggestions)**: Independent after Phase 2, but has internal
  ordering (Step A → Step B → Step C)

### Parallel Opportunities

- T001 and T002 can run in parallel (different sections of
  `buildResponseSchema`)
- T008–T010 (US1 service) can run in parallel with T012 (US2) and T013 (US3)
  since they modify different functions
- T011 (US1 UI) is independent and can run in parallel with US2/US3
- T017 can run in parallel with T014–T016 (different files)
- T019–T021, T023–T024 can all run in parallel (different files)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Edge Function changes
2. Complete Phase 3: US1 — confidence scores + UI tags
3. **STOP and VALIDATE**: Scan SMS, verify coloured tags appear

### Incremental Delivery

1. Phase 2 → Edge Function deployed
2. Phase 3 → US1: Confidence scores visible → Validate
3. Phase 4 → US2: Categories enforced → Validate
4. Phase 5 → US3: Counterparty fixed → Validate
5. Phase 6 → US4: Deterministic suggestions → Validate
6. Phase 7 → Polish and final verification

---

## Notes

- No database migrations required
- Edge Function must be deployed before client changes
- Confidence score is ephemeral (not persisted to DB)
- `suggestionsToCards()` in `build-initial-account-state.ts` is reused as-is
- The `groupTransactionsBySender()` function already handles entity+currency
  deduplication
