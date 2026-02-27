# Data Model: 008 – Resolve Codebase TODOs

**Date**: 2026-02-25

---

## Changed Interfaces

### Edge Function: `parse-sms`

#### `ParseSmsRequest` (extended)

```typescript
interface ParseSmsRequest {
  readonly messages: ReadonlyArray<SmsInput>;
  readonly existingAccounts?: ReadonlyArray<{ name: string; currency: string }>;
  readonly categories?: string;
  readonly supportedCurrencies?: ReadonlyArray<string>;
}
```

#### `AiTransaction` (renamed field)

```typescript
interface AiTransaction {
  readonly messageId: string;
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly counterparty: string; // was: merchant
  readonly date: string;
  readonly categorySystemName: string;
  readonly financialEntity?: string;
  readonly isAtmWithdrawal?: boolean;
  readonly cardLast4?: string;
}
```

#### `AiAccountSuggestion` (new)

```typescript
interface AiAccountSuggestion {
  readonly name: string;
  readonly currency: string;
  readonly isDefault: boolean;
}
```

#### `AiResponse` (extended)

```typescript
interface AiResponse {
  readonly transactions: ReadonlyArray<AiTransaction>;
  readonly accountSuggestions?: ReadonlyArray<AiAccountSuggestion>;
}
```

---

### Edge Function: `parse-voice`

#### `VoiceTransaction` (renamed field)

```typescript
interface VoiceTransaction {
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly counterparty: string; // was: merchant
  readonly categorySystemName: string;
  readonly description: string;
}
```

---

### Client: `ai-sms-parser-service.ts`

#### `AiSmsTransaction` (renamed field)

```typescript
interface AiSmsTransaction {
  readonly messageId: string;
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly counterparty: string; // was: merchant
  readonly date: string;
  readonly categorySystemName: string;
  readonly financialEntity?: string;
  readonly isAtmWithdrawal?: boolean;
  readonly cardLast4?: string;
}
```

#### `AiAccountSuggestion` (new, client-side)

```typescript
interface AiAccountSuggestion {
  readonly name: string;
  readonly currency: string;
  readonly isDefault: boolean;
}
```

#### `AiParseResult` (new composite return)

```typescript
interface AiParseResult {
  readonly transactions: readonly ParsedSmsTransaction[];
  readonly accountSuggestions: readonly AiAccountSuggestion[];
}
```

---

## Deleted Constants

| File                       | Constant                     | Replacement                                           |
| -------------------------- | ---------------------------- | ----------------------------------------------------- |
| `drilldown/types.ts`       | `DEFAULT_DISPLAY_CURRENCY`   | `usePreferredCurrency()` hook                         |
| `ai-sms-parser-service.ts` | `VALID_CURRENCIES` (7 items) | `SUPPORTED_CURRENCIES` (36 items from `CurrencyType`) |
| `parse-sms/index.ts`       | `CATEGORY_TREE`              | Kept as fallback; client-provided value preferred     |
| `parse-sms/index.ts`       | `RESPONSE_SCHEMA` (constant) | `buildResponseSchema()` (function)                    |
| `parse-sms/index.ts`       | `SYSTEM_PROMPT` (constant)   | `buildSystemPrompt()` (function)                      |

---

## No Database Schema Changes

This feature modifies only edge function contracts and client-side code. No
Supabase migrations or WatermelonDB schema changes are required.
