# Implementation Plan: Refine AI SMS Parsing Accuracy

**Branch**: `010-refine-ai-parsing` | **Date**: 2026-02-28 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/010-refine-ai-parsing/spec.md)  
**Input**:
Feature specification from `/specs/010-refine-ai-parsing/spec.md`

## Summary

Refine the AI SMS parsing pipeline across 4 issues (#29, #48, #63, #65): add
real confidence scores from Gemini, enforce predefined categories with
client-side validation, prevent the AI from using the bank name as counterparty,
and replace AI-driven account suggestions with deterministic derivation from the
bank registry. No database migrations required.

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React Native + Expo, Supabase Edge Functions, Google
Gemini 2.5 Flash-Lite, NativeWind v4  
**Storage**: WatermelonDB (local), Supabase PostgreSQL (cloud) — no schema
changes  
**Testing**: Manual SMS scan testing on Android device  
**Target Platform**: iOS + Android (Expo managed workflow)  
**Project Type**: Mobile + API (monorepo)  
**Constraints**: Ephemeral confidence score (not persisted)  
**Scale/Scope**: ~12 files modified across Edge Function and mobile app

## Constitution Check

_GATE: All 7 principles pass._

| Principle                     | Status  | Notes                                                                                                       |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| I. Offline-First              | ✅ PASS | Account suggestions derived on-device from local bank registry. Confidence ephemeral.                       |
| II. Documented Business Logic | ✅ PASS | Spec + clarifications document all decisions.                                                               |
| III. Type Safety              | ✅ PASS | `confidenceScore: number` added. Runtime validation via `isValidAiTransaction`.                             |
| IV. Service-Layer Separation  | ✅ PASS | Deterministic builder in utility layer (`build-initial-account-state.ts`). Tag in presentational component. |
| V. Premium UI                 | ✅ PASS | Confidence tag uses colour-coded Tailwind chips.                                                            |
| VI. Monorepo Boundaries       | ✅ PASS | Registry in `packages/logic`, utility in `apps/mobile/utils/`, Edge Function in `supabase/functions/`.      |
| VII. Local-First Migrations   | ✅ PASS | No database migrations needed.                                                                              |

---

## Proposed Changes

### Component 1: Edge Function — Prompt & Schema

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/parse-sms/index.ts)

**`buildResponseSchema` (line 96–209)**:

1. **Add** `confidenceScore` property to the transaction schema (type:
   `"number"`, 0.0–1.0)
2. **Add** `"confidenceScore"` to the transaction `required` array
3. **Remove** the entire `accountSuggestions` property block (~30 lines)
4. **Update** the top-level `required` array: remove `"accountSuggestions"`,
   keep only `["transactions"]`

**`buildSystemPrompt` (line 211–289)**:

1. **Remove** `ACCOUNT SUGGESTION RULES` block and `accountContext` variable
2. **Remove** `existingAccounts` parameter from the function signature
3. **Add** counterparty rule: "Counterparty MUST NEVER equal financialEntity. If
   no merchant, set counterparty to `""`."
4. **Add** confidence score rule: "Rate your confidence 0.0–1.0 per
   transaction."
5. **Strengthen** category rule: "MUST NOT invent/combine/modify category
   names."

**Handler / `processWithRetry`**: Remove `existingAccounts` from the prompt
builder call.

---

### Component 2: Client Service — AI Response Types & Mapping

#### [MODIFY] [ai-sms-parser-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/ai-sms-parser-service.ts)

**Interface changes**:

1. `AiSmsTransaction` (line 27–41) — Add `readonly confidenceScore: number`
2. `AiAccountSuggestion` (line 44–49) — **Remove** (no longer from AI)
3. `AiParseResult` (line 52–55) — **Remove `accountSuggestions` field**. Return
   type becomes `{ transactions: ParsedSmsTransaction[] }` only.
4. `ChunkAiResult` (line 183–186) — **Remove `accountSuggestions` field**
5. `ParseSmsContext` (line 58–65) — Remove `existingAccounts` field

**Function changes**:

1. `isValidAiTransaction` (line 145–163) — Add `confidenceScore` validation
   (typeof number, clamp 0–1)
2. `isValidAiAccountSuggestion` (line 165–178) — **Remove**
3. `parseAiResponse` (line 188–232) — Remove all `accountSuggestions` parsing.
   Return `{ transactions }` only.
4. `mapAiTransactions` (line 268–309):
   - Replace hardcoded `confidence: 0.85` →
     `Math.min(1, Math.max(0, aiTx.confidenceScore))`
   - Add counterparty guard: if `counterparty === financialEntity`
     (case-insensitive) → set to `""`
   - Add category validation: check against known list, fallback to `"other"`
5. `mapAiAccountSuggestions` (line 311–320) — **Remove**
6. `getAccountSuggestions` (line 125–143) — **Remove**
7. Main export function (chunked processing loop) — Remove `accountSuggestions`
   accumulation. Return only `{ transactions }`.

---

### Component 3: Deterministic Account Suggestions

#### [MODIFY] [build-initial-account-state.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/utils/build-initial-account-state.ts)

**New function — `buildDeterministicSuggestions`**:

```
function buildDeterministicSuggestions(
  groups: ReadonlyMap<string, GroupedTransactionsBySender>,
  matchedSenders: ReadonlySet<string>
): ParsedSmsAccountSuggestion[]
```

Logic:

1. Iterate `groups` from `groupTransactionsBySender()` (already exists)
2. Skip groups whose `senderAddress` is in `matchedSenders` (already matched to
   an existing account)
3. For each remaining group, call `isKnownFinancialSender(group.senderAddress)`
   from the bank registry
4. If matched → create `ParsedSmsAccountSuggestion`:
   `{ name: bankInfo.shortName, currency: group.currency, accountType: mapRegistryType(bankInfo.type), isDefault: false }`
5. Skip if `bankInfo.shortName` is `"Cash"` (case-insensitive)
6. Sort by `group.count` descending (most frequent first)
7. Take first 5
8. Mark first entry as `isDefault: true`

**Helper — `mapRegistryType`**: Map `BankInfo.type`
(`'bank' | 'wallet' | 'fintech'`) → `AccountType`
(`'BANK' | 'DIGITAL_WALLET' | 'BANK'`)

**Modified function — `buildInitialAccountState`**:

- **Remove** `aiSuggestions` parameter from signature
- After `matchGroupsToExistingAccounts`, call
  `buildDeterministicSuggestions(groups, matchedSenderSet)`
- Feed result into existing `suggestionsToCards()` (reused as-is)
- New signature: `buildInitialAccountState(transactions, db)`

---

### Component 4: Remove `accountSuggestions` Threading

The following files currently thread `accountSuggestions` from the AI result to
`AccountSetupStep`. Since suggestions are now computed inside
`buildInitialAccountState`, this threading is removed:

#### [MODIFY] [sms-sync-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/sms-sync-service.ts)

- Remove `accountSuggestions` from the `SmsSyncResult` interface
- Remove `accountSuggestions` from the returned result object

#### [MODIFY] [SmsScanContext.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/context/SmsScanContext.tsx)

- Remove `accountSuggestions` state and setter from context

#### [MODIFY] [useSmsScan.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/useSmsScan.ts)

- Remove `accountSuggestions` state variable and setter
- Remove from return object

#### [MODIFY] [AccountSetupStep.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/AccountSetupStep.tsx)

- Remove `accountSuggestions` from props interface
- Update `buildInitialAccountState` call: `(transactions, db)` instead of
  `(transactions, accountSuggestions, db)`
- Remove from `useEffect` dependency array

#### [MODIFY] [sms-review.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/sms-review.tsx)

- Remove `accountSuggestions` prop from `AccountSetupStep` usage

#### [MODIFY] [sms-scan.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/sms-scan.tsx)

- Remove `setCtxAccountSuggestions` call

---

### Component 5: UI — Confidence Tag

#### [MODIFY] [SmsTransactionItem.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionItem.tsx)

Add confidence tag chip (bottom row, after category chip):

- `≥ 0.8` → Emerald chip: "High Confidence"
- `0.5–0.79` → Amber chip: "Needs Review"
- `< 0.5` → Red chip: "Low Confidence"

No changes to `SmsTransactionEditModal.tsx` or `SmsTransactionReview.tsx`.

---

## Verification Plan

### Manual Testing

1. **Confidence**: SMS scan → each card shows coloured tag, no card shows `0.85`
2. **Categories**: ATM SMS → valid `system_name`, not "cash withdrawal"
3. **Counterparty**: QNB/CIB SMS → merchant name or "Unknown", never bank name
4. **Suggestions**: Onboarding scan → registry matches only, no
   merchants/dupes/Cash, max 5
5. **Edge Function**: Deploy → response has no `accountSuggestions`

### Automated Checks

- `npx tsc --noEmit` — no errors
- `npx eslint` — passes

## Complexity Tracking

No constitution violations. No complexity justifications needed.
