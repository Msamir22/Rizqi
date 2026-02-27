# Research: 008 – Resolve Codebase TODOs

**Date**: 2026-02-25  
**Spec**: [spec.md](file:///e:/Work/My%20Projects/Astik/specs/008-resolve-todos/spec.md)

---

## 1. AI Account Suggestions (FR-005, FR-005a, FR-013, FR-014)

### Current State

| File                       | Lines    | What's There                                                             |
| -------------------------- | -------- | ------------------------------------------------------------------------ |
| `parse-sms/index.ts`       | L84-88   | TODO block requesting account suggestions                                |
| `parse-sms/index.ts`       | L89-157  | `RESPONSE_SCHEMA` — only has `transactions` array                        |
| `parse-sms/index.ts`       | L43-79   | Hardcoded `CATEGORY_TREE` constant                                       |
| `parse-sms/index.ts`       | L110     | Hardcoded 7-currency enum: `["EGP","USD","EUR","GBP","SAR","AED","KWD"]` |
| `parse-sms/index.ts`       | L222-224 | `ParseSmsRequest` — only accepts `messages`                              |
| `ai-sms-parser-service.ts` | L54-62   | Hardcoded `VALID_CURRENCIES` (same 7 currencies)                         |
| `ai-sms-parser-service.ts` | L214-235 | `invokeParseChunk` — body only sends `messages`                          |
| `sms-review.tsx`           | L80-162  | `buildInitialState` — client-side grouping logic                         |

### Decision: Schema Extension for `accountSuggestions`

- **Add** an `accountSuggestions` array to `RESPONSE_SCHEMA` with shape:
  ```json
  {
    "name": "string",
    "currency": "string (from supported list)",
    "isDefault": "boolean"
  }
  ```
- The AI will use fuzzy matching (bidirectional substring by name + exact
  currency match) against user-provided accounts to avoid duplicates.
- If no existing accounts are provided → AI **must** return at least one
  suggestion.
- One suggestion must be marked `isDefault: true` (highest message frequency).

### Decision: Dynamic Inputs from Client

- `ParseSmsRequest` grows to accept:
  1. `existingAccounts: { name: string; currency: string }[]`
  2. `categories: string` (formatted category tree)
  3. `supportedCurrencies: string[]`
- Edge function replaces hardcoded `CATEGORY_TREE` and currency enum with client
  values.
- Client-side (`ai-sms-parser-service.ts`) fetches accounts, categories, and the
  `CurrencyType` union to populate the payload.

### Alternatives Considered

- **Server-side DB lookup**: Rejected — violates the offline-first principle;
  requires service-role DB access from an edge function.
- **Keep hardcoded currencies**: Rejected — the `CurrencyType` union has 36
  values, not 7.

---

## 2. Unsupported Currency Handling (FR-005)

### Current State

- `parse-sms/index.ts` L109-111: currency enum is a hardcoded 7-member list.
- `parse-voice/index.ts` L72-75: same hardcoded 7-member list.
- `ai-sms-parser-service.ts` L54-62: `VALID_CURRENCIES` is same 7-member list;
  `normalizeCurrency()` at L144-150 returns `null` for unknown currencies.

### Decision

- **parse-sms**: currency enum is derived from client-sent
  `supportedCurrencies`.
- **parse-voice**: keep hardcoded for now (voice doesn't receive client context
  in current architecture), but expand from 7 to all 36 from `CurrencyType`.
- **Client validation**: `normalizeCurrency` already returns `null` → existing
  filter in `mapAiTransactions` already skips unknown currencies. Just need to
  derive `VALID_CURRENCIES` from `CurrencyType`.

### Rationale

Dynamic for SMS (client sends the list). Static expansion for voice (voice flow
doesn't accept additional context parameters yet). `CurrencyType` in `@astik/db`
is the single source of truth.

---

## 3. Counterparty Naming Consistency (FR-008, FR-009)

### Current State

| File                       | Lines    | Field Name                          |
| -------------------------- | -------- | ----------------------------------- |
| `parse-sms/index.ts`       | L117     | `merchant`                          |
| `parse-sms/index.ts`       | L148-149 | `required: ["merchant"]`            |
| `parse-sms/index.ts`       | L231     | `AiTransaction.merchant`            |
| `parse-voice/index.ts`     | L82-86   | `merchant`                          |
| `parse-voice/index.ts`     | L98-104  | `required: ["merchant"]`            |
| `parse-voice/index.ts`     | L152     | `VoiceTransaction.merchant`         |
| `ai-sms-parser-service.ts` | L27      | `AiSmsTransaction.merchant`         |
| `ai-sms-parser-service.ts` | L170-212 | `mapAiTransactions` maps `merchant` |

### Decision

Rename `merchant` → `counterparty` in:

1. Both edge functions (schema, types, required arrays, prompt text)
2. Client-side type + mapping code

### Rationale

Database column is `counterparty`. Naming consistency reduces cognitive load and
mapping errors.

---

## 4. DRY SMS Scan Retry Logic (FR-010)

### Current State

`sms-scan.tsx` Lines L50-78 (auto-start on mount) and L84-101 (retry handler)
contain identical logic:

```typescript
const minDate =
  scanMode === "incremental" && lastSyncTimestamp
    ? lastSyncTimestamp
    : undefined;
loadExistingSmsHashes()
  .then((existingHashes) => startScan({ minDate, existingHashes }))
  .catch(/* error logging */);
```

### Decision

Extract into a local `initiateScan()` function called from both the `useEffect`
and `handleRetryPress`. The function will:

1. Compute `minDate` based on `scanMode` and `lastSyncTimestamp`
2. Load existing hashes
3. Call `startScan`
4. Handle errors

### Rationale

DRY principle. Single Responsibility — scan initiation logic is one concern.

---

## 5. Multi-Currency Stats Aggregation (FR-011, FR-012)

### Current State

| File                        | Lines             | Issue                                                      |
| --------------------------- | ----------------- | ---------------------------------------------------------- |
| `drilldown/types.ts`        | L19               | `DEFAULT_DISPLAY_CURRENCY: CurrencyType = "EGP"` hardcoded |
| `QuickStats.tsx`            | L6,L69,L73        | Imports and uses `DEFAULT_DISPLAY_CURRENCY`                |
| `MonthlyExpenseChart.tsx`   | L6,L154,L163,L172 | Same hardcoded currency                                    |
| `CategoryDrilldownCard.tsx` | L11               | Same import                                                |

### Decision

**Phase 1** (this feature): Replace `DEFAULT_DISPLAY_CURRENCY` with
`usePreferredCurrency()` hook in all stats components.

- `QuickStats`, `MonthlyExpenseChart`, and `CategoryDrilldownCard` will use the
  user's preferred currency for display.
- `usePreferredCurrency` already handles Profile → locale → USD fallback.
- No actual currency **conversion** in this phase (amounts remain in their
  original currency). The `TODO` comment says "once market rate conversion is
  integrated" — that is a separate feature.

### Rationale

- `usePreferredCurrency` hook already exists and is used in 15+ places.
- True conversion requires market rate data flow into analytics hooks — out of
  scope.
- Displaying in preferred currency (even without conversion) is still more
  correct than hardcoded "EGP".

### Alternatives Considered

- **Full conversion with market rates**: Rejected for this scope — requires
  `useMarketRates` integration into `useAnalytics` hooks, which is a significant
  analytics refactor.

---

## 6. Helper Extraction: `topCategories` (sms-scan.tsx)

### Current State

`sms-scan.tsx` L103-118: TODO to move `topCategories` useMemo to a helper
function.

### Decision

Extract to a pure function
`getTopCategories(transactions: ParsedSmsTransaction[], limit?: number): string[]`
in a shared location, e.g., `@astik/logic` or a local `utils/sms-helpers.ts`
file.

### Rationale

Single Responsibility. The `topCategories` computation has no React dependency —
it's pure data transformation.

---

## 7. Technology & Testing Strategy

### Stack Summary

- **Edge Functions**: Deno + `@google/genai` + `@supabase/supabase-js`
- **Client**: React Native + Expo + WatermelonDB + NativeWind
- **Shared Logic**: `@astik/logic` (pure TypeScript)
- **Testing**: Jest (only `regex-sms-parser.test.ts` exists today)

### Testing Approach

1. **No automated unit tests for edge functions** — Deno functions run in
   Supabase's isolated runtime. Testing would require a Deno test harness (out
   of scope).
2. **Client-side validation**: The `normalizeCurrency`, `isValidAiTransaction`,
   and `parseAiResponse` functions can be tested but currently have no test
   files.
3. **Manual E2E testing**: Primary verification via SMS scan + review flow on
   device/emulator.
4. **Lint + TypeScript compilation**: `npx nx lint mobile` and
   `npx nx run mobile:type-check` to verify no type/lint errors.
