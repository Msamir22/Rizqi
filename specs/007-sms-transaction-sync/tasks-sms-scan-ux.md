# Tasks: SMS Scan UX & Reliability Improvements

**Input**: Design documents from `/specs/007-sms-transaction-sync/`
(spec-sms-scan-ux.md, plan-sms-scan-ux.md)  
**Tests**: Not requested — manual verification on emulator.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3) from the spec

## Path Conventions

All paths relative to repo root. Feature area:

```text
apps/mobile/
├── services/
│   ├── ai-sms-parser-service.ts   # Chunking, retry, edge function calls
│   └── sms-sync-service.ts        # Pipeline orchestration, progress reporting
├── components/sms-sync/
│   └── SmsScanProgress.tsx        # Progress UI (scanning state, hero card)
└── hooks/
    └── useSmsScan.ts              # State machine hook (types flow through)
```

---

## Phase 1: Foundational — Service Layer (Reliability + Data)

**Purpose**: Reduce chunk size, add retry-with-split, emit per-chunk timing
data, and enrich the `SmsScanProgress` type with fields needed by all 3 user
stories.

**⚠️ CRITICAL**: All UI tasks (US1, US3) depend on these service-layer changes.

- [ ] T001 [P] Reduce `CLIENT_CHUNK_SIZE` from 100 to 50 in
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T002 Add `chunkDurationMs` field to `AiParseProgress` interface and emit
      it from `parseSmsWithAi` after each chunk completes in
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T003 Implement retry-with-split in `parseSmsWithAi`: on chunk failure,
      split the failed chunk in half and retry each sub-chunk (max 1 level of
      bisection). Adjust `totalChunks` dynamically when a split occurs. File:
      `apps/mobile/services/ai-sms-parser-service.ts`
- [ ] T004 [P] Add `scanStartedAt` (epoch ms) and `estimatedRemainingMs`
      (optional) fields to the `SmsScanProgress` interface in
      `apps/mobile/services/sms-sync-service.ts`
- [ ] T005 Set `scanStartedAt = Date.now()` at the beginning of
      `executeScanPipeline` and pass it in every `onProgress` call in
      `apps/mobile/services/sms-sync-service.ts`
- [ ] T006 Fix the initial `aiChunksTotal` to use
      `Math.ceil(candidates.length / CLIENT_CHUNK_SIZE)` instead of hardcoded
      `1` in `executeScanPipeline` in `apps/mobile/services/sms-sync-service.ts`
- [ ] T007 Compute `estimatedRemainingMs` in the AI progress callback of
      `executeScanPipeline`: track per-chunk durations in an array, calculate
      rolling average, multiply by remaining chunks. Set to `undefined` when < 2
      total chunks or before first chunk completes. File:
      `apps/mobile/services/sms-sync-service.ts`

**Checkpoint**: Service layer complete. `SmsScanProgress` now emits
`scanStartedAt`, `estimatedRemainingMs`, `chunkDurationMs`, correct
`aiChunksTotal`, and handles failures with retry-with-split.

---

## Phase 2: User Story 1 — Live Progress Feedback (Priority: P1) 🎯 MVP

**Goal**: The user sees continuous visual activity during AI parsing: an elapsed
timer, the batch counter, and the live transaction count after each batch.

**Independent Test**: Start a scan with ≥50 financial SMS. Observe: elapsed
timer ticks every second, batch counter shows "Analyzing batch X of Y...",
transaction count updates after each batch.

### Implementation for User Story 1

- [ ] T008 [US1] Add elapsed timer to `ScanningState` in
      `apps/mobile/components/sms-sync/SmsScanProgress.tsx` — `useEffect` with
      `setInterval(1000)` computing `Date.now() - scanStartedAt`, formatted as
      "Xm Xs"
- [ ] T009 [US1] Add batch counter text "Analyzing batch X of Y..." below the
      status text during `ai-parsing` phase in `ScanningState` in
      `apps/mobile/components/sms-sync/SmsScanProgress.tsx`
- [ ] T010 [US1] Replace static bottom hint text ("This usually takes 30–60
      seconds") with dynamic text based on phase: filtering → "Scanning your
      messages...", AI pre-first-chunk → "Processing may take a few minutes for
      large inboxes", AI post-first-chunk → elapsed + estimate. File:
      `apps/mobile/components/sms-sync/SmsScanProgress.tsx`

**Checkpoint**: User sees an active, informative progress screen during AI
parsing. No frozen UI.

---

## Phase 3: User Story 2 — Reliable Scanning for Large Inboxes (Priority: P2)

**Goal**: SMS scanning succeeds reliably for large inboxes. Failed batches are
retried with smaller payloads. Partial results are preserved.

**Independent Test**: Scan with 200+ financial SMS. All batches complete or
retry successfully. Transactions from successful batches appear in review.

> **Note**: The core service-layer work (T001–T003) was done in Phase 1
> (Foundational). This phase covers the UI feedback for retries and partial
> failure handling.

### Implementation for User Story 2

- [ ] T011 [US2] Update `ScanningState` to show a retry indicator when the
      dynamic `aiChunksTotal` increases mid-scan (indicating a split occurred)
      in `apps/mobile/components/sms-sync/SmsScanProgress.tsx`
- [ ] T012 [US2] Ensure that when some batches fail and retries are exhausted,
      the scan still completes with partial results and the completion screen
      shows the correct count. Verify in
      `apps/mobile/services/ai-sms-parser-service.ts` that failed sub-chunks
      return `[]` without throwing.

**Checkpoint**: Scanning is resilient. Timeouts trigger retries with smaller
chunks. Partial results never lost.

---

## Phase 4: User Story 3 — Estimated Time Remaining (Priority: P3)

**Goal**: After the first AI batch completes (when ≥2 total batches), the UI
shows an estimated time remaining that converges toward zero.

**Independent Test**: Scan with 3+ batches. After batch 1 completes, observe
"~Xm Ys remaining" appear. After batch 2, estimate recalculates. Estimate
reaches 0 as scan finishes.

> **Note**: The computation logic (T007) was done in Phase 1. This phase wires
> it into the UI.

### Implementation for User Story 3

- [ ] T013 [US3] Display `estimatedRemainingMs` as "~Xm Ys remaining" below the
      elapsed timer in `ScanningState`, only when the value is defined (≥2
      batches, ≥1 completed). File:
      `apps/mobile/components/sms-sync/SmsScanProgress.tsx`
- [ ] T014 [US3] Add a `formatDuration` helper function (if not already present)
      that formats milliseconds into "Xm Ys" or "Xs" for both elapsed and
      estimated displays. File:
      `apps/mobile/components/sms-sync/SmsScanProgress.tsx` or
      `packages/logic/src/utils/`

**Checkpoint**: Complete feature. User sees elapsed time, batch progress, and
estimated remaining time during AI parsing.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and consistency checks.

- [ ] T015 [P] Clean up `console.log` statements added during development —
      replace with structured logging if needed, in
      `apps/mobile/services/ai-sms-parser-service.ts` and
      `apps/mobile/services/sms-sync-service.ts`
- [ ] T016 Verify TypeScript strict mode compliance — ensure all new fields use
      `readonly`, no `any` types, explicit return types on all new/modified
      functions
- [ ] T017 Manual end-to-end test: scan with varying inbox sizes (0, 10, 50,
      150, 300+ financial messages), verify all checkpoints from Phases 2–4

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 completion (needs `scanStartedAt`,
  `aiChunksTotal`)
- **Phase 3 (US2)**: Depends on Phase 1 completion (needs retry-with-split
  logic)
- **Phase 4 (US3)**: Depends on Phase 1 completion (needs
  `estimatedRemainingMs`, `chunkDurationMs`)
- **Phase 5 (Polish)**: Depends on all previous phases

### Within Phase 1

```text
T001 ─┐
T004 ─┤ (parallel — different files)
      │
T002 ──→ T003 (T003 depends on T002: chunkDurationMs interface needed for retry loop)
      │
T005 ──→ T006 ──→ T007 (sequential in sms-sync-service.ts)
```

### User Story Independence

- **US1 (P1)** and **US3 (P3)** are fully independent of each other after
  Phase 1.
- **US2 (P2)** UI work (T011) is independent of US1 and US3.
- All 3 user stories can be implemented in parallel after Phase 1.

### Parallel Opportunities

```text
# Phase 1 (parallel starts):
T001 ∥ T004     (different files)
T002 ∥ T005     (different files, after T001/T004)

# After Phase 1 (all stories in parallel):
US1 (T008–T010) ∥ US2 (T011–T012) ∥ US3 (T013–T014)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001–T007)
2. Complete Phase 2: User Story 1 — Live Progress Feedback (T008–T010)
3. **STOP and VALIDATE**: Test on emulator — elapsed timer, batch counter, live
   tx count
4. This alone fixes the "frozen screen" problem

### Incremental Delivery

1. Phase 1 → Foundation ready
2. Add US1 (T008–T010) → Test → **MVP complete** (progress feedback)
3. Add US2 (T011–T012) → Test → Retry reliability visible
4. Add US3 (T013–T014) → Test → Time estimation complete
5. Phase 5 → Polish → Done

---

## Notes

- Total tasks: **17**
- Phase 1 (Foundational): 7 tasks
- US1 (Live Progress): 3 tasks
- US2 (Reliability UI): 2 tasks
- US3 (Time Remaining): 2 tasks
- Polish: 3 tasks
- Core complexity is in Phase 1 (retry-with-split logic in T003, time estimation
  in T007)
- No schema changes, no edge function changes, no new screens
- All changes are in 3 files: `ai-sms-parser-service.ts`, `sms-sync-service.ts`,
  `SmsScanProgress.tsx`
