# Feature Specification: Voice Transaction Infrastructure Refinements

**Feature Branch**: `021-voice-transaction-refinements`  
**Created**: 2026-03-26  
**Status**: Approved  
**Input**: GitHub Issues #147, #148, #149, #150, #151, #159 — Refine voice
transaction recording flow: hide FAB during recording, align overlay with
mockup, fix z-index layering, handle empty recordings, show original transcript,
and refactor AI voice parser architecture.

## Clarifications

### Session 2026-03-26

- Q: Should there be a minimum confidence score below which transactions are
  rejected or flagged? → A: Already handled — `TransactionItem` shows "Needs
  Review" badge when `confidence <= 0.8`.
- Q: Should there be a max number of transactions per voice recording? → A: No
  cap — accept all AI-returned transactions.
- Q: How should the system handle unsupported or rare languages? → A: Trust the
  AI. If it parses transactions, accept them. If it can't, it returns empty
  (triggers error state). No language filtering or whitelist.
- Q: Should the ReviewableTransaction refactor include SMS-side changes to
  TransactionReview, TransactionItem, and TransactionEditModal? → A: Yes —
  include in this sprint. Both flows will use the shared `ReviewableTransaction`
  interface.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Empty Recording Guard (Priority: P1)

A user presses the mic button and records audio that contains no recognizable
financial information (background noise, silence, or non-financial speech). The
system must prevent hallucinated transaction data from reaching the Review
screen.

**Why this priority**: If the AI hallucinates transactions from noise, the user
could unknowingly save incorrect financial data — this is a data integrity issue
that directly erodes trust.

**Independent Test**: Tap the mic, record 2 seconds of silence, tap "Done."
Verify the user is shown a "We couldn't parse any transaction from the voice
note" error state in the overlay with "Retry" and "Discard" options, and is NOT
navigated to the Review screen.

**Acceptance Scenarios**:

1. **Given** user has recorded ≤2 seconds of silence, **When** user taps "Done"
   and AI returns 0 transactions, **Then** the overlay displays an error state
   with "We couldn't parse any transaction from the voice note" message, a
   "Retry" button that restarts recording, and a "Discard" button that closes
   the overlay.
2. **Given** user has recorded ambiguous audio, **When** AI returns transactions
   but all fail schema validation, **Then** the system treats the result the
   same as an empty recording (error state in overlay).
3. **Given** user has recorded valid financial speech, **When** AI returns ≥1
   valid transactions, **Then** the system navigates to the Review screen as
   normal.

---

### User Story 2 — AI Voice Parser Architecture Refactor (Priority: P1)

As a developer, I need the AI voice parser service to use its own dedicated type
(`ParsedVoiceTransaction`) instead of reusing `ParsedSmsTransaction`, and share
duplicated utility logic (`normalizeType`, date parsing) via a common module.

**Why this priority**: The current code has type mismatches and duplicated logic
across SMS and Voice parsers, creating maintenance burden and potential
inconsistency bugs. This is foundational — other stories depend on the corrected
types.

**Independent Test**: After refactoring, run `npm run typecheck` with zero
errors. Verify that the Voice parser returns `ParsedVoiceTransaction` objects
and the SMS parser continues to return `ParsedSmsTransaction` objects with no
behavioral changes.

**Acceptance Scenarios**:

1. **Given** the codebase has `ai-voice-parser-service.ts` and
   `ai-sms-parser-service.ts`, **When** I extract shared utilities to
   `ai-parser-utils.ts`, **Then** both services import from the shared module
   and no logic is duplicated.
2. **Given** the voice parser currently returns `ParsedSmsTransaction[]`,
   **When** I create `ParsedVoiceTransaction` with voice-specific fields
   (`note`, `originalTranscript`, `detectedLanguage`) and resolve
   `categorySystemName` via `parseCategory` to `categoryId` +
   `categoryDisplayName`, **Then** all consumers (hook, review screen) use the
   new type without `any` or incorrect casts.
3. **Given** Zod schemas exist for AI response validation, **When** I review the
   schema, **Then** all required fields (`amount`, `type`, `counterparty`) have
   strict validation (no `.optional().default()` on required fields) and the
   schema matches the Edge Function's JSON schema exactly.
4. **Given** AI returns `categorySystemName`, **Then** both SMS and Voice
   parsers validate it against the user's CategoryMap using the same
   `parseCategory` function, producing `categoryId` + `categoryDisplayName`.

---

### User Story 3 — Original Spoken Language Transcript (Priority: P2)

A user records a voice transaction in any language. On the Review screen's "What
I Heard" section, the user should see their original spoken language text
alongside the English translation, with a language badge determined by the AI.

**Why this priority**: Transparency is important for trust — users need to
verify the AI correctly interpreted their speech in their native language before
confirming transactions.

**Independent Test**: Record a voice entry in Arabic, tap "Done." On the Review
screen, verify the "What I Heard" section shows the original Arabic text (RTL)
with an "AR" badge returned by the AI, and the English translation displayed
below.

**Acceptance Scenarios**:

1. **Given** user records in any language, **When** the Review screen loads,
   **Then** the "What I Heard" section displays the original spoken text with a
   language badge determined by the AI's `detected_language` field.
2. **Given** user records in mixed languages (code-switching), **When** the
   Review screen loads, **Then** the transcript preserves the original mixed
   language text with a badge reflecting the dominant language (as determined by
   the AI).
3. **Given** the AI response includes `detected_language`, **Then** the client
   displays the badge directly — no client-side language detection.

---

### User Story 4 — Voice Overlay Visual Alignment (Priority: P2)

The voice recording overlay panel should align with the established design
mockup: the panel extends to the bottom of the screen (behind the tab bar),
control buttons are properly sized and ordered, and the layout includes status
text, waveform, progress bar, and controls in the correct visual hierarchy.

**Why this priority**: The current overlay looks disconnected from the tab bar
and has inconsistent button sizing, which makes the app feel unpolished. Visual
polish directly impacts user confidence.

**Independent Test**: Tap the mic button. Verify the overlay panel fills the
area from the tab bar to the bottom of the screen, the "Done" button is visually
larger (56px) than "Pause" and "Discard" buttons (48px), and the layout order
is: Status/Timer → Waveform → Progress Bar → Controls.

**Acceptance Scenarios**:

1. **Given** user taps the mic button, **When** the overlay appears, **Then**
   the panel extends to `bottom: 0` with internal padding, visually positioned
   behind the tab bar.
2. **Given** the overlay is visible, **When** the user views the control
   buttons, **Then** "Done" button is 56px and visually prominent, while "Pause"
   and "Discard" are 48px secondary buttons.
3. **Given** the overlay is visible, **When** the user views the layout,
   **Then** elements appear in top-to-bottom order: status text + timer →
   waveform visualizer → progress bar → control buttons.

---

### User Story 5 — Z-Index Layering Fix (Priority: P2)

The voice overlay, tab bar, and mic button must layer correctly: the backdrop is
behind everything, the panel sits above the backdrop, the tab bar sits on top of
the panel, and the mic button is the topmost element.

**Why this priority**: Currently the tab bar disappears behind the overlay
panel, making navigation impossible during recording. The mic button (which
serves as "Done") becomes unreachable.

**Independent Test**: Tap the mic to start recording. Verify the tab bar is
visible above the overlay panel, and the mic button is accessible and clickable
on top of everything.

**Acceptance Scenarios**:

1. **Given** voice recording is active, **When** user views the screen, **Then**
   z-index layering is: Backdrop(20) < Panel(22) < Tab Bar(25) < Mic Button(30).
2. **Given** voice recording is active, **When** user taps a tab bar icon,
   **Then** the tab switch works normally (tab bar is not blocked by the
   overlay).
3. **Given** voice recording is active, **When** user taps the mic button,
   **Then** the mic button responds (is not blocked by any overlay element).

---

### User Story 6 — Hide FAB During Voice Recording (Priority: P3)

When the user starts a voice recording session, the floating action button
(QuickActionFab) should be hidden to prevent visual clutter and accidental
interactions.

**Why this priority**: Lower priority because the FAB doesn't critically block
recording functionality, but it creates visual noise and potential confusion.
Simple to implement.

**Independent Test**: Tap the mic button. Verify the QuickActionFab
(bottom-right "+" button) disappears immediately. Stop recording and verify it
reappears.

**Acceptance Scenarios**:

1. **Given** voice recording is idle, **When** user views any tab screen,
   **Then** the QuickActionFab is visible at its standard position.
2. **Given** user taps the mic button to start recording, **When** the overlay
   appears, **Then** the QuickActionFab fades out or is immediately hidden.
3. **Given** user discards or submits the recording, **When** the overlay
   closes, **Then** the QuickActionFab reappears.

---

### Edge Cases

- What happens when the AI service is unreachable during voice submission? → The
  existing timeout/network error handling surfaces an error state in the
  overlay. No behavioral change needed.
- What happens when the user records audio containing both financial and
  non-financial speech? → AI extracts only the financial transactions;
  non-financial parts appear in the transcript.
- What happens with very long recordings (>60 seconds)? → The existing auto-stop
  at `MAX_RECORDING_DURATION` handles this. No change needed.
- What happens if the Edge Function returns `original_transcript` but old mobile
  clients don't expect it? → The field is additive (optional). Old clients
  ignore it. No backward compatibility issue.
- What happens when the user taps a tab during recording? → Tab switch should
  work (Story 5 ensures the tab bar is above the overlay panel).
- What happens if the user mentions many transactions in one recording (e.g.
  10+)? → No cap. All AI-returned transactions appear in Review; the user
  selects which to save.
- What happens if the user speaks in a language Gemini can't reliably parse
  (e.g. Mandarin)? → Trust the AI. If it can parse, accept. If not, empty result
  triggers the error state. No language whitelist.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST validate AI-returned transactions before navigating to
  the Review screen. If zero valid transactions are returned, the overlay MUST
  display an error state with "Retry" and "Discard" options.
- **FR-002**: System MUST use a dedicated `ParsedVoiceTransaction` type for
  voice-parsed transactions, distinct from `ParsedSmsTransaction`.
- **FR-003**: System MUST extract shared AI parsing utilities (`normalizeType`,
  `parseAiDate`, `clampConfidence`, `parseCategory`) into a single
  `ai-parser-utils.ts` module used by both SMS and Voice parsers. Note:
  `normalizeCurrency` is SMS-specific and remains in `ai-sms-parser-service.ts`.
- **FR-004**: The AI Edge Function MUST return `transcript` (English
  translation), `original_transcript` (original spoken language), and
  `detected_language` (ISO 639-1 language code) in the response payload.
- **FR-005**: The Review screen's "What I Heard" section MUST display the
  original spoken language text with a language badge sourced from the AI's
  `detected_language` field (not client-side detection).
- **FR-006**: The voice recording overlay MUST extend to `bottom: 0` of the
  screen with the tab bar rendered above it.
- **FR-007**: Z-index layering during recording MUST follow: Backdrop(20) <
  Panel(22) < Tab Bar(25) < Mic Button(30).
- **FR-008**: The QuickActionFab MUST be hidden when voice recording is active
  (flowStatus is not "idle").
- **FR-009**: Zod validation schemas for AI responses MUST match the Edge
  Function's JSON response schema exactly — required fields MUST NOT have
  `.optional().default()` modifiers.
- **FR-010**: The AI Edge Function prompt MUST be hardened to explicitly
  instruct: "If the audio contains silence, background noise, or no recognizable
  speech about financial transactions, return an empty transactions array."
- **FR-011**: The `TransactionReview`, `TransactionItem`, and
  `TransactionEditModal` components MUST be refactored to accept
  `ReviewableTransaction` (common interface) instead of `ParsedSmsTransaction`.
  Both SMS and Voice flows MUST use the shared components.
- **FR-012**: All existing unit tests for touched services MUST be updated to
  match the refactored interfaces and behavior. Specifically,
  `ai-voice-parser-service.test.ts` MUST be updated to validate
  `ParsedVoiceTransaction` output (not `ParsedSmsTransaction`), reflect
  tightened Zod schema (no `.optional().default()` on required fields), and
  include new fields (`originalTranscript`, `detectedLanguage`, `note`).

### Key Entities

- **ParsedVoiceTransaction**: Voice-specific parsed transaction with fields:
  `amount`, `currency`, `type`, `counterparty`, `note`, `categoryId`,
  `categoryDisplayName`, `accountId`, `date`, `confidenceScore`,
  `originalTranscript`, `detectedLanguage`.
- **ReviewableTransaction**: Common interface shared by `ParsedSmsTransaction`
  and `ParsedVoiceTransaction`, used by the generic `TransactionReview`
  component.
- **VoiceParserError**: Structured error type with `kind` ("timeout" | "network"
  | "empty" | "unknown") and `message`.
- **VoiceFlowStatus**: State machine states: "idle" | "recording" | "paused" |
  "analyzing" | "error".

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero hallucinated transactions reach the Review screen when the
  user records silence or non-financial audio.
- **SC-002**: The `ai-voice-parser-service.ts` and `ai-sms-parser-service.ts`
  share 100% of common utility logic via `ai-parser-utils.ts`, with zero
  duplicated helper functions.
- **SC-003**: TypeScript compilation (`npm run typecheck`) passes with zero
  errors after the refactor.
- **SC-004**: The voice recording overlay, tab bar, and mic button layer
  correctly with no z-index conflicts on both iOS and Android.
- **SC-005**: The "What I Heard" section displays the original spoken language
  with the correct AI-determined language badge for 100% of recordings.
- **SC-006**: The QuickActionFab is invisible during the entire voice recording
  session and reappears immediately after the session ends.
- **SC-007**: All existing unit tests pass after the refactor.
  `ai-voice-parser-service.test.ts` updated to validate `ParsedVoiceTransaction`
  output with zero test failures.

## Assumptions

- The existing `useVoiceTransactionFlow` hook's state machine (idle → recording
  → paused → analyzing → error/idle) is sound and does not need structural
  changes — only guard additions.
- The `parse-voice` Edge Function already supports retry with exponential
  backoff; no reliability changes are needed on the server side.
- The `VoiceRecordingOverlay` component's animation library
  (`react-native-reanimated`) is already configured and working.
- Gemini 2.5 Flash-Lite supports returning `original_transcript` alongside
  `transcript` without model changes — this is purely a prompt/schema update.
- The existing `VALID_TYPES` set `["EXPENSE", "INCOME"]` is complete and will
  not need `TRANSFER` support in this sprint.
