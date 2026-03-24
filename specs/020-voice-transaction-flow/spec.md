# Feature Specification: Voice Transaction Recording Flow (WhatsApp-style)

**Feature Branch**: `020-voice-transaction-flow`  
**Created**: 2026-03-19  
**Updated**: 2026-03-23  
**Status**: Draft (Rev 2 — post-review)  
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
3. **Given** the recording overlay is visible, **Then** the user sees a clear
   indication that the maximum recording duration is 1 minute (e.g., progress
   bar labeled "0s / 60s").
4. **Given** the user is recording, **When** they tap the "Done" button,
   **Then** the recording stops AND the audio file is submitted for AI analysis.
5. **Given** the user is recording, **When** they tap the "Pause" button,
   **Then** the recording pauses AND the waveform freezes AND the timer pauses
   AND the Pause button becomes a "Resume" button.
6. **Given** the recording is paused, **When** the user taps "Resume", **Then**
   the recording continues from where it left off.
7. **Given** the user is recording, **When** they tap the "Discard" (X) button,
   **Then** the recording is cancelled AND the overlay closes AND no data is
   sent.
8. **Given** the user is recording, **When** the timer reaches 60 seconds,
   **Then** the recording automatically stops (NOT auto-submitted). The user
   remains on the overlay and must explicitly choose "Done" to submit or
   "Discard" to cancel.

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
6. **Given** the AI parses transactions, **Then** the currency for each
   transaction defaults to the user's preferred currency (not detected by AI
   from voice). The AI does NOT determine the currency.
7. **Given** the app sends a request to the AI, **Then** it includes the user's
   category list (same format as parse-sms) and the user's account list (account
   names + IDs) so the AI can match categories and accounts.
8. **Given** the user mentions an account name in their voice (e.g., "from my
   CIB account"), **When** the AI parses this, **Then** it matches the spoken
   account name to the provided account list and returns the account ID. If no
   match or no account mentioned, the transaction is linked to the user's
   default account.

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
   database AND the user is navigated back to the tab they were on before
   tapping the mic button.
6. **Given** the review screen is visible, **When** the user taps "Discard All",
   **Then** all transactions are discarded AND the user returns to their
   previous screen.
7. **Given** the review screen is visible, **When** the user taps "Retry",
   **Then** the user is taken back to the recording overlay to re-record.
8. **Given** the review screen is visible (regardless of theme mode), **Then**
   it shows the AI-generated transcript card with the text interpretation of the
   user's speech.

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

- What happens when the user taps the mic button while already recording? → The
  recording overlay remains visible and brings focus to the overlay.
- What happens when the app goes to background during recording? → The recording
  pauses automatically and can be resumed when the app returns to foreground. If
  the app stays in background for more than 2 minutes, the recording is
  discarded.
- What happens when the network is unavailable during AI analysis? → The user
  sees a friendly error message: "Network connection is required to analyze your
  voice note using AI. Please check your connection and try again." No offline
  retry queue — the user must re-record or return later.
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
  automatically stopping recording when the limit is reached BUT NOT
  auto-submitting. The user must explicitly choose to submit or discard.
- **FR-005**: System MUST display a real-time timer (MM:SS format), audio
  waveform visualization, and a clear indication of the 1-minute max duration
  during recording.
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
  transcript card at the top of the review screen, regardless of the theme mode.
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
- **FR-017**: System MUST default the transaction currency to the user's
  preferred currency. The AI MUST NOT determine the currency from voice.
- **FR-018**: System MUST send the user's category list and account list
  (names + IDs) to the AI service so the AI can match categories and accounts
  from voice input.
- **FR-019**: If the user mentions an account by name, the AI MUST match it to
  the provided account list and return the corresponding account ID. If no match
  or no account mentioned, the system MUST link the transaction to the user's
  default account.
- **FR-020**: When the network is unavailable, the system MUST show a friendly
  error explaining that AI analysis requires a network connection. No offline
  retry queue.
- **FR-021**: Audio data MUST NOT be stored server-side. The edge function
  processes audio in-memory via Gemini and discards it. The local temporary
  audio file MUST be deleted from the device after submission (or on discard).
- **FR-022**: The AI MUST extract relative dates/times from voice input (e.g.,
  "yesterday", "last Friday") and return a parsed date. If no date/time is
  mentioned, the transaction date defaults to the current timestamp.
- **FR-023**: If the user does not mention a merchant or counterparty in their
  voice, the AI MUST return an empty string for the counterparty field. The user
  can optionally fill it in during review.
- **FR-024**: The client MUST enforce a 30-second timeout for the AI analysis
  request. If the AI does not respond within 30 seconds, the system MUST cancel
  the request and show an error with a retry option.

### Key Entities

- **Voice Recording**: A temporary audio file captured from the device
  microphone; associated with a recording session, duration, and status
  (recording, paused, completed, discarded).
- **Parsed Voice Transaction**: A structured financial entry extracted by AI
  from the audio; includes amount, transaction type (expense/income),
  merchant/description, detected category (system_name), and matched account ID.
  Currency is set by the client to the user's preferred currency, not by the AI.
- **AI Transcript**: The text interpretation of the user's speech as generated
  by the AI service; displayed in the review screen for user context.

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

## Assumptions (Verified)

| #   | Assumption                                                                                                      | Verified? | Actual Status                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The AI Edge Function `parse-voice` already supports audio file input (multipart form data)                      | ✅ Yes    | Confirmed in `supabase/functions/parse-voice/index.ts` lines 280–296                                                                                                                                                                                                                                                                                                                                                |
| 2   | `SmsTransactionReview` and sub-components can be renamed/refactored to `TransactionReview` with a `source` prop | ✅ Yes    | Components use `ParsedSmsTransaction` which the voice parser already maps to                                                                                                                                                                                                                                                                                                                                        |
| 3   | The AI voice parser already maps results to `ParsedSmsTransaction[]`                                            | ✅ Yes    | Confirmed in `apps/mobile/services/ai-voice-parser-service.ts` lines 172–188                                                                                                                                                                                                                                                                                                                                        |
| 4   | The mic button remains globally accessible on all tabs                                                          | ✅ Yes    | Already in `CustomBottomTabBar.tsx`                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | `expo-audio` is available for audio recording                                                                   | ❌ No     | NOT installed. Only `expo-speech-recognition` is installed, which does on-device STT, not raw audio recording. **Need to install `expo-audio`** (`expo-av` is deprecated and removed in SDK 54)                                                                                                                                                                                                                     |
| 6   | No server-side changes are needed                                                                               | ❌ No     | **Several enhancements needed to `parse-voice` edge function**: (a) Accept categories from client like parse-sms does, (b) Accept account list for account matching, (c) Remove currency detection — currency set client-side, (d) Return transcript text, (e) Align CATEGORY_TREE format with parse-sms's L1/L2 hierarchy, (f) Add retry/backoff like parse-sms, (g) Reuse parse-sms's categorization instructions |

## Clarifications

### Session 2026-03-24

- Q: What happens to audio data after AI analysis? → A: Audio is never stored
  server-side. Processed in-memory only by Gemini. Local temp file is deleted
  after submission.
- Q: Should the AI extract dates from voice or default to current timestamp? →
  A: AI extracts relative dates ("yesterday", "last Friday") when mentioned.
  Defaults to current timestamp if no date mentioned.
- Q: Where does the user navigate after saving voice transactions? → A: Back to
  the tab the user was on before tapping the mic button.
- Q: What if the user doesn't mention a counterparty? → A: AI returns empty
  string. User can fill it in during review.
- Q: Should there be a client-side AI timeout? → A: Yes, 30 seconds. Cancel and
  show error with retry option.
