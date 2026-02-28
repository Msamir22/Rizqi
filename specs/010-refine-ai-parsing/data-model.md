# Data Model: Refine AI SMS Parsing Accuracy

**Branch**: `010-refine-ai-parsing` | **Date**: 2026-02-28

## Modified Entities

### AiSmsTransaction (Interface — `ai-sms-parser-service.ts`)

| Field               | Type       | Change  | Notes                           |
| ------------------- | ---------- | ------- | ------------------------------- |
| messageId           | string     | —       | No change                       |
| amount              | number     | —       | No change                       |
| currency            | string     | —       | No change                       |
| type                | string     | —       | No change                       |
| counterparty        | string     | —       | No change                       |
| date                | string     | —       | No change                       |
| categorySystemName  | string     | —       | No change                       |
| financialEntity     | string?    | —       | No change                       |
| isAtmWithdrawal     | boolean?   | —       | No change                       |
| cardLast4           | string?    | —       | No change                       |
| **confidenceScore** | **number** | **ADD** | 0.0–1.0, AI self-assessed score |

### AiAccountSuggestion (Interface — `ai-sms-parser-service.ts`)

**REMOVE ENTIRE INTERFACE** — Account suggestions are no longer derived from AI
output.

### AiParseResult (Interface — `ai-sms-parser-service.ts`)

| Field              | Type                         | Change     | Notes                     |
| ------------------ | ---------------------------- | ---------- | ------------------------- |
| transactions       | ParsedSmsTransaction[]       | —          | No change                 |
| accountSuggestions | ParsedSmsAccountSuggestion[] | **REMOVE** | Derived deterministically |

> After removal, this interface may be simplified or the `accountSuggestions`
> field is sourced from a separate builder function.

### ChunkAiResult (Interface — `ai-sms-parser-service.ts`)

| Field              | Type                  | Change     | Notes             |
| ------------------ | --------------------- | ---------- | ----------------- |
| transactions       | AiSmsTransaction[]    | —          | No change         |
| accountSuggestions | AiAccountSuggestion[] | **REMOVE** | No longer from AI |

### Gemini Response Schema (Edge Function — `parse-sms/index.ts`)

| Field              | Type  | Change     | Notes                            |
| ------------------ | ----- | ---------- | -------------------------------- |
| transactions       | array | MODIFY     | Add `confidenceScore` property   |
| accountSuggestions | array | **REMOVE** | Entire field removed from schema |

## New Entities

### DeterministicAccountSuggestion (new builder — `ai-sms-parser-service.ts`)

Built client-side by iterating parsed transactions and matching SMS sender
address against `egyptian-bank-registry.ts`.

| Field       | Type         | Notes                                           |
| ----------- | ------------ | ----------------------------------------------- |
| name        | string       | `BankInfo.shortName` from registry              |
| currency    | CurrencyType | From the transaction's currency                 |
| accountType | AccountType  | From `BankInfo.type` mapping                    |
| isDefault   | boolean      | True for the most frequently seen bank+currency |

**Deduplication key**: `lowercase(name) + "|" + currency`  
**Limit**: First 5 unique entries (natural cap, not AI-enforced)

## No Database Changes

No schema migrations are required. The confidence score is ephemeral
(review-flow only). Account suggestions were never persisted.
