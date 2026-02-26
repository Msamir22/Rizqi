# Implementation Plan: SMS Scan UX & Reliability Improvements

**Branch**: `007-sms-transaction-sync` | **Date**: 2026-02-25  
**Spec**: [spec-sms-scan-ux.md](file:///e:/Work/My%20Projects/Astik/specs/007-sms-transaction-sync/spec-sms-scan-ux.md)

## Summary

Improve the SMS scan experience in three areas: (1) make AI parsing more
reliable by reducing chunk size and adding retry-with-split logic, (2) add
continuous visual feedback (elapsed timer, batch counter, live transaction
count) during the AI parsing phase, and (3) show estimated time remaining after
the first AI batch completes.

No schema changes, no edge function changes, no new screens. All changes are in
the mobile app's service layer and one presentational component.

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React Native, Expo, NativeWind,
react-native-reanimated, WatermelonDB  
**Storage**: N/A (no schema changes)  
**Testing**: Manual on-device testing with Metro  
**Target Platform**: Android / iOS via Expo  
**Project Type**: Mobile (monorepo)  
**Performance Goals**: Progress UI updates every second; no frozen UI for >5
seconds  
**Constraints**: Supabase Edge Function wall-time ~150s; Gemini cold-start
latency variable  
**Scale/Scope**: 3 files modified, 1 file lightly touched

## Constitution Check

| Principle                     | Status       | Notes                                                                                                                                                                                                          |
| ----------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Offline-First              | ✅ N/A       | No data model changes. SMS parsing is an online operation by design (requires edge function).                                                                                                                  |
| II. Documented Business Logic | ✅ Pass      | No new business rules; chunk size and retry are implementation details.                                                                                                                                        |
| III. Type Safety              | ✅ Must pass | All new interfaces/types will use strict TypeScript. New fields on `SmsScanProgress` and `AiParseProgress` will be typed with `readonly`.                                                                      |
| IV. Service-Layer Separation  | ✅ Must pass | Retry logic stays in `ai-sms-parser-service.ts` (service). Elapsed timer and time estimation logic computed in the service callback, not in UI. `SmsScanProgress.tsx` remains a pure presentational component. |
| V. Premium UI                 | ✅ Must pass | Elapsed timer and time estimate use existing design language (slate palette, spacing). Use `react-native-reanimated` for smooth elapsed timer updates if needed.                                               |
| VI. Monorepo Boundaries       | ✅ Pass      | All changes in `apps/mobile/`. No cross-package changes.                                                                                                                                                       |
| VII. Local-First Migrations   | ✅ N/A       | No database changes.                                                                                                                                                                                           |

## Proposed Changes

### Component 1: AI SMS Parser Service (Chunking & Retry)

#### [MODIFY] [ai-sms-parser-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/ai-sms-parser-service.ts)

**Changes:**

1. **Reduce `CLIENT_CHUNK_SIZE` from 100 → 50**
   - Lower payload per edge function call → stays well within 150s wall-time
     limit
   - Doubles the number of progress updates (more responsive UI)

2. **Add per-chunk duration tracking** to `AiParseProgress`
   - New field: `chunkDurationMs: number` — how long the just-completed chunk
     took
   - This enables the caller to compute estimated time remaining

3. **Add retry-with-split on failure** in `invokeParseChunk` / `parseSmsWithAi`
   - When a chunk fails (any error, not just 546), split it in half
   - Retry each half as a separate `invokeParseChunk` call
   - Maximum 1 level of recursive split (50 → two 25s, but 25s are not further
     split)
   - Track the dynamic total chunk count as splits happen

**Key Design Decision:** Retry logic lives in `parseSmsWithAi` (the chunking
loop), not in `invokeParseChunk` (which remains a simple fire-and-forget call).
This keeps `invokeParseChunk` as a single-responsibility function.

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used:** Retry with Exponential Backoff + Bisection Strategy
> - **Why:** Simple single retry won't help if the payload is too large for the
>   time limit. Bisection reduces the payload size, directly addressing the
>   timeout root cause.
> - **SOLID Check:** SRP — `invokeParseChunk` does one thing (call edge
>   function). `parseSmsWithAi` orchestrates retries and splitting.
> - **Algorithm Choice:** Linear iteration with at-most-one-level bisection. No
>   recursion — flat loop with a queue/list of chunks.

---

### Component 2: SMS Sync Service (Progress Data Enhancement)

#### [MODIFY] [sms-sync-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/sms-sync-service.ts)

**Changes:**

1. **Add `scanStartedAt` field** to `SmsScanProgress`
   - `readonly scanStartedAt: number` — timestamp when the scan began (ms since
     epoch)
   - The UI component uses this to compute elapsed time independently (no
     polling needed)

2. **Add `estimatedRemainingMs` field** to `SmsScanProgress`
   - Calculated in the AI progress callback:
     `avgChunkDuration × remainingChunks`
   - Set to `undefined` until the first AI chunk completes (insufficient data)
   - Recalculated after each chunk using a rolling average of all completed
     chunk durations

3. **Update initial `aiChunksTotal`** to use the real total from
   `parseSmsWithAi`
   - Currently hardcoded to `1` before parsing starts — change to actual
     `Math.ceil(candidates.length / CHUNK_SIZE)` count

4. **Replace static hint text** constant
   - The bottom text "This usually takes 30–60 seconds" will be replaced with a
     context-sensitive message that references the number of batches

**Key Design Decision:** Time estimation is computed in the service layer
(inside the `parseSmsWithAi` callback), not in the UI component. The UI receives
the final `estimatedRemainingMs` value and just renders it. This keeps the
presentational component logic-free per Constitution IV.

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used:** Observer — service emits enriched progress data; UI
>   subscribes and renders.
> - **Why:** All computation in the service layer; UI is a pure function of
>   props.
> - **SOLID Check:** SRP maintained — `sms-sync-service.ts` orchestrates the
>   pipeline and enriches progress; `SmsScanProgress.tsx` only renders.

---

### Component 3: SMS Scan Progress UI

#### [MODIFY] [SmsScanProgress.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsScanProgress.tsx)

**Changes:**

1. **Add Elapsed Timer** to the `ScanningState` hero card
   - Uses `scanStartedAt` from progress data + `useEffect` with
     `setInterval(1000)` to compute elapsed seconds
   - Displays below the progress ring: "Elapsed: 1m 23s"
   - Formatted using the existing `formatDuration` helper

2. **Add Batch Counter Text** during AI parsing phase
   - Shows "Analyzing batch 2 of 4..." below the status text
   - Uses `aiChunksCompleted` / `aiChunksTotal` from progress data
   - Only visible during `ai-parsing` phase

3. **Add Estimated Time Remaining** display
   - Shows "~1m 30s remaining" below the elapsed timer
   - Only shows when `estimatedRemainingMs` is defined (i.e. after first chunk
     completes and total batches ≥ 2)
   - Uses `formatDuration` for consistent formatting

4. **Replace static bottom hint text**
   - Change from "This usually takes 30–60 seconds" to a dynamic message:
     - During filtering phase: "Scanning your messages..."
     - During AI parsing (before first chunk): "Processing may take a few
       minutes for large inboxes"
     - During AI parsing (after first chunk): Shows estimated time remaining
       instead

5. **Update progress percentage during AI phase** to be smoother
   - Currently jumps only between chunks. With smaller chunks (50 instead
     of 100) and more chunks, the jumps will naturally be smaller.
   - The percentage formula stays the same: `50 + (aiCompleted / aiTotal) * 50`

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used:** Presentational Component — receives all data via props, no
>   business logic
> - **Why:** The elapsed timer uses a simple `useEffect` + `setInterval` to tick
>   a local display counter. The interval only computes
>   `Date.now() - scanStartedAt` — no business logic.
> - **SOLID Check:** SRP — only renders. All time calculations are either
>   trivial (elapsed) or pre-computed by the service (estimated remaining).

---

### Component 4: useSmsScan Hook (Minor)

#### [MODIFY] [useSmsScan.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useSmsScan.ts)

**Changes:** No logic changes needed. The hook already passes `SmsScanProgress`
to state and the new fields will flow through automatically since the hook uses
the `SmsScanProgress` type.

---

## Project Structure

### Documentation (this feature)

```text
specs/007-sms-transaction-sync/
├── spec-sms-scan-ux.md           # Feature spec
├── plan-sms-scan-ux.md           # This file
└── checklists/
    └── requirements-sms-scan-ux.md
```

### Source Code Changes

```text
apps/mobile/
├── services/
│   ├── ai-sms-parser-service.ts   # MODIFY — chunk size, retry-with-split, per-chunk timing
│   └── sms-sync-service.ts        # MODIFY — enriched progress data (elapsed, estimated remaining)
├── components/sms-sync/
│   └── SmsScanProgress.tsx        # MODIFY — elapsed timer, batch counter, time estimate UI
└── hooks/
    └── useSmsScan.ts              # MINOR  — no logic changes, types flow through
```

## Verification Plan

### Manual Verification

1. **Trigger an SMS scan** with 100+ financial SMS candidates in the emulator
2. **Observe during filtering phase** (0–50%): progress ring advances smoothly,
   "Scanned" counter increments, elapsed timer ticks
3. **Observe during AI parsing phase** (50–100%):
   - Elapsed timer continues ticking every second
   - Batch counter shows "Analyzing batch 1 of N..."
   - After first batch completes: "Transactions Found" counter updates,
     estimated time remaining appears
   - After second batch: estimate recalculates
4. **Simulate edge function failure**: Temporarily set `CLIENT_CHUNK_SIZE` to a
   very large number (e.g. 500) to trigger a 546 timeout, and verify
   retry-with-split recovers gracefully
5. **Verify successful completion**: Check that all transactions from successful
   batches appear in the review screen
6. **Verify the bottom hint text** changes dynamically based on phase

### Edge Case Tests

- Scan with fewer than 50 financial messages (single batch, no time estimate
  displayed)
- Scan with exactly 50 messages (boundary: 1 batch vs 2)
- Scan with 0 financial messages (should skip AI phase entirely)
- Kill and restart app mid-scan (verify `cleanupStaleScanState` works)

## Execution Order

1. **Step 1**: Modify `ai-sms-parser-service.ts` — reduce chunk size, add
   retry-with-split, add `chunkDurationMs` to progress callback
2. **Step 2**: Modify `sms-sync-service.ts` — add `scanStartedAt`,
   `estimatedRemainingMs`, fix `aiChunksTotal`, compute time estimates
3. **Step 3**: Modify `SmsScanProgress.tsx` — add elapsed timer, batch counter,
   time estimate display, dynamic hint text
4. **Step 4**: Test full flow on emulator
