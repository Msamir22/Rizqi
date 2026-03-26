# Implementation Plan: Voice Transaction Infrastructure Refinements

**Branch**: `021-voice-transaction-refinements` | **Date**: 2026-03-26 |
**Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/021-voice-transaction-refinements/spec.md)
**Input**: Feature specification from
`/specs/021-voice-transaction-refinements/spec.md`

## Summary

Harden the voice transaction recording flow with 6 improvements: (1) extract
shared AI parser utils, (2) create dedicated type system with
`ReviewableTransaction` interface, (3) refactor AI voice parser to use proper
types and strict validation, (4) extend Edge Function for original transcript +
language detection, (5) implement empty recording guards and transcript display
in review screen, (6) fix UI/UX issues (FAB visibility, overlay layout, z-index
layering).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) **Primary Dependencies**:
React Native 0.76+, Expo SDK 52, NativeWind v4, Zod, Supabase, Google GenAI
**Storage**: WatermelonDB (local), Supabase/PostgreSQL (cloud) **Testing**:
Jest + React Native Testing Library (existing config in `packages/logic`)
**Target Platform**: Android (iOS future), Supabase Edge Functions (Deno)
**Project Type**: Mobile + API (monorepo) **Performance Goals**: Edge Function
response < 15s (existing SLA), client-side Zod validation < 5ms **Constraints**:
Offline-first (Constitution I), no `any` types (Constitution III)
**Scale/Scope**: 6 GitHub issues, ~15 files modified, ~2 new files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                                     |
| ----------------------------- | ------- | ------------------------------------------------------------------------- |
| I. Offline-First              | ✅ Pass | No change — voice parsing already requires network; results saved locally |
| II. Documented Business Logic | ✅ Pass | Spec covers all rules; language badge is AI-determined                    |
| III. Type Safety              | ✅ Pass | Removing `any`-like patterns; Zod schema tightened; `readonly` enforced   |
| IV. Service-Layer Separation  | ✅ Pass | Utils in `packages/logic`, services in `apps/mobile/services/`            |
| V. Premium UI                 | ✅ Pass | Overlay alignment, z-index fix, language badge UI                         |
| VI. Monorepo Boundaries       | ✅ Pass | Shared utils → `packages/logic`; no reverse imports                       |
| VII. Local-First Migrations   | ✅ Pass | No DB schema changes in this sprint                                       |

**Post-Phase 1 recheck**: ✅ All principles still satisfied. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/021-voice-transaction-refinements/
├── spec.md          # Feature specification
├── plan.md          # This file
├── research.md      # Phase 0: Technical decisions
├── data-model.md    # Phase 1: Entity design
├── quickstart.md    # Phase 1: Getting started
└── tasks.md         # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (affected)

```text
packages/logic/src/
├── types.ts                              # MODIFY — ParsedVoiceTransaction, ReviewableTransaction
├── index.ts                              # MODIFY — export new utils
└── utils/
    ├── ai-parser-utils.ts                # NEW — shared pure functions
    └── __tests__/
        └── ai-parser-utils.test.ts       # NEW — unit tests

apps/mobile/
├── services/
│   ├── ai-voice-parser-service.ts        # MODIFY — use shared utils, new types
│   └── ai-sms-parser-service.ts          # MODIFY — import normalizeType from shared
├── hooks/
│   └── useVoiceTransactionFlow.ts        # MODIFY — empty recording guard
├── components/
│   ├── transaction-review/
│   │   ├── TransactionReview.tsx          # MODIFY — ReviewableTransaction
│   │   ├── TransactionItem.tsx           # MODIFY — ReviewableTransaction
│   │   └── TransactionEditModal.tsx      # MODIFY — ReviewableTransaction
│   ├── voice/
│   │   └── VoiceRecordingOverlay.tsx     # MODIFY — layout alignment
│   ├── tab-bar/
│   │   └── CustomBottomTabBar.tsx        # MODIFY — z-index
│   └── fab/
│       └── QuickActionFab.tsx            # MODIFY — hide during recording
├── app/
│   ├── voice-review.tsx                  # MODIFY — transcript display
│   ├── sms-review.tsx                    # MODIFY — ReviewableTransaction
│   └── (tabs)/
│       └── _layout.tsx                   # MODIFY — pass recording state to FAB

supabase/functions/parse-voice/
└── index.ts                              # MODIFY — original_transcript, detected_language
```

**Structure Decision**: Mobile + API monorepo (existing). No new packages or
structural changes.

## Architecture Decision Records

### ADR-001: Dedicated Voice Transaction Type + Common ReviewableTransaction

**Context**: `ai-voice-parser-service.ts` returns `ParsedSmsTransaction[]` with
dummy SMS fields (`smsBodyHash: ""`, `senderDisplayName: "voice-input"`,
`rawSmsBody: ""`). Meanwhile, `TransactionReview.tsx` is already the generic
component used by both SMS and voice review routes.

**Decision**: Create `ParsedVoiceTransaction` (voice-specific) and
`ReviewableTransaction` (common interface) in `packages/logic/src/types.ts`.
Both `ParsedSmsTransaction` and `ParsedVoiceTransaction` structurally satisfy
`ReviewableTransaction`. The `TransactionReview` component accepts
`ReviewableTransaction[]`.

**Trade-Off Analysis**:

| Approach                                 | Pros                                  | Cons                                                |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| Keep reusing `ParsedSmsTransaction`      | No type migration                     | Misleading field names, unused fields, violates SRP |
| **Dedicated type + common interface** ✅ | Semantically correct, extensible, SRP | Requires prop type changes in 3 components          |
| Separate `VoiceReview` component         | Complete isolation                    | Duplicates 665 lines of review logic                |

**Status**: Accepted | **Date**: 2026-03-26

---

### ADR-002: Shared Utils in `packages/logic`

**Context**: 5 functions duplicated across SMS and Voice parser services (see
[research.md](file:///e:/Work/My%20Projects/Astik/specs/021-voice-transaction-refinements/research.md)
R-005).

**Decision**: Extract `normalizeType`, `VALID_TYPES`, `parseAiDate`,
`clampConfidence`, `parseCategory` into
`packages/logic/src/utils/ai-parser-utils.ts`. Both services import from
`@astik/logic`.

**Trade-Off Analysis**:

| Approach                           | Pros                               | Cons                                                |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Keep duplicates                    | No cross-package changes           | Maintenance burden, inconsistency risk              |
| `apps/mobile/services/shared/`     | Simple refactor                    | Violates monorepo boundary direction (Principle VI) |
| **`packages/logic/src/utils/`** ✅ | Testable, respects boundaries, DRY | Slightly broader import surface                     |

**Status**: Accepted (user confirmed location) | **Date**: 2026-03-26

---

### ADR-003: AI-Determined Language Badge

**Context**: Users can speak in any language. Client needs a language badge for
the "What I Heard" section in the review screen.

**Decision**: Add `original_transcript` and `detected_language` to the Gemini
response schema. The AI determines the language—no client-side detection. Badge
shows AI-returned ISO 639-1 code uppercased (e.g., `"AR"`, `"EN"`, `"FR"`).

**Trade-Off Analysis**:

| Approach                       | Pros                                                    | Cons                                           |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------- |
| Client-side language detection | No server changes                                       | Unreliable, adds bundle size, extra dependency |
| **AI-determined** ✅           | Accurate (Gemini knows what it heard), zero client cost | Requires Edge Function schema update           |
| Hardcode "AR"/"EN"             | Simplest                                                | Doesn't support other languages; user rejected |

**Status**: Accepted | **Date**: 2026-03-26

---

## Proposed Changes

### Component 1: Shared AI Parser Utilities (#159)

#### [NEW] [ai-parser-utils.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/ai-parser-utils.ts)

Pure functions extracted from both parser services:

- `VALID_TYPES` — `ReadonlySet<string>` (`"EXPENSE"`, `"INCOME"`)
- `normalizeType(raw: string): TransactionType` — uppercases + validates,
  defaults to `"EXPENSE"`
- `DATE_ONLY_REGEX` — `/^\d{4}-\d{2}-\d{2}$/`
- `parseAiDate(raw: string): Date` — handles empty, date-only (local TZ), full
  ISO, invalid
- `clampConfidence(score: number): number` — `Math.min(1, Math.max(0, score))`
- `parseCategory(systemName, categoryMap)` — validates AI-returned category
  against `CategoryMap`, falls back to `"other"`

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used:** Utility Module (shared pure functions)
> - **Why:** Eliminates 5 duplicated functions across 2 services; pure functions
>   with no side effects are easily testable.
> - **SOLID Check:** SRP (each function has one concern), DIP (both services
>   depend on abstractions, not each other)
> - **Algorithm Choice:** O(1) `Set.has()` for type/currency validation

#### [NEW] [ai-parser-utils.test.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/__tests__/ai-parser-utils.test.ts)

Unit tests for all shared utilities: `normalizeType`, `parseAiDate`,
`clampConfidence`, `parseCategory`.

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/index.ts)

Add `export * from "./utils/ai-parser-utils";`

---

### Component 2: Type System Refactor (#159)

#### [MODIFY] [types.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/types.ts)

1. Replace outdated `ParsedVoiceTransaction` with voice-specific type:

```diff
-export interface ParsedVoiceTransaction {
-  amount: number;
-  currency: CurrencyType;
-  counterparty?: string;
-  description?: string;
-  detectedCategory?: string | null;
-  confidence: number;
-  isIncome?: boolean;
-  detectedLanguage?: "ar" | "en";
-}
+export interface ReviewableTransaction {
+  readonly amount: number;
+  readonly currency: CurrencyType;
+  readonly type: TransactionType;
+  readonly counterparty: string;
+  readonly date: Date;
+  readonly categoryId: Category["id"];
+  readonly categoryDisplayName: Category["displayName"];
+  readonly confidence: number;
+  readonly accountId?: string;
+}
+
+export interface ParsedVoiceTransaction extends ReviewableTransaction {
+  readonly note: string;
+  readonly originalTranscript: string;
+  readonly detectedLanguage: string;
+}
```

> [!IMPORTANT] `ParsedSmsTransaction` already structurally satisfies
> `ReviewableTransaction`. No changes to `ParsedSmsTransaction` needed.

---

### Component 3: AI Parser Service Refactors (#159, #150, #151)

#### [MODIFY] [ai-voice-parser-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/ai-voice-parser-service.ts)

1. **Import shared utils** from `@astik/logic`
2. **Remove local duplicates** (`normalizeType`, `VALID_TYPES`,
   `DATE_ONLY_REGEX`, `parseAiDate`)
3. **Accept `categories` context** — add `categories: readonly Category[]` to
   `ParseVoiceOptions`
4. **Tighten Zod schema** — remove `.optional().default()` from all 5 required
   fields; add `originalTranscript: z.string()` and
   `detectedLanguage: z.string()`
5. **Validate categories via `parseCategory`** — same pattern as SMS parser
6. **Map to `ParsedVoiceTransaction`** (not `ParsedSmsTransaction`)
7. **Update `ParseVoiceResult`** to
   `{ transactions: ParsedVoiceTransaction[], transcript, originalTranscript, detectedLanguage }`

#### [MODIFY] [ai-sms-parser-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/ai-sms-parser-service.ts)

1. **Import `normalizeType`, `VALID_TYPES`** from `@astik/logic`
2. **Remove local** `normalizeType`, `VALID_TYPES` duplicates
3. Keep SMS-specific logic (`normalizeCurrency`, `parseDate`, `parseCategory` —
   SMS parser's local `parseCategory` is identical to the shared version, so
   replace import)

---

### Component 4: Edge Function Updates (#150, #151)

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/parse-voice/index.ts)

1. **Add to Gemini JSON schema**:
   - `original_transcript` — "The exact text the user spoke in its original
     language. Do NOT translate."
   - `detected_language` — "ISO 639-1 language code of the dominant language
     spoken."
2. **Add both to `required` array**
3. **Harden system prompt** — explicit instruction against hallucination:
   ```diff
   -- If the audio is unclear or non-financial, return an empty transactions array.
   +- If the audio contains silence, background noise, or NO recognizable speech about financial transactions, you MUST return an empty transactions array. Do NOT hallucinate or guess transactions.
   +- Always provide transcript, original_transcript, and detected_language even if no transactions are found.
   ```
4. **Update `AiResponse` interface** and pass through new fields in response

---

### Component 5: Voice Flow & Review Screen (#150, #151)

#### [MODIFY] [useVoiceTransactionFlow.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useVoiceTransactionFlow.ts)

1. **Empty recording guard** — when result has 0 valid transactions:
   ```typescript
   setFlowStatus("error");
   setErrorMessage("We couldn't parse any transaction from the voice note.");
   ```
2. **Pass `originalTranscript` and `detectedLanguage`** in route navigation
   params

#### [MODIFY] [voice-review.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/voice-review.tsx)

1. Accept and display `originalTranscript` with `detectedLanguage` badge
2. Apply RTL writing direction when `detectedLanguage === "ar"`
3. Update type references from `ParsedSmsTransaction` to
   `ParsedVoiceTransaction`

#### [MODIFY] [TransactionReview.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/transaction-review/TransactionReview.tsx)

1. Change props from `ParsedSmsTransaction[]` → `ReviewableTransaction[]`
2. Only use fields present on `ReviewableTransaction` interface

#### [MODIFY] [TransactionItem.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/transaction-review/TransactionItem.tsx)

1. Update props type to `ReviewableTransaction`

#### [MODIFY] [TransactionEditModal.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/transaction-review/TransactionEditModal.tsx)

1. Update props type to `ReviewableTransaction`

#### [MODIFY] [sms-review.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/sms-review.tsx)

1. Cast saved transactions from `ReviewableTransaction` to
   `ParsedSmsTransaction` at the save boundary

---

### Component 6: UI/UX Fixes (#147, #148, #149)

#### [MODIFY] [VoiceRecordingOverlay.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/voice/VoiceRecordingOverlay.tsx)

1. Panel extends to `bottom: 0` with internal `paddingBottom` for safe area
2. Button sizes: "Done" = 56px (prominent), "Pause"/"Discard" = 48px (secondary)
3. Layout order: Status/Timer → Waveform → Progress → Controls

#### [MODIFY] [CustomBottomTabBar.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/tab-bar/CustomBottomTabBar.tsx)

1. Z-index layering: Backdrop(20) < Panel(22) < Tab Bar(25) < Mic Button(30)

#### [MODIFY] [QuickActionFab.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/fab/QuickActionFab.tsx)

1. Accept `isRecordingActive` prop
2. Return `null` when recording is active

#### [MODIFY] [\_layout.tsx](<file:///e:/Work/My%20Projects/Astik/apps/mobile/app/(tabs)/_layout.tsx>)

1. Pass `isRecordingActive={voiceFlow.flowStatus !== "idle"}` to
   `<QuickActionFab />`

---

### Component 7: Test Updates (FR-012)

#### [MODIFY] [ai-voice-parser-service.test.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/__tests__/services/ai-voice-parser-service.test.ts)

1. **Update `makeValidTransaction` helper** — add `originalTranscript`,
   `detectedLanguage` fields; remove SMS-specific fields
2. **Update `makeSuccessResponse` helper** — add `originalTranscript`,
   `detectedLanguage` at response level
3. **Update assertions** referencing `senderDisplayName` (SMS-only, no longer
   present on voice transactions)
4. **Update schema defaults test** — reflect tightened Zod schema (required
   fields no longer have `.optional().default()`)
5. **Add test: `originalTranscript` and `detectedLanguage` are mapped
   correctly**
6. **Add test: `note` field is mapped from AI `description`**
7. **Add test: `categoryId`/`categoryDisplayName` populated by `parseCategory`**
   (when categories context is provided)
8. **Update all type guards** — assertions should check `ParsedVoiceTransaction`
   fields, not `ParsedSmsTransaction`

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used:** Adapter Tests (test helpers adapt to mirror new API
>   contracts)
> - **Why:** Existing 504-line test suite validates critical parsing behavior;
>   must not regress.
> - **SOLID Check:** Tests only reference the public API surface; internal
>   refactors should not change test boundaries.

---

## Execution Order

| Phase | Components                    | Issues           | Dependencies       |
| ----- | ----------------------------- | ---------------- | ------------------ |
| 1     | Shared Utils + Types (C1, C2) | #159             | None — foundation  |
| 2     | Edge Function (C4)            | #150, #151       | None (server-side) |
| 3     | Parser Refactors (C3)         | #159             | C1, C2             |
| 4     | Flow + Review Screen (C5)     | #150, #151, #159 | C2, C3             |
| 5     | UI/UX (C6)                    | #147, #148, #149 | None (independent) |
| 6     | Test Updates (C7)             | #159             | C3, C5             |

## Verification Plan

### Automated Tests

```bash
# Unit tests for shared utilities
cd packages/logic && npx jest --testPathPattern="ai-parser-utils" --verbose

# Unit tests for voice parser service (updated)
cd apps/mobile && npx jest --testPathPattern="ai-voice-parser-service" --verbose

# TypeScript compilation — must pass with zero errors
npm run typecheck
```

### Manual Verification

| Test                       | Issue | Expected Result                                                         |
| -------------------------- | ----- | ----------------------------------------------------------------------- |
| Record silence, tap Done   | #150  | Overlay shows "We couldn't parse any transaction..." with Retry/Discard |
| Record in Arabic, tap Done | #151  | "What I Heard" shows Arabic text with "AR" badge                        |
| Tap mic during recording   | #149  | Tab bar is tappable above overlay panel                                 |
| Check FAB during recording | #147  | FAB is invisible; reappears after recording ends                        |
| Verify overlay layout      | #148  | Panel fills to bottom; Done=56px, Pause/Discard=48px                    |

### TypeScript Reviewer Checklist

- [ ] No `any` types introduced
- [ ] All functions have explicit return types
- [ ] `readonly` on all interface properties
- [ ] `import type` for type-only imports
- [ ] Zod schemas match Edge Function JSON schema exactly
- [ ] No `.optional().default()` on required fields

## Complexity Tracking

No constitution violations to justify. All changes follow established patterns.
