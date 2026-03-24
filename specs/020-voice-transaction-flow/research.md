# Phase 0 Research: Voice Transaction Flow

**Branch**: `020-voice-transaction-flow` | **Date**: 2026-03-23

## Research 1: Audio Recording Library

**Decision**: Use `expo-audio` for raw audio recording.

**Rationale**:

- `expo-av` is **deprecated** and slated for removal in SDK 54
- `expo-audio` is the official Expo replacement, same team maintains it
- Provides `useAudioRecorder` hook for lifecycle management
- Supports configurable format, quality, sample rate
- Background recording support with config plugin

**Alternatives Considered**:

- `expo-speech-recognition` (already installed) — On-device STT only, doesn't
  produce raw audio files. User rejected this approach due to poor Arabic
  support.
- `react-native-audio-recorder-player` — Deprecated in favor of
  `react-native-nitro-sound`.
- `@siteed/expo-audio-studio` — Third-party, overkill for simple recording.

---

## Research 2: parse-voice Edge Function Alignment

**Decision**: Enhance `parse-voice` to accept `categories`, `accounts`, and
`preferredCurrency` from the client, matching `parse-sms` patterns.

**Rationale**:

- `parse-sms` already accepts dynamic `categories` and `supportedCurrencies`
  from client (lines 292-293, 471-474)
- `parse-voice` uses a static CATEGORY_TREE and a hardcoded currency enum with a
  TODO comment
- The category tree format differs: parse-sms uses L1/L2 hierarchy syntax,
  parse-voice uses flat format
- parse-sms has retry/backoff logic; parse-voice has none
- User explicitly requested: currency from user preferences, categories reuse,
  and account matching

**Changes Required to parse-voice**:

1. Accept `categories` string from client (fall back to embedded tree)
2. Accept `accounts` array (name + ID pairs) for AI account matching
3. Accept `preferredCurrency` from client — remove currency from AI schema
4. Align CATEGORY_TREE with parse-sms format (L1/L2 hierarchy)
5. Copy categorization instructions from parse-sms (no `*_other`, L1 fallback)
6. Add retry/backoff with same constants as parse-sms
7. Return `transcript` string alongside transactions
8. Return `accountId` per transaction for matched accounts

---

## Research 3: TransactionReview Component Reusability

**Decision**: Refactor `SmsTransactionReview` → `TransactionReview` with a
`source` prop.

**Rationale**:

- SmsTransactionReview (665 lines) manages: filter pills, search bar,
  date-grouped list, select all/deselect, summary bar, save/discard actions,
  category correction
- All of this is directly applicable to voice transactions
- Both SMS and voice parsers output `ParsedSmsTransaction[]`
- SMS-specific features to conditionally handle: `isAtmWithdrawal`, `cardLast4`,
  `sms-account-matcher` (card-based matching)

**Adaptation Plan**:

- Add `source: "sms" | "voice"` prop
- Conditionally hide card-based account matching for voice (`cardLast4`,
  `isAtmWithdrawal`)
- Add optional `transcript` prop for voice-specific transcript card
- Add optional `onRetry` callback for voice re-recording
- Account matching for voice: use AI-returned `accountId` instead of card
  matching

---

## Research 4: Recording Overlay vs Full-Page Navigation

**Decision**: Replace full-page `/voice-input` route with a bottom-sheet overlay
component.

**Rationale**:

- Current `voice-input.tsx` (549 lines) navigates to a full separate page
- User approved mockup requires in-place overlay above tab bar
- The tab bar mic button currently calls `router.push("/voice-input")` (line 57
  of CustomBottomTabBar)
- New approach: mic button toggles a `VoiceRecordingOverlay` component rendered
  in the tab layout
- Existing `voice-input.tsx` becomes obsolete and should be removed after
  migration

---

## Research 5: Audio Format for AI Submission

**Decision**: Record in M4A (AAC) format for optimal compression and
compatibility.

**Rationale**:

- Gemini supports: mp3, wav, ogg, webm, m4a
- expo-audio supports configurable output format
- M4A (AAC) provides best compression-to-quality ratio for voice
- parse-voice already detects MIME type from bytes (line 237-251)
- Max file size limit in parse-voice: 5MB (sufficient for 60s of AAC audio)
