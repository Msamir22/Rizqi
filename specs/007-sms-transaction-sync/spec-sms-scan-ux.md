# Feature Specification: SMS Scan UX & Reliability Improvements

**Feature Branch**: `007-sms-transaction-sync`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "Fix edge function timeouts during SMS scanning,
enhance parsing reliability with retry logic and smaller batches, and improve
the scan progress UI to show elapsed time, per-batch status, and estimated time
remaining so the user is never staring at a frozen screen."

## Assumptions

- The existing SMS scan pipeline (filter → AI parse → review) is already
  functional.
- Supabase Edge Functions have a hard wall-time limit of ~150 seconds (status
  546).
- The Gemini AI model occasionally experiences cold-start delays, especially for
  the first request after a period of inactivity, which can push a single call
  well beyond the wall-time limit.
- The current client chunk size of 100 messages sometimes exceeds the edge
  function wall-time limit, causing silent failures.
- The existing `SmsScanProgress` data structure and `ScanningState` UI component
  are the only surfaces that need to change — no new screens are required.
- Average per-chunk processing time can be reliably estimated after the first
  completed chunk.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Live Progress Feedback During AI Parsing (Priority: P1)

When a user starts an SMS scan, the progress UI should never appear "frozen" or
stalled. During the AI parsing phase (which can take 1–3 minutes for large
inboxes), the user must see continuous visual feedback: an elapsed timer
counting up, the current batch being processed (e.g. "Analyzing batch 1 of
4..."), and the number of transactions found so far updating after each batch.

**Why this priority**: This directly addresses the most frustrating user
experience — staring at a frozen screen for 3 minutes with no indication that
anything is happening. Even if the scan itself is slow, perceived performance
improves dramatically when users can see activity.

**Independent Test**: Can be fully tested by initiating an SMS scan with ≥50
financial messages displayed in the inbox and observing the progress UI
throughout. Delivers immediate UX value regardless of whether reliability or
time estimation features are present.

**Acceptance Scenarios**:

1. **Given** the user initiates an SMS scan with a large inbox, **When** the AI
   parsing phase begins, **Then** the progress card displays: an elapsed timer
   (counting up in seconds), the current batch number out of total batches (e.g.
   "Analyzing batch 2 of 4"), and the status text updates from "Scanning
   Messages..." to "Analyzing Transactions..."
2. **Given** the AI parsing phase is in progress, **When** a batch completes,
   **Then** the "Transactions Found" stat card updates immediately with the
   cumulative count and the progress ring advances proportionally.
3. **Given** the AI parsing phase is active, **When** 10 seconds pass without a
   batch completing, **Then** the elapsed timer continues to increment without
   any freezing or stalling of the UI.
4. **Given** the scan completes, **When** the "Scan Complete" screen appears,
   **Then** the "Time Taken" summary row shows the total elapsed duration.

---

### User Story 2 — Reliable Scanning for Large Inboxes (Priority: P2)

SMS scanning must succeed reliably even for users with large inboxes (500+
financial messages). The system should process messages in smaller batches to
stay within server time limits, and automatically retry failed batches by
splitting them into smaller sub-batches.

**Why this priority**: Reliability is critical — a failed scan with no
user-visible error is worse than a slow scan. However, this is P2 because the
formatCurrency safety net and partial results already provide a baseline level
of resilience (failed chunks don't crash the pipeline).

**Independent Test**: Can be tested by triggering a scan with 200+ financial SMS
candidates and verifying that all batches succeed (or retry successfully)
without any silent failures.

**Acceptance Scenarios**:

1. **Given** the user has 200 financial SMS candidates, **When** the scan
   starts, **Then** the system processes them in batches small enough that no
   single batch exceeds the server's processing time limit.
2. **Given** a batch fails due to server timeout, **When** the retry mechanism
   activates, **Then** the failed batch is automatically split in half and each
   half is retried separately — without user intervention.
3. **Given** a batch fails and is retried, **When** the retry succeeds, **Then**
   the progress UI reflects the additional sub-batches (e.g., total batch count
   adjusts) and the user sees the retry happening (status text updates).
4. **Given** a batch fails and all retries are exhausted, **When** the scan
   continues to the next batch, **Then** partial results from successful batches
   are still returned and the user is informed that some messages could not be
   processed.
5. **Given** a user with a small inbox (< 50 financial messages), **When** the
   scan runs, **Then** all messages are processed in a single batch with no
   unnecessary splitting.

---

### User Story 3 — Estimated Time Remaining (Priority: P3)

After the first AI parsing batch completes, the system estimates the remaining
scan duration and displays it to the user. This transforms "How long will this
take?" anxiety into a clear expectation.

**Why this priority**: While highly impactful for user experience, this depends
on accurate per-batch timing data which is only available once user stories 1
and 2 are implemented. It's also the most complex to get right (inaccurate
estimates can be worse than no estimate).

**Independent Test**: Can be tested by triggering a scan with 3+ batches and
verifying that after the first batch completes, an estimated time remaining is
displayed and it converges toward zero as the scan progresses.

**Acceptance Scenarios**:

1. **Given** the first AI parsing batch has completed, **When** the second batch
   is in progress, **Then** the UI displays an estimated time remaining based on
   the average duration of completed batches and the number of remaining
   batches.
2. **Given** the estimated time remaining is displayed, **When** another batch
   completes, **Then** the estimate recalculates using a rolling average of all
   completed batch durations (more accurate over time).
3. **Given** fewer than 2 batches exist in total, **When** the scan is in
   progress, **Then** no time estimate is displayed (insufficient data for
   reliable estimation), and the UI shows only the elapsed timer.
4. **Given** the estimated time remaining is displayed, **When** the actual
   remaining time deviates significantly from the estimate (e.g., a retry adds
   extra batches), **Then** the estimate adjusts dynamically.

---

### Edge Cases

- What happens when all batches fail (e.g. Gemini is completely down)? The user
  should see an error state with a "Retry" button, not a false "0 transactions
  found" completion.
- What happens when the user force-closes the app mid-scan? The existing
  `SCAN_IN_PROGRESS_KEY` guard should clean up stale state on next launch.
- What happens when a retry produces duplicate transactions (batch partially
  succeeded before timeout)? Deduplication by `messageId` in `mapAiTransactions`
  already handles this.
- What happens when the elapsed timer runs for a very long time (5+ minutes)?
  The UI should not overflow or truncate — format as "Xm Xs".
- What happens when only 1 batch exists and it fails, then the retry (split into
  2 sub-batches) succeeds? The progress bar should handle dynamic total batch
  count changes gracefully.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a continuously incrementing elapsed timer (in
  seconds or minutes:seconds format) during the AI parsing phase.
- **FR-002**: System MUST display the current batch number and total batch count
  during AI parsing (e.g. "Analyzing batch 2 of 4").
- **FR-003**: System MUST update the "Transactions Found" counter after each
  completed batch, not only after all batches complete.
- **FR-004**: System MUST process SMS candidates in batches of 50 messages or
  fewer to stay within server time limits.
- **FR-005**: System MUST automatically retry a failed batch by splitting it
  into two smaller sub-batches.
- **FR-006**: System MUST limit retry depth to prevent infinite retry loops
  (maximum 1 level of splitting — a chunk of 50 can be split into two chunks of
  25, but those 25-message chunks are not further split on failure).
- **FR-007**: System MUST display an estimated time remaining after the first AI
  batch completes, when there are 2 or more total batches.
- **FR-008**: System MUST recalculate the estimated time remaining after each
  subsequent batch completes using a rolling average of all completed batch
  durations.
- **FR-009**: System MUST update the bottom hint text to reflect realistic
  expectations (replace the hardcoded "This usually takes 30–60 seconds" with a
  dynamic or context-aware message).
- **FR-010**: System MUST report partial results when some batches succeed and
  others fail — never discard successful results due to a later failure.
- **FR-011**: System MUST pass per-chunk timing data from the parsing service to
  the progress callback so the UI can compute time estimates.

### Key Entities

- **SmsScanProgress**: The progress data reported during scanning. Needs new
  fields: elapsed time since scan start, batch timing data, and estimated time
  remaining.
- **AiParseProgress**: Per-chunk progress from the AI parser. Needs new field:
  per-chunk duration to enable time estimation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users never see a frozen progress screen for more than 5 seconds
  during any phase of the SMS scan.
- **SC-002**: The elapsed timer increments every second during the AI parsing
  phase.
- **SC-003**: Edge function timeout failures (status 546) are automatically
  recovered from for inbox sizes up to 500 financial messages, with no
  user-visible errors.
- **SC-004**: The estimated time remaining (when displayed) is accurate to
  within ±30% of the actual remaining duration.
- **SC-005**: The static "This usually takes 30–60 seconds" hint is replaced
  with a contextual message that reflects the actual expected duration.
- **SC-006**: 100% of successfully parsed transactions from completed batches
  are preserved and shown to the user, even when other batches fail.
