# Implementation Plan: Voice Transaction Recording Flow

**Branch**: `020-voice-transaction-flow` | **Date**: 2026-03-24 (updated
post-clarify) **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/020-voice-transaction-flow/spec.md)
**Research**:
[research.md](file:///e:/Work/My%20Projects/Astik/specs/020-voice-transaction-flow/research.md)
**Data Model**:
[data-model.md](file:///e:/Work/My%20Projects/Astik/specs/020-voice-transaction-flow/data-model.md)

## Summary

Implement a WhatsApp-style in-place voice recording overlay and AI-powered
transaction parsing flow. The user taps the mic button → records up to 60
seconds → audio is sent to an enhanced `parse-voice` edge function → parsed
transactions appear in a refactored `TransactionReview` screen for editing and
saving.

## Technical Context

**Language/Version**: TypeScript (strict mode) **Primary Dependencies**:
`expo-audio` (NEW — install), `react-native-reanimated`, Supabase Edge
Functions, Gemini 2.5 Flash-Lite **Storage**: WatermelonDB (existing
`transactions` table — no schema changes) **Testing**: Jest + React Native
Testing Library (existing setup in `apps/mobile/__tests__/`) **Target
Platform**: iOS + Android (Expo managed workflow) **Project Type**: Mobile
(monorepo: `apps/mobile`, `packages/logic`, `packages/db`) **Performance
Goals**: <500ms overlay open, <15s total recording+analysis, <200ms control
response **Constraints**: Offline-first (recording works offline, AI requires
network), 60s max recording, 5MB max audio

## Constitution Check

_GATE: Must pass before implementation._

| Principle                     | Status  | Notes                                                                                                            |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| I. Offline-First              | ✅ PASS | Recording is local. AI requires network (documented in spec FR-020). Saved transactions go through WatermelonDB. |
| II. Documented Business Logic | ✅ PASS | Spec defines all business rules. Will update `business-decisions.md` with voice transaction rules.               |
| III. Type Safety              | ✅ PASS | All new code will use strict TypeScript, zod for API response validation, explicit return types.                 |
| IV. Service-Layer Separation  | ✅ PASS | `ai-voice-parser-service.ts` (service layer) → hooks for React lifecycle → components for UI only.               |
| V. Premium UI                 | ✅ PASS | Animated waveform, pulse mic, progress bar, Tailwind styling per constitution.                                   |
| VI. Monorepo Boundaries       | ✅ PASS | No cross-boundary violations. Service in `apps/mobile/services/`, types in `@astik/logic`.                       |
| VII. Local-First Migrations   | ✅ PASS | No DB schema changes required.                                                                                   |

---

## Proposed Changes

### Phase 1: Edge Function Enhancement (`parse-voice`)

> **Why first**: All other work depends on the AI being able to accept
> categories, accounts, and return transcript + accountId.

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/parse-voice/index.ts)

1. **Accept dynamic inputs from client**:
   - `categories` (string) — category tree, fall back to embedded CATEGORY_TREE
   - `accounts` (JSON array of `{id, name}`) — for AI account matching
   - `preferredCurrency` (string) — passed through, NOT used by AI

2. **Align CATEGORY_TREE** with `parse-sms` L1/L2 hierarchy format

3. **Copy categorization instructions** from `parse-sms`:
   - Use specific L2 only when confident
   - Never use `*_other` categories, fall back to L1 parent
   - `other` as absolute last resort

4. **Update system prompt** to include account matching:
   - AI receives account names, returns matched `accountId`
   - If no match or no account mentioned → return `null`

5. **Remove `currency` from AI response schema** — currency set client-side

6. **Add `transcript` to response**: AI returns text interpretation alongside
   transactions

7. **Add retry/backoff** matching parse-sms (3 retries, 2s/4s/8s exponential
   backoff)

8. **Add `confidenceScore`** per transaction (matching parse-sms pattern)

9. **Add date extraction to system prompt** (FR-022): AI extracts relative
   dates/times ("yesterday", "last Friday") and returns a parsed date per
   transaction. If no date mentioned, return `null` (client defaults to current
   timestamp).

10. **Handle missing counterparty** (FR-023): System prompt instructs AI to
    return empty string for counterparty when not mentioned.

---

### Phase 2: Install `expo-audio` + Recording Hook

#### [NEW] Install `expo-audio` dependency

```bash
npx expo install expo-audio
```

#### [NEW] [useVoiceRecorder.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useVoiceRecorder.ts)

Custom hook encapsulating recording lifecycle:

- `startRecording()` → initializes `expo-audio` recorder with M4A format
- `pauseRecording()` / `resumeRecording()`
- `stopRecording()` → returns `{ uri, durationMs }`
- `discardRecording()` → cleans up temp file (FR-021: local audio MUST be
  deleted)
- Auto-stop at 60 seconds (does NOT auto-submit)
- **Temp file cleanup** (FR-021): delete audio file after submission or on
  discard. Also cleanup on app restart if stale files remain.
- Tracks state: `idle | recording | paused | completed`
- Returns
  `{ status, durationMs, audioLevels, start, pause, resume, stop, discard }`

---

### Phase 3: Recording Overlay Component

#### [NEW] [VoiceRecordingOverlay.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/voice/VoiceRecordingOverlay.tsx)

Bottom-sheet overlay showing:

- Timer (MM:SS format)
- Audio waveform visualization (using `react-native-reanimated`)
- Progress bar (0% → 100% of 60s) with "0s / 60s" label
- Three control buttons: Discard (X), Pause (⏸) / Resume (▶), Done (■)
- Dimmed backdrop behind overlay

Props: `visible`, `onSubmit(audioUri)`, `onDiscard()`

#### [NEW] [WaveformVisualizer.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/voice/WaveformVisualizer.tsx)

Animated waveform bars driven by audio metering data from `useVoiceRecorder`.

---

### Phase 4: Update Client Service Layer

#### [MODIFY] [ai-voice-parser-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/ai-voice-parser-service.ts)

1. **Accept new parameters**: `categories`, `accounts`, `preferredCurrency`
2. **Send categories and accounts** via FormData alongside audio
3. **Set currency client-side** from `preferredCurrency` (remove AI currency
   normalization)
4. **Parse `transcript`** from response and return it alongside transactions
5. **Map `accountId`** from AI response to `ParsedSmsTransaction`
6. **Update zod schema** to include `accountId`, `date` (optional), and remove
   `currency`
7. **Return type**:
   `{ transactions: ParsedSmsTransaction[], transcript: string }`
8. **Map AI date** (FR-022): If AI returns a date, use it; otherwise default to
   `new Date()`
9. **Handle empty counterparty** (FR-023): If AI returns empty string, pass
   through as-is
10. **Enforce 30s client-side timeout** (FR-024): Use `AbortController` with 30s
    timeout. On timeout, cancel request and return error with retry option.

---

### Phase 5: Refactor TransactionReview Component

#### [MODIFY] [SmsTransactionReview.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionReview.tsx) → rename to `TransactionReview.tsx`

1. **Add `source` prop**: `"sms" | "voice"`
2. **Add `transcript` prop** (optional): displayed in a card at top for voice
   source
3. **Add `onRetry` prop** (optional): "Retry" button for voice re-recording
4. **Conditionally hide SMS-specific features** when `source === "voice"`:
   - Card-based account matching (`cardLast4`, `isAtmWithdrawal`)
   - SMS account matcher calls
5. **For voice**: use AI-returned `accountId` for account assignment instead of
   card matching
6. **Update title/header** to be source-aware ("Review Voice Transactions" vs
   "Review SMS Transactions")
7. **Update import paths** in all consumers of old `SmsTransactionReview`

#### [MODIFY] Related files:

- [SmsTransactionItem.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionItem.tsx)
  — conditionally hide SMS-specific badges
- [SmsTransactionEditModal.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionEditModal.tsx)
  — rename to `TransactionEditModal.tsx`

---

### Phase 6: Tab Bar + Voice Flow Integration

#### [MODIFY] [CustomBottomTabBar.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/tab-bar/CustomBottomTabBar.tsx)

1. Change `handleMicPress` from `router.push("/voice-input")` to toggling
   overlay visibility
2. Add pulse animation on mic button while recording is active

#### [NEW] [voice-review.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/voice-review.tsx)

New route for the voice transaction review screen. Uses `TransactionReview` with
`source="voice"`.

- **Post-save navigation** (from clarification Q3): After saving, navigate back
  to the tab the user was on before tapping mic. Pass the origin tab index via
  route params.

#### [DELETE] [voice-input.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/voice-input.tsx)

The old full-page voice input screen is replaced by the overlay + review flow.
Delete after migration is complete.

---

### Phase 7: State Management & Error Handling

#### [NEW] [useVoiceTransactionFlow.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useVoiceTransactionFlow.ts)

Orchestrator hook managing the full flow:

1. Recording state (via `useVoiceRecorder`)
2. AI submission state (`idle | analyzing | success | error`)
3. Network connectivity check before submission
4. Error messages (network required, no transactions found, AI error, **30s
   timeout** per FR-024)
5. Navigation to review screen on success

---

## Project Structure

### Documentation

```text
specs/020-voice-transaction-flow/
├── spec.md              ✅ Created
├── research.md          ✅ Created (Phase 0)
├── data-model.md        ✅ Created (Phase 1)
├── plan.md              ✅ This file
├── mockups/
│   ├── recording-overlay.png  ✅ Stored
│   └── transaction-review.png ✅ Stored
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
supabase/functions/parse-voice/
└── index.ts                          # MODIFY — Phase 1

apps/mobile/
├── hooks/
│   ├── useVoiceRecorder.ts           # NEW — Phase 2
│   └── useVoiceTransactionFlow.ts    # NEW — Phase 7
├── components/
│   ├── voice/
│   │   ├── VoiceRecordingOverlay.tsx  # NEW — Phase 3
│   │   └── WaveformVisualizer.tsx     # NEW — Phase 3
│   ├── sms-sync/ → transaction-review/  # RENAME folder
│   │   ├── TransactionReview.tsx      # RENAME+MODIFY — Phase 5
│   │   ├── TransactionItem.tsx        # RENAME — Phase 5
│   │   └── TransactionEditModal.tsx   # RENAME — Phase 5
│   └── tab-bar/
│       └── CustomBottomTabBar.tsx     # MODIFY — Phase 6
├── services/
│   └── ai-voice-parser-service.ts    # MODIFY — Phase 4
├── app/
│   ├── voice-review.tsx              # NEW — Phase 6
│   └── voice-input.tsx               # DELETE — Phase 6
└── __tests__/
    └── services/
        └── ai-voice-parser-service.test.ts  # NEW — Verification
```

## Complexity Tracking

No constitution violations. All principles pass.

---

## Verification Plan

### Automated Tests

#### 1. Unit Tests: `ai-voice-parser-service.ts`

**File**: `apps/mobile/__tests__/services/ai-voice-parser-service.test.ts` (NEW)

**Run**:
`npx jest --config apps/mobile/jest.config.js --testPathPattern="ai-voice-parser" --verbose`

**Covers**:

- Response mapping with currency from `preferredCurrency` (not AI)
- `accountId` mapping from AI response
- Date mapping from AI response (relative dates → Date objects, null → now)
- Empty counterparty pass-through
- Zod validation filtering malformed entries
- Transcript extraction
- Error handling (network failure, empty response, invalid JSON)
- 30-second timeout behavior (AbortController)

#### 2. Unit Tests: `useVoiceRecorder` hook

**File**: `apps/mobile/__tests__/hooks/useVoiceRecorder.test.ts` (NEW)

**Run**:
`npx jest --config apps/mobile/jest.config.js --testPathPattern="useVoiceRecorder" --verbose`

**Covers**:

- State transitions (idle → recording → paused → completed)
- Auto-stop at 60 seconds
- Discard cleanup (temp file deletion per FR-021)
- Duration tracking

### Manual Verification (User)

> [!IMPORTANT] These tests require running the app on a real device or emulator
> with microphone access.

#### Test 1: Recording Overlay Flow

1. Open the app on Android
2. Tap the mic button on the tab bar
3. **Verify**: overlay slides up above the tab bar, current screen is dimmed
   behind
4. Speak something for 5 seconds
5. **Verify**: timer counts up, waveform animates, progress bar advances
6. Tap Pause → **Verify**: waveform freezes, timer pauses, Pause becomes Resume
7. Tap Resume → **Verify**: recording continues
8. Tap Done → **Verify**: loading state appears ("Analyzing your voice...")

#### Test 2: AI Parsing & Review

1. Record a voice saying "I spent 50 pounds on coffee from Starbucks"
2. Tap Done
3. **Verify**: review screen shows 1 transaction, amount 50, category
   coffee_tea, counterparty Starbucks
4. **Verify**: transcript card shows the AI interpretation
5. **Verify**: currency is user's preferred currency (EGP), NOT determined by AI
6. Tap save → **Verify**: transaction appears in transactions list AND user
   returns to the tab they were on before tapping mic

#### Test 3: Account Matching

1. Record saying "I paid 200 from my CIB account for groceries"
2. **Verify**: if user has an account named "CIB", it is auto-selected
3. **Verify**: if no matching account, default account is used

#### Test 4: Max Duration & Edge Cases

1. Start recording and wait 60 seconds
2. **Verify**: recording auto-stops but does NOT auto-submit
3. **Verify**: user can still choose Done or Discard
4. Tap Discard → **Verify**: overlay closes, no data sent

#### Test 5: Network Error

1. Enable airplane mode
2. Record and tap Done
3. **Verify**: friendly error "Network connection is required to analyze your
   voice note using AI"

#### Test 6: Date Extraction (FR-022)

1. Record saying "Yesterday I spent 100 on lunch"
2. **Verify**: the parsed transaction date is yesterday's date, not today

#### Test 7: 30s Timeout (FR-024)

1. Simulate slow network (throttle to very slow connection)
2. Record and tap Done
3. After 30 seconds, **Verify**: error message appears with retry option

#### Test 8: Empty Counterparty (FR-023)

1. Record saying "I spent 50 on groceries" (no merchant name)
2. **Verify**: counterparty field is empty, user can fill it in during review
