# Tasks: Voice Transaction Infrastructure Refinements

**Input**: Design documents from `/specs/021-voice-transaction-refinements/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅,
quickstart.md ✅

**Tests**: Unit tests for shared AI parser utilities are included (spec
explicitly requests them).

**Organization**: Tasks grouped by user story priority (P1 → P2 → P3).
Foundational tasks (shared utils + types) must complete before any user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Foundational — Shared Utils & Type System (#159)

**Purpose**: Create the shared infrastructure that ALL user stories depend on.
No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: This phase blocks US1–US6.

- [x] T001 [P] Create shared AI parser utilities with `normalizeType`,
      `VALID_TYPES`, `parseAiDate`, `clampConfidence`, `parseCategory`, and
      `CategoryMap` type in `packages/logic/src/utils/ai-parser-utils.ts`
- [x] T002 [P] Create unit tests for all shared utilities (`normalizeType`,
      `parseAiDate`, `clampConfidence`, `parseCategory`) in
      `packages/logic/src/utils/__tests__/ai-parser-utils.test.ts`
- [x] T003 Add barrel export `export * from "./utils/ai-parser-utils"` in
      `packages/logic/src/index.ts`
- [x] T004 Replace outdated `ParsedVoiceTransaction` with redesigned interface
      extending `ReviewableTransaction`, add `ReviewableTransaction` interface,
      and add `VoiceParserError` type
      (`kind: "timeout" | "network" | "empty" | "unknown"`, `message: string`)
      in `packages/logic/src/types.ts`
- [x] T005 Run unit tests:
      `cd packages/logic && npx jest --testPathPattern="ai-parser-utils" --verbose`
      — all must pass
- [x] T006 Run `npm run typecheck` — must pass with zero errors

**Checkpoint**: Shared utils created, types defined, tests green, typecheck
passes. User story implementation can now begin.

---

## Phase 2: User Story 2 — AI Voice Parser Architecture Refactor (Priority: P1)

**Goal**: Refactor the AI voice parser service to use `ParsedVoiceTransaction`,
shared utils, strict Zod validation, and category resolution via
`parseCategory`.

**Independent Test**: Run `npm run typecheck` with zero errors. Voice parser
returns `ParsedVoiceTransaction` objects. SMS parser returns
`ParsedSmsTransaction` with no behavioral changes.

### Implementation for User Story 2

- [x] T007 [US2] Import shared utils (`normalizeType`, `VALID_TYPES`,
      `parseAiDate`, `clampConfidence`, `parseCategory`) from `@astik/logic` and
      remove local duplicates (`normalizeType`, `VALID_TYPES`,
      `DATE_ONLY_REGEX`, `parseAiDate`) in
      `apps/mobile/services/ai-voice-parser-service.ts`
- [x] T008 [US2] Tighten `AiVoiceTransactionSchema` Zod schema — remove
      `.optional().default()` from `categorySystemName`, `description`,
      `accountId`, `date`, `confidenceScore`; add
      `originalTranscript: z.string()` and `detectedLanguage: z.string()` in
      `apps/mobile/services/ai-voice-parser-service.ts`
- [x] T009 [US2] Add `categories: readonly Category[]` to `ParseVoiceOptions`
      interface and build `CategoryMap` in `parseVoiceWithAi` function, then
      validate categories via `parseCategory` in
      `apps/mobile/services/ai-voice-parser-service.ts`
- [x] T010 [US2] Update mapping to produce `ParsedVoiceTransaction` instead of
      `ParsedSmsTransaction` — map `description` → `note`, include
      `originalTranscript`, `detectedLanguage`, `categoryId`,
      `categoryDisplayName` from `parseCategory` in
      `apps/mobile/services/ai-voice-parser-service.ts`
- [x] T011 [US2] Update `ParseVoiceResult` type to
      `{ transactions: readonly ParsedVoiceTransaction[], transcript: string, originalTranscript: string, detectedLanguage: string }`
      in `apps/mobile/services/ai-voice-parser-service.ts`
- [ ] T012 [P] [US2] Import `normalizeType`, `VALID_TYPES`, `parseCategory` from
      `@astik/logic` and remove local duplicates in
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T013 [US2] Update `TransactionReview` component props from
      `ParsedSmsTransaction[]` to `ReviewableTransaction[]` — only reference
      fields on `ReviewableTransaction` in
      `apps/mobile/components/transaction-review/TransactionReview.tsx`
- [ ] T014 [P] [US2] Update `TransactionItem` component props from
      `ParsedSmsTransaction` to `ReviewableTransaction` in
      `apps/mobile/components/transaction-review/TransactionItem.tsx`
- [ ] T015 [P] [US2] Update `TransactionEditModal` component props from
      `ParsedSmsTransaction` to `ReviewableTransaction` in
      `apps/mobile/components/transaction-review/TransactionEditModal.tsx`
- [ ] T016 [US2] Update `sms-review.tsx` to cast `ReviewableTransaction` back to
      `ParsedSmsTransaction` at the save boundary in
      `apps/mobile/app/sms-review.tsx`
- [x] T017 [US2] Run `npm run typecheck` — must pass with zero errors after full
      refactor

**Checkpoint**: Voice parser returns `ParsedVoiceTransaction`, SMS parser
unchanged, review components accept `ReviewableTransaction`, typecheck green.

### Test Updates for User Story 2

- [ ] T043 [US2] Update `makeValidTransaction` helper to include
      `originalTranscript`, `detectedLanguage` fields; remove SMS-only fields
      (`senderDisplayName`, `smsBodyHash`, `rawSmsBody`) in
      `apps/mobile/__tests__/services/ai-voice-parser-service.test.ts`
- [ ] T044 [US2] Update `makeSuccessResponse` helper to include
      `originalTranscript` and `detectedLanguage` at response level in
      `apps/mobile/__tests__/services/ai-voice-parser-service.test.ts`
- [ ] T045 [US2] Update all assertions: replace `senderDisplayName` checks with
      `note` checks, verify `ParsedVoiceTransaction` fields (`note`,
      `originalTranscript`, `detectedLanguage`, `categoryId`,
      `categoryDisplayName`) in
      `apps/mobile/__tests__/services/ai-voice-parser-service.test.ts`
- [ ] T046 [US2] Update schema defaults test — reflect tightened Zod schema
      (required fields no longer have `.optional().default()`), update minimal
      valid transaction fixture to include all required fields in
      `apps/mobile/__tests__/services/ai-voice-parser-service.test.ts`
- [ ] T047 [US2] Add new tests: `originalTranscript` mapped correctly,
      `detectedLanguage` mapped correctly, `note` mapped from AI `description`,
      `parseCategory` produces `categoryId`/`categoryDisplayName` when
      categories context provided in
      `apps/mobile/__tests__/services/ai-voice-parser-service.test.ts`
- [ ] T048 [US2] Run voice parser tests:
      `cd apps/mobile && npx jest --testPathPattern="ai-voice-parser-service" --verbose`
      — all must pass

---

## Phase 3: User Story 1 — Empty Recording Guard (Priority: P1) 🎯 MVP

**Goal**: Prevent hallucinated transactions from reaching the Review screen when
the user records silence or non-financial audio.

**Independent Test**: Tap mic, record 2s silence, tap Done → overlay shows "We
couldn't parse any transaction from the voice note" with Retry/Discard — NOT
navigated to Review.

**Depends on**: Phase 2 (voice parser returns `ParsedVoiceTransaction`)

### Implementation for User Story 1

- [ ] T018 [US1] Harden system prompt in Edge Function — add explicit
      instruction against hallucination on silence/noise and require
      `original_transcript` + `detected_language` even for empty results in
      `supabase/functions/parse-voice/index.ts`
- [ ] T019 [US1] Add `original_transcript` and `detected_language` fields to
      Gemini JSON response schema `RESPONSE_SCHEMA`, add to `required` array,
      and update `AiResponse` interface in
      `supabase/functions/parse-voice/index.ts`
- [ ] T020 [US1] Pass through `original_transcript` and `detected_language` in
      the Edge Function JSON response body in
      `supabase/functions/parse-voice/index.ts`
- [ ] T021 [US1] Add empty recording guard in `useVoiceTransactionFlow` — when
      `result.transactions.length === 0`, set `flowStatus` to `"error"` and
      `errorMessage` to "We couldn't parse any transaction from the voice note"
      instead of navigating in `apps/mobile/hooks/useVoiceTransactionFlow.ts`
- [ ] T022 [US1] Pass `originalTranscript` and `detectedLanguage` in route
      navigation params to `voice-review` screen in
      `apps/mobile/hooks/useVoiceTransactionFlow.ts`

**Checkpoint**: Empty recordings show error state in overlay; valid recordings
navigate to Review with transcript data.

---

## Phase 4: User Story 3 — Original Spoken Language Transcript (Priority: P2)

**Goal**: Display the user's original spoken text with an AI-determined language
badge in the Review screen's "What I Heard" section.

**Independent Test**: Record in Arabic → "What I Heard" shows Arabic text (RTL)
with "AR" badge from AI.

**Depends on**: Phase 3 (Edge Function returns `original_transcript`,
`detected_language`)

### Implementation for User Story 3

- [ ] T023 [US3] Accept `originalTranscript` and `detectedLanguage` from route
      params and display original transcript with language badge (uppercased
      `detectedLanguage`) in "What I Heard" section in
      `apps/mobile/app/voice-review.tsx`
- [ ] T024 [US3] Apply `writingDirection: "rtl"` when
      `detectedLanguage === "ar"` for Arabic transcript text in
      `apps/mobile/app/voice-review.tsx`
- [ ] T025 [US3] Update type references from `ParsedSmsTransaction` to
      `ParsedVoiceTransaction`/`ReviewableTransaction` in
      `apps/mobile/app/voice-review.tsx`

**Checkpoint**: "What I Heard" shows correct original text + language badge. RTL
for Arabic. English translation still visible.

---

## Phase 5: User Story 4 — Voice Overlay Visual Alignment (Priority: P2)

**Goal**: Align the voice recording overlay with the design mockup — panel to
bottom, proper button sizing, correct layout hierarchy.

**Independent Test**: Tap mic → panel fills to bottom; Done=56px,
Pause/Discard=48px; layout: Status/Timer → Waveform → Progress → Controls.

**No dependencies on other user stories** — can run in parallel with Phase 3/4.

### Implementation for User Story 4

- [ ] T026 [P] [US4] Extend overlay panel to `bottom: 0` with internal
      `paddingBottom` for safe area in
      `apps/mobile/components/voice/VoiceRecordingOverlay.tsx`
- [ ] T027 [P] [US4] Set "Done" button to 56px (prominent) and "Pause"/"Discard"
      to 48px (secondary) in
      `apps/mobile/components/voice/VoiceRecordingOverlay.tsx`
- [ ] T028 [P] [US4] Verify layout order: Status/Timer → Waveform → Progress Bar
      → Controls in `apps/mobile/components/voice/VoiceRecordingOverlay.tsx`

**Checkpoint**: Overlay matches mockup dimensions and layout hierarchy.

---

## Phase 6: User Story 5 — Z-Index Layering Fix (Priority: P2)

**Goal**: Fix z-index stacking so tab bar and mic button are accessible during
recording.

**Independent Test**: During recording — tab bar tappable, mic button clickable,
overlay behind both.

**No dependencies on other user stories** — can run in parallel with Phase
3/4/5.

### Implementation for User Story 5

- [ ] T029 [P] [US5] Set z-index layering constants: Backdrop(20) < Panel(22) <
      Tab Bar(25) < Mic Button(30) in
      `apps/mobile/components/tab-bar/CustomBottomTabBar.tsx`
- [ ] T030 [P] [US5] Apply z-index 20 to overlay backdrop and 22 to overlay
      panel in `apps/mobile/components/voice/VoiceRecordingOverlay.tsx`

**Checkpoint**: Tab bar and mic button accessible during recording on both iOS
and Android.

---

## Phase 7: User Story 6 — Hide FAB During Voice Recording (Priority: P3)

**Goal**: Hide the QuickActionFab during voice recording to reduce visual
clutter.

**Independent Test**: Tap mic → FAB disappears; stop recording → FAB reappears.

**No dependencies on other user stories** — can run in parallel with Phase 3–6.

### Implementation for User Story 6

- [ ] T031 [P] [US6] Add `isRecordingActive` prop to `QuickActionFab` component
      — return `null` when active in
      `apps/mobile/components/fab/QuickActionFab.tsx`
- [ ] T032 [US6] Pass `isRecordingActive={voiceFlow.flowStatus !== "idle"}` to
      `<QuickActionFab />` in `apps/mobile/app/(tabs)/_layout.tsx`

**Checkpoint**: FAB hidden during entire recording session, visible otherwise.

---

## Phase 8: Polish & Verification

**Purpose**: Final validation across all user stories

- [ ] T033 Run `npm run typecheck` — zero errors across entire monorepo
- [ ] T034 Run
      `cd packages/logic && npx jest --testPathPattern="ai-parser-utils" --verbose`
      — all tests pass
- [ ] T034b Run
      `cd apps/mobile && npx jest --testPathPattern="ai-voice-parser-service" --verbose`
      — all tests pass
- [ ] T035 [P] Apply @typescript-reviewer checklist: no `any`, explicit return
      types, `readonly` props, `import type`, Zod schema matches Edge Function
- [ ] T036 Deploy updated Edge Function:
      `npx supabase functions deploy parse-voice`
- [ ] T037 Manual test: Record silence → error state with "We couldn't parse any
      transaction" message
- [ ] T038 Manual test: Record Arabic → "What I Heard" shows Arabic text with
      "AR" badge
- [ ] T039 Manual test: Verify z-index (tab bar above overlay, mic button
      topmost)
- [ ] T040 Manual test: Verify FAB hidden during recording, visible after
- [ ] T041 Manual test: Verify overlay layout (panel to bottom, Done=56px)
- [x] T042 Mark legacy `packages/logic/src/parsers/voice-parser.ts` as
      `@deprecated` with a `// TODO:` comment explaining it is superseded by
      `ai-voice-parser-service.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Foundational) ─── BLOCKS ALL ──→ Phase 2 (US2: Parser Refactor)
                                              │
                                              ▼
                                         Phase 3 (US1: Empty Guard)
                                              │
                                              ▼
                                         Phase 4 (US3: Transcript)
                                              │
                                              ▼
                                         Phase 8 (Polish)

Phase 1 ──→ Phase 5 (US4: Overlay) ─────────→ Phase 8
Phase 1 ──→ Phase 6 (US5: Z-Index) ─────────→ Phase 8
Phase 1 ──→ Phase 7 (US6: FAB) ─────────────→ Phase 8
```

### User Story Dependencies

- **US2 (Parser Refactor)**: Depends only on Phase 1 — **start first**
- **US1 (Empty Guard)**: Depends on US2 (needs `ParsedVoiceTransaction` type)
- **US3 (Transcript)**: Depends on US1 (Edge Function schema update)
- **US4 (Overlay)**: Independent — can run in parallel with US1–US3
- **US5 (Z-Index)**: Independent — can run in parallel with US1–US4
- **US6 (FAB)**: Independent — can run in parallel with US1–US5

### Parallel Opportunities

```text
After Phase 1:
  ┌─ US2 (sequential: T007→T017)
  ├─ US4 (parallel: T026, T027, T028)
  ├─ US5 (parallel: T029, T030)
  └─ US6 (parallel: T031, T032)

After Phase 2:
  └─ US1 (sequential: T018→T022)

After Phase 3:
  └─ US3 (sequential: T023→T025)
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Complete Phase 1: Foundational (shared utils + types)
2. Complete Phase 2: US2 (parser refactor) — enables correct types throughout
3. Complete Phase 3: US1 (empty recording guard) — prevents bad data
4. **STOP and VALIDATE**: `typecheck` passes, silence → error state
5. This is a safe milestone to commit/PR

### Incremental Delivery

1. Phase 1 → Shared foundation ✅
2. Phase 2 → Parser architecture clean ✅
3. Phase 3 → Empty guard live ✅ (MVP!)
4. Phase 4 → Transcript display ✅
5. Phases 5-7 → UI/UX polish ✅ (can be separate PR)
6. Phase 8 → Final verification ✅

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US4, US5, US6 are independent and can start as soon as Phase 1 is complete
- Commit after each phase checkpoint
- Edge Function deployment (T036) should happen after T018–T020 are committed
- Total: **49 tasks** across **8 phases** covering **6 user stories**
