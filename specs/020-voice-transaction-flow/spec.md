# Feature Specification: Voice Transaction Recording Flow (WhatsApp-style)

**Feature Branch**: `020-voice-transaction-flow`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: GitHub Issue #92 — Enhancement: Refactor Voice Transaction Recording
Flow

## User Scenarios & Testing _(mandatory)_

### User Story 1 — In-Place Voice Recording (Priority: P1)

As a user, I want to tap the mic button on the bottom tab bar and have a voice
recording panel slide up **in-place** (without navigating to a new screen) so I
can quickly record my transaction by voice while keeping my current context
visible.

**Why this priority**: This is the core interaction replacing the current
full-page navigation. Without this, the entire feature cannot function.

**Independent Test**: Can be tested by tapping the mic button on any screen and
verifying the overlay appears over the current view without navigating away.

**Acceptance Scenarios**:

1. **Given** the user is on any tab (Home, Accounts, Transactions, Metals),
   **When** they tap the center mic button on the tab bar, **Then** a recording
   bottom sheet slides up from above the tab bar AND the current screen content
   is visible (dimmed) behind the overlay.
2. **Given** the recording overlay is visible, **When** the user speaks,
   **Then** an audio waveform visualization reflects real-time audio levels AND
   a timer counts upward (00:00 → 01:00).
3. **Given** the user is recording, **When** they tap the "Done" button,
   **Then** the recording stops AND the audio file is submitted for AI analysis.
4. **Given** the user is recording, **When** they tap the "Pause" button,
   **Then** the recording pauses AND the waveform freezes AND the timer pauses
   AND the Pause button becomes a "Resume" button.
5. **Given** the recording is paused, **When** the user taps "Resume", **Then**
   the recording continues from where it left off.
6. **Given** the user is recording, **When** they tap the "Discard" (X) button,
   **Then** the recording is cancelled AND the overlay closes AND no data is
   sent.
7. **Given** the user is recording, **When** the timer reaches 60 seconds,
   **Then** the recording automatically stops AND submits for AI analysis (same
   as tapping "Done").

---

### User Story 2 — AI Audio Analysis & Transaction Parsing (Priority: P1)

As a user, after I finish recording, I want the app to analyze my audio using AI
and parse it into structured transactions so I can review them before saving.

**Why this priority**: Without AI parsing, the recorded audio has no purpose.
This enables the core value proposition of voice-to-transaction.

**Independent Test**: Can be tested by submitting a voice recording and
verifying the AI returns parsed transaction data.

**Acceptance Scenarios**:

1. **Given** the user has finished recording, **When** the audio is submitted,
   **Then** a loading state ("Analyzing your voice...") is displayed while the
   AI processes the audio.
2. **Given** the AI is processing, **When** the analysis completes successfully,
   **Then** the user is navigated to the Voice Transaction Review screen showing
   parsed transactions.
3. **Given** the AI is processing, **When** the analysis fails or returns no
   transactions, **Then** the user sees an error message with an option to retry
   recording.
4. **Given** the user said "I spent 5 on foul, 10 on taamia, 5000 on shopping",
   **When** the AI parses this, **Then** it returns 3 separate transactions with
   the correct amounts, merchant names, and detected categories.
5. **Given** the user speaks in Egyptian Arabic or mixed Arabic/English,
   **When** the AI parses this, **Then** it correctly identifies amounts,
   merchants, and transaction types regardless of language.

---

### User Story 3 — Voice Transaction Review (Priority: P1)

As a user, I want to review and edit AI-parsed transactions before saving them
so I can correct any errors and assign the right accounts and categories.

**Why this priority**: Users need to verify AI accuracy before saving to prevent
incorrect financial data. This directly reuses and extends the existing SMS
Transaction Review component.

**Independent Test**: Can be tested by navigating to the review screen with mock
transaction data and verifying all review, edit, and save actions work
correctly.

**Acceptance Scenarios**:

1. **Given** the AI has parsed transactions, **When** the review screen loads,
   **Then** each transaction is displayed as a card showing: description, amount
   (in red for expenses, green for income), category, and an assigned account.
2. **Given** the review screen is visible, **When** the user taps a transaction
   card, **Then** an edit modal opens allowing changes to amount, category,
   account, counterparty, and transaction type.
3. **Given** the review screen is visible, **When** the user taps a checkbox on
   a transaction, **Then** it toggles selection for that transaction (deselected
   transactions are not saved).
4. **Given** the review screen is visible, **When** the user taps "Select All",
   **Then** all transactions are selected/deselected together.
5. **Given** one or more transactions are selected, **When** the user taps "Save
   N Transactions", **Then** only the selected transactions are persisted to the
   database.
6. **Given** the review screen is visible, **When** the user taps "Discard All",
   **Then** all transactions are discarded AND the user returns to their
   previous screen.
7. **Given** the review screen is visible, **When** the user taps "Retry",
   **Then** the user is taken back to the recording overlay to re-record.
8. **Given** the review screen is in dark mode, **When** the transcript card is
   displayed, **Then** it shows the AI-generated transcript text (not the user's
   raw audio, but the AI's text interpretation of it).

---

### User Story 4 — Recording Controls & Duration Limit (Priority: P2)

As a user, I want clear visual feedback during recording (timer, waveform,
progress bar) and a maximum duration limit so I know how much time I have left.

**Why this priority**: Enhances usability but the feature works without polished
controls.

**Independent Test**: Can be tested by initiating a recording and verifying the
timer, waveform, and progress bar update in real time.

**Acceptance Scenarios**:

1. **Given** the user is recording, **When** time passes, **Then** a progress
   bar fills from 0% to 100% representing the elapsed time out of 60 seconds
   maximum.
2. **Given** the user is recording, **When** 50 seconds have elapsed, **Then**
   the progress bar visually indicates the user is nearing the limit (e.g., bar
   color shift or animation).
3. **Given** the recording overlay is active, **When** the mic button on the tab
   bar is displayed, **Then** it shows an active state (pulse animation rings
   emanating from it).

---

### Edge Cases

- What happens when the user taps the mic button while already recording? →
  Recording overlay remains visible; mic button tap is ignored or brings focus
  to the overlay.
- What happens when the app goes to background during recording? → The recording
  pauses automatically and can be resumed when the app returns to foreground. If
  the app stays in background for more than 2 minutes, the recording is
  discarded.
- What happens when the network is unavailable during AI analysis? → The user
  sees an error message with a "Retry" button. The audio file is temporarily
  stored locally to allow retry when connectivity returns.
- What happens when the AI returns an empty result (no transactions detected)? →
  The user sees a friendly message ("No transactions found in your recording.
  Try again?") with options to retry or discard.
- What happens when microphone permission is denied? → The user sees a
  permission prompt explaining why mic access is needed, with a button to open
  system settings.
- What happens when the user records silence or ambient noise? → The AI returns
  no transactions and the user sees the "no transactions found" message.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a recording overlay panel above the bottom tab
  bar when the mic button is tapped, without navigating to a new screen.
- **FR-002**: System MUST record audio from the device microphone and store it
  as a temporary file during the recording session.
- **FR-003**: System MUST provide three recording controls: Discard (cancel
  recording), Pause/Resume (toggle recording), and Done (stop and submit).
- **FR-004**: System MUST enforce a maximum recording duration of 60 seconds,
  automatically stopping and submitting when the limit is reached.
- **FR-005**: System MUST display a real-time timer (MM:SS format) and audio
  waveform visualization during recording.
- **FR-006**: System MUST display a progress bar showing elapsed time relative
  to the 60-second maximum.
- **FR-007**: System MUST send the recorded audio file to the AI service for
  parsing (not text transcription from on-device speech recognition).
- **FR-008**: System MUST display a loading/analyzing state while the AI
  processes the audio.
- **FR-009**: System MUST display parsed transactions in a review screen that
  reuses the existing Transaction Review component (renamed from
  SmsTransactionReview).
- **FR-010**: System MUST allow users to select/deselect, edit, and save
  individual transactions from the review screen.
- **FR-011**: System MUST display the AI-generated transcript text in a
  transcript card at the top of the review screen.
- **FR-012**: System MUST allow the user to retry recording from the review
  screen via a "Retry" action.
- **FR-013**: System MUST show the mic button in an active visual state (pulse
  animation) while recording is in progress.
- **FR-014**: System MUST dim the current screen content behind the recording
  overlay to indicate the overlay is active.
- **FR-015**: System MUST handle microphone permission requests gracefully, with
  clear messaging and a path to system settings.
- **FR-016**: System MUST support both Arabic (Egyptian dialect + MSA) and
  English voice input, as well as code-switching between them.

### Key Entities

- **Voice Recording**: A temporary audio file captured from the device
  microphone; associated with a recording session, duration, and status
  (recording, paused, completed, discarded).
- **Parsed Voice Transaction**: A structured financial entry extracted by AI
  from the audio; includes amount, currency, transaction type (expense/income),
  merchant/description, detected category, and detected language. Maps to the
  existing `ParsedSmsTransaction` data structure.
- **AI Transcript**: The text interpretation of the user's speech as generated
  by the AI service; displayed in the review screen for user context but not
  used for parsing (audio is sent directly).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can record a voice transaction and see the parsed results in
  under 15 seconds (recording + AI analysis combined, excluding review time).
- **SC-002**: 80% of users successfully save at least one transaction from a
  voice recording on their first attempt.
- **SC-003**: The AI correctly parses at least 85% of clearly spoken transaction
  statements (amounts, merchants, expense/income type) in both Arabic and
  English.
- **SC-004**: Users can complete the full flow (tap mic → record → review →
  save) in under 30 seconds for a single transaction.
- **SC-005**: All recording controls (Discard, Pause, Done) respond within 200ms
  of user interaction.
- **SC-006**: The recording overlay opens within 500ms of tapping the mic
  button.

## Assumptions

- The AI Edge Function (`parse-voice`) already supports audio file input
  (multipart form data) as confirmed in the existing
  `ai-voice-parser-service.ts`.
- The existing `SmsTransactionReview` component and its sub-components
  (`SmsTransactionItem`, `SmsTransactionEditModal`) are mature enough to be
  renamed/refactored to a source-agnostic `TransactionReview` component with a
  `source: "sms" | "voice"` prop.
- The AI voice parser already maps results to `ParsedSmsTransaction[]`, so the
  same data type flows through both SMS and voice review flows.
- The mic button remains globally accessible on all tabs (already the case in
  the current tab bar design).
- `expo-av` (or equivalent) is available for audio recording in the Expo managed
  workflow.
- No server-side changes are needed beyond what the existing `parse-voice` Edge
  Function already handles.
