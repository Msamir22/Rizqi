# Research: Voice Transaction Infrastructure Refinements

**Branch**: `021-voice-transaction-refinements` | **Date**: 2026-03-26

## R-001: Shared AI Parser Utils Placement

**Decision**: Place shared utilities in
`packages/logic/src/utils/ai-parser-utils.ts`

**Rationale**: Constitution Principle VI (Monorepo Package Boundaries) says
`packages/logic` holds shared business logic. Both parsers use `normalizeType`,
`VALID_TYPES`, `parseAiDate`, `clampConfidence`, and `parseCategory`. These are
pure functions with no mobile-specific dependencies (no WatermelonDB, no
Supabase client, no React).

**Alternatives Considered**:

- `apps/mobile/services/shared/` — violates package boundary direction (both
  parsers are in `apps/mobile/services/`, but shared logic belongs in
  `packages/`)
- `packages/logic/src/parsers/` — already contains the legacy `voice-parser.ts`;
  mixing concerns

---

## R-002: ReviewableTransaction Interface Design

**Decision**: Create a minimal `ReviewableTransaction` interface that
`TransactionReview`, `TransactionItem`, and `TransactionEditModal` accept. Both
`ParsedSmsTransaction` and `ParsedVoiceTransaction` structurally satisfy it.

**Rationale**: `TransactionReview.tsx` (665 lines) already works for both flows
— `sms-review.tsx` and `voice-review.tsx` are thin route wrappers. The component
only uses a subset of fields: `amount`, `currency`, `type`, `counterparty`,
`date`, `categoryId`, `categoryDisplayName`, `confidence`, `accountId`.
SMS-specific fields (`smsBodyHash`, `rawSmsBody`, `isAtmWithdrawal`,
`cardLast4`) are only needed at the route-level save boundary.

**Alternatives Considered**:

- Keep `ParsedSmsTransaction` and add voice fields to it — violates SRP,
  misleading semantics
- Create separate `VoiceReview` component — duplicates 665 lines of review logic

---

## R-003: Edge Function Schema Extension Strategy

**Decision**: Add `original_transcript` and `detected_language` to the Gemini
JSON response schema as required fields. This is additive — existing
`transcript` field stays.

**Rationale**: Gemini 2.5 Flash-Lite supports arbitrary schema. The new fields
complement `transcript` (which is always English). Client-side: old clients
ignore unknown fields. The `detected_language` is an ISO 639-1 code determined
by the AI — no client-side language detection needed.

**Alternatives Considered**:

- Client-side language detection (via regex or library) — unreliable, adds
  bundle size
- Return language from separate endpoint — unnecessary round-trip

---

## R-004: Voice Parser Zod Schema Strictness

**Decision**: Remove `.optional().default()` from required fields in
`AiVoiceTransactionSchema`. Only truly optional fields (with explicit AI
fallback) use `.optional()`.

**Rationale**: The current schema has
`categorySystemName: z.string().optional().default("")` — but the Edge Function
schema marks `categorySystemName` as required. This mismatch means malformed
responses silently pass validation instead of being caught and logged. FR-009
explicitly prohibits this pattern.

**Fields analysis**: | Field | Edge Function | Current Zod | Fix |
|---|---|---|---| | `amount` | required | `z.number()` | ✅ Correct | | `type` |
required | `z.string()` | ✅ Correct | | `counterparty` | required |
`z.string()` | ✅ Correct | | `categorySystemName` | required |
`.optional().default("")` | ❌ → `z.string()` | | `description` | required |
`.optional().default("")` | ❌ → `z.string()` | | `accountId` | required |
`.optional().default("")` | ❌ → `z.string()` | | `date` | required |
`.optional().default("")` | ❌ → `z.string()` | | `confidenceScore` | required |
`.optional().default(0.8)` | ❌ → `z.number()` |

---

## R-005: Duplicate Logic Inventory

**Identified duplications across `ai-voice-parser-service.ts` and
`ai-sms-parser-service.ts`**:

| Function            | Voice Parser  | SMS Parser           | Shared?                                       |
| ------------------- | ------------- | -------------------- | --------------------------------------------- |
| `normalizeType`     | L108-114      | L179-187             | Identical logic                               |
| `VALID_TYPES`       | L102          | L78-81               | Identical set                                 |
| `parseCategory`     | Not present   | L193-207             | Needs extraction                              |
| `DATE_ONLY_REGEX`   | L117          | Not present          | Voice-specific variant                        |
| `parseAiDate`       | L125-149      | `parseDate` L209-215 | Different logic — SMS uses fallback timestamp |
| `normalizeCurrency` | Not present   | L169-177             | SMS-specific (voice uses client currency)     |
| `clampConfidence`   | L303 (inline) | L283 (inline)        | `Math.min(1, Math.max(0, ...))`               |

**Decision**: Extract `normalizeType`, `VALID_TYPES`, `parseAiDate`,
`clampConfidence`, and `parseCategory` to shared module. Keep
`normalizeCurrency` in SMS parser (voice doesn't need it). Keep `parseDate` (SMS
variant with fallback) in SMS parser.
