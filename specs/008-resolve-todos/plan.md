# Implementation Plan: 008 – Resolve Codebase TODOs

**Branch**: `008-resolve-todos` | **Date**: 2026-02-25  
**Spec**: [spec.md](file:///e:/Work/My%20Projects/Astik/specs/008-resolve-todos/spec.md)  
**Research**:
[research.md](file:///e:/Work/My%20Projects/Astik/specs/008-resolve-todos/research.md)

---

## Summary

Resolve six TODO clusters across the SMS/voice parsing pipeline, stats display,
and scan UX:

1. **AI Account Suggestions** – extend `parse-sms` schema + client service to
   send existing accounts/categories/currencies and receive account suggestions.
2. **Dynamic Currency Enum** – replace hardcoded 7-currency lists with the full
   36-member `CurrencyType` union (client-sent for SMS, static expansion for
   voice).
3. **Counterparty Rename** – `merchant` → `counterparty` in both edge functions
   and the client mapping layer.
4. **DRY Scan Logic** – extract duplicated scan-initiation code in
   `sms-scan.tsx`.
5. **Preferred Currency in Stats** – replace `DEFAULT_DISPLAY_CURRENCY` with
   `usePreferredCurrency()` in all stats components.
6. **TopCategories Helper** – extract `topCategories` computation to a pure
   function.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: `@google/genai`, `@supabase/supabase-js`,
`@nozbe/watermelondb`, `expo`, `expo-router`  
**Storage**: WatermelonDB (local-first) + Supabase (remote sync)  
**Testing**: Jest (limited: only `regex-sms-parser.test.ts` exists), manual
E2E  
**Target Platform**: Android / iOS (Expo managed workflow)  
**Project Type**: Mobile + API (Nx monorepo)  
**Constraints**: Offline-first, all schema changes via local SQL migrations

---

## Constitution Check

| Gate                              | Status  | Notes                                                                                                                        |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Offline-First Data Architecture   | ✅ PASS | No new remote-only dependencies. Client sends local data to edge function.                                                   |
| Type Safety (NON-NEGOTIABLE)      | ✅ PASS | All new interfaces/types are strictly typed. No `any`.                                                                       |
| Monorepo Package Boundaries       | ✅ PASS | Edge functions stay in `supabase/functions/`, client code in `apps/mobile/`, shared types in `@astik/db` and `@astik/logic`. |
| Database Migrations (local-first) | ✅ PASS | No schema changes needed — only edge function + client code changes.                                                         |
| Tailwind > StyleSheet             | ✅ N/A  | No UI style changes in this feature.                                                                                         |

---

## Project Structure

### Documentation (this feature)

```text
specs/008-resolve-todos/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research output
├── data-model.md        # Changed interfaces / contracts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (impacted files)

```text
supabase/functions/
├── parse-sms/index.ts       # FR-005, FR-005a, FR-008, FR-013, FR-014
└── parse-voice/index.ts     # FR-009, currency expansion

apps/mobile/
├── services/
│   └── ai-sms-parser-service.ts  # FR-005, FR-008, FR-013
├── app/
│   ├── sms-scan.tsx              # FR-010 (DRY scan logic)
│   └── sms-review.tsx            # FR-005a (consume AI suggestions)
├── components/stats/
│   ├── drilldown/types.ts        # FR-011, FR-012 (remove DEFAULT_DISPLAY_CURRENCY)
│   ├── QuickStats.tsx            # FR-012
│   ├── MonthlyExpenseChart.tsx    # FR-012
│   └── CategoryDrilldownCard.tsx # FR-012
└── hooks/
    └── usePreferredCurrency.ts   # Already exists — consumed by stats components

packages/logic/src/
└── (optional) sms-helpers.ts     # topCategories extraction
```

---

## Proposed Changes

Changes are grouped by component and ordered by dependency (edge functions
first, then client service, then UI consumers).

---

### Component 1: Edge Function — `parse-sms`

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/parse-sms/index.ts)

**1. Extend `ParseSmsRequest` interface (L222-224)**

Add three new fields to accept client-provided context:

```diff
 interface ParseSmsRequest {
   readonly messages: ReadonlyArray<SmsInput>;
+  readonly existingAccounts?: ReadonlyArray<{ name: string; currency: string }>;
+  readonly categories?: string;
+  readonly supportedCurrencies?: ReadonlyArray<string>;
 }
```

**2. Add `accountSuggestions` to `RESPONSE_SCHEMA` (L89-157)**

Add a new top-level `accountSuggestions` array alongside `transactions`:

```typescript
accountSuggestions: {
  type: "array",
  description: "Suggested accounts to create. Use fuzzy matching (bidirectional substring by name AND exact currency match) against existing accounts. If existingAccounts is empty, return at least one suggestion. Mark the most common account as isDefault: true.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Account display name (e.g., 'CIB Savings')." },
      currency: { type: "string", description: "ISO 4217 currency code from the supported list." },
      isDefault: { type: "boolean", description: "True for the account with highest message frequency." },
    },
    required: ["name", "currency", "isDefault"],
  },
},
```

**3. Make currency enum dynamic (L107-111)**

Replace hardcoded enum with dynamic construction from `supportedCurrencies`:

```typescript
// In Deno.serve handler, after parsing body:
const currencyEnum = body.supportedCurrencies?.length
  ? body.supportedCurrencies
  : ["EGP", "USD", "EUR", "GBP", "SAR", "AED", "KWD"]; // fallback

// Build schema dynamically or pass to a factory
```

The `RESPONSE_SCHEMA` constant becomes a function:
`buildResponseSchema(currencies: string[])`.

**4. Replace hardcoded `CATEGORY_TREE` with client-provided categories (L43-79,
L206)**

Keep hardcoded `CATEGORY_TREE` as a fallback, but prefer `body.categories` when
provided:

```typescript
const categoryTree = body.categories ?? CATEGORY_TREE;
```

The `SYSTEM_PROMPT` template is changed from a constant to a function
`buildSystemPrompt(categoryTree: string)` that injects the provided tree.

**5. Inject existing accounts into prompt**

Append account context to the system prompt when available:

```typescript
// After CATEGORY TREE section in prompt:
if (body.existingAccounts?.length) {
  prompt += `\nEXISTING USER ACCOUNTS:\n${body.existingAccounts.map((a) => `- ${a.name} (${a.currency})`).join("\n")}\n`;
  prompt += `\nUse fuzzy matching (bidirectional substring by name AND exact currency match) to check if a suggested account already exists. Do NOT suggest duplicates.\n`;
}
```

**6. Rename `merchant` → `counterparty` (L117-119, L148-149, L198, L231)**

Update in: schema property key, `required` array, system prompt rule #4, and
`AiTransaction` interface.

**7. Update `AiTransaction` and `AiResponse` types (L226-241)**

```diff
 interface AiTransaction {
   // ... existing fields
-  readonly merchant: string;
+  readonly counterparty: string;
 }

+interface AiAccountSuggestion {
+  readonly name: string;
+  readonly currency: string;
+  readonly isDefault: boolean;
+}

 interface AiResponse {
   readonly transactions: ReadonlyArray<AiTransaction>;
+  readonly accountSuggestions?: ReadonlyArray<AiAccountSuggestion>;
 }
```

**8. Return `accountSuggestions` in response (L398-405)**

```typescript
return jsonResponse({
  transactions,
  accountSuggestions: parsed.accountSuggestions ?? [],
});
```

**9. Remove TODO comments (L84-88, L109, L116)**

Delete the resolved TODO blocks.

---

### Component 2: Edge Function — `parse-voice`

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/supabase/functions/parse-voice/index.ts)

**1. Expand currency enum from 7 to all 36 (L72-75)**

Replace hardcoded 7-currency list with the full `CurrencyType` union values.

**2. Rename `merchant` → `counterparty` (L82-86, L98-104, L127, L152)**

Same rename in schema, required array, prompt, and `VoiceTransaction` interface.

---

### Component 3: Client Service — `ai-sms-parser-service.ts`

#### [MODIFY] [ai-sms-parser-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/ai-sms-parser-service.ts)

**1. Derive `VALID_CURRENCIES` from `CurrencyType` (L53-62)**

```typescript
import type { CurrencyType } from "@astik/db";

// All supported currencies derived from the CurrencyType union
const SUPPORTED_CURRENCIES: readonly CurrencyType[] = [
  "EGP",
  "SAR",
  "AED",
  "KWD",
  "QAR",
  "BHD",
  "OMR",
  "JOD",
  "IQD",
  "LYD",
  "TND",
  "MAD",
  "DZD",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CNY",
  "INR",
  "KRW",
  "KPW",
  "SGD",
  "HKD",
  "MYR",
  "AUD",
  "NZD",
  "CAD",
  "SEK",
  "NOK",
  "DKK",
  "ISK",
  "TRY",
  "RUB",
  "ZAR",
  "BTC",
];
const VALID_CURRENCIES: ReadonlySet<string> = new Set(SUPPORTED_CURRENCIES);
```

**2. Rename `merchant` → `counterparty` in `AiSmsTransaction` (L27)**

And update `mapAiTransactions` to reference `counterparty`.

**3. Extend `invokeParseChunk` to send context (L214-235)**

Add parameters for existing accounts, formatted categories, and supported
currencies:

```typescript
interface ParseChunkOptions {
  readonly messages: readonly MessagePayload[];
  readonly existingAccounts: readonly { name: string; currency: string }[];
  readonly categories: string;
  readonly supportedCurrencies: readonly string[];
}

async function invokeParseChunk(options: ParseChunkOptions): Promise<...> {
  const response = await supabase.functions.invoke("parse-sms", {
    body: {
      messages: options.messages,
      existingAccounts: options.existingAccounts,
      categories: options.categories,
      supportedCurrencies: options.supportedCurrencies,
    },
  });
  // ...
}
```

**4. Extend `parseSmsWithAi` signature**

Accept context parameters and thread them through to each chunk call.

**5. Parse and return `accountSuggestions` from AI response**

Extend `parseAiResponse` to validate and return account suggestions alongside
transactions.

**6. Remove TODO comment (L53)**

---

### Component 4: SMS Scan Screen

#### [MODIFY] [sms-scan.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/sms-scan.tsx)

**1. Extract `initiateScan()` (L50-78 + L84-101)**

```typescript
const initiateScan = useCallback((): void => {
  const minDate =
    scanMode === "incremental" && lastSyncTimestamp
      ? lastSyncTimestamp
      : undefined;

  loadExistingSmsHashes()
    .then((existingHashes) => startScan({ minDate, existingHashes }))
    .catch((err: unknown) => {
      console.error(
        "[sms-scan] Scan failed:",
        err instanceof Error ? err.message : String(err)
      );
    });
}, [scanMode, lastSyncTimestamp, startScan]);
```

**2. Extract `topCategories` to a pure helper**

Move the `useMemo` body (L103-118) to a standalone function.

---

### Component 5: SMS Review Screen

#### [MODIFY] [sms-review.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/sms-review.tsx)

**1. Replace `buildInitialState` with AI-provided suggestions**

The `buildInitialState` function (L80-162) currently groups transactions by
sender×currency and matches against existing accounts client-side. Post-change:

- AI suggestions from `parseSmsWithAi` are passed to the review screen via
  context.
- `buildInitialState` is replaced by consuming AI account suggestions directly.
- Existing account matching logic (`isSubstringMatch`) is preserved for fallback
  but the primary path uses AI suggestions.

---

### Component 6: Stats Components

#### [MODIFY] [types.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/stats/drilldown/types.ts)

Remove `DEFAULT_DISPLAY_CURRENCY` constant (L12-19).

#### [MODIFY] [QuickStats.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/stats/QuickStats.tsx)

Replace `DEFAULT_DISPLAY_CURRENCY` import + usage with `usePreferredCurrency()`
hook.

#### [MODIFY] [MonthlyExpenseChart.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/stats/MonthlyExpenseChart.tsx)

Same replacement — `usePreferredCurrency()` for all `formatCurrency` calls.

#### [MODIFY] [CategoryDrilldownCard.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/stats/CategoryDrilldownCard.tsx)

Same replacement — `usePreferredCurrency()`.

---

## Verification Plan

### Automated Checks

| Check                  | Command                                              | Expected Result             |
| ---------------------- | ---------------------------------------------------- | --------------------------- |
| TypeScript compilation | `npx nx run mobile:type-check`                       | No type errors              |
| ESLint                 | `npx nx lint mobile`                                 | No new lint warnings/errors |
| Edge function syntax   | `deno check supabase/functions/parse-sms/index.ts`   | No type errors              |
| Edge function syntax   | `deno check supabase/functions/parse-voice/index.ts` | No type errors              |

### Manual E2E Testing

> [!IMPORTANT] Edge function changes must be deployed to Supabase before manual
> testing. Run `npx supabase functions deploy parse-sms` and
> `npx supabase functions deploy parse-voice`.

**Test 1: SMS Scan → Review (AI Account Suggestions)**

1. Open the app on emulator/device.
2. Navigate to Settings → SMS Sync → Start Full Scan.
3. On the scan progress screen, wait for completion.
4. On the review screen, verify:
   - Account cards are populated from AI suggestions (not client-side grouping).
   - One card is marked as default.
   - No duplicate accounts suggested for an existing account with same name +
     currency.

**Test 2: Currency Validation**

1. Trigger a scan with SMS containing non-standard currencies (e.g., QAR, BHD).
2. Verify these currencies appear in parsed transactions.
3. Verify SMS with truly unsupported currencies (e.g., fictional "XYZ") are
   silently skipped.

**Test 3: Counterparty Field**

1. After scanning, check parsed transaction data.
2. Verify the field name is `counterparty` (not `merchant`) in the AI response.
3. Verify the review screen displays the counterparty correctly.

**Test 4: Stats Preferred Currency**

1. Go to Settings → change preferred currency to USD.
2. Navigate to the Stats tab.
3. Verify QuickStats shows amounts formatted in USD.
4. Verify MonthlyExpenseChart summary shows USD.
5. Verify CategoryDrilldownCard shows USD.

**Test 5: Retry Logic (DRY)**

1. Start an SMS scan.
2. Force a failure (e.g., disable network mid-scan).
3. Press Retry.
4. Verify scan restarts correctly with same logic as initial scan.

---

## Complexity Tracking

No constitution violations. All changes stay within established patterns.
