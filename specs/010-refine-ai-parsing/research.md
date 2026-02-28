# Research: Refine AI SMS Parsing Accuracy

**Branch**: `010-refine-ai-parsing` | **Date**: 2026-02-28

## Decision 1: Confidence Score Source

- **Decision**: Add `confidenceScore` (0.0–1.0) to the Gemini response JSON
  schema. The AI will self-assess extraction certainty per transaction.
- **Rationale**: Gemini supports structured output with arbitrary numeric
  fields. While LLM self-assessed confidence isn't perfectly calibrated, it
  provides a meaningful signal for flagging ambiguous parses. The alternative
  (no confidence) gives the user zero ability to spot-check risky entries.
- **Alternatives**: (a) Heuristic scoring on the client (rejected: would require
  duplicating parsing logic), (b) Always showing "Needs Review" (rejected: too
  noisy).

## Decision 2: Category Enforcement Strategy

- **Decision**: Dual-layer enforcement — (1) tighter prompt instructions plus
  (2) client-side validation with fallback to `other`.
- **Rationale**: Prompt-only enforcement is insufficient because LLMs
  occasionally ignore instructions. A client-side guard guarantees no invalid
  category ever reaches the database. The category tree is already embedded in
  the Edge Function prompt (`CATEGORY_TREE` constant).
- **Alternatives**: (a) Convert `categorySystemName` to an enum in the JSON
  schema (rejected: Gemini enums with 80+ values degrade response quality), (b)
  Runtime validation on the Edge Function (rejected: pushes complexity to
  serverless cold-start path).

## Decision 3: Counterparty vs Financial Entity Separation

- **Decision**: Add an explicit negative instruction in the prompt: "The
  counterparty MUST NEVER be the same as the financialEntity. If no distinct
  merchant can be extracted, set counterparty to an empty string." Plus a
  client-side guard that clears counterparty if it matches financialEntity.
- **Rationale**: The current prompt has no explicit prohibition. Adding both
  layers ensures the AI is instructed correctly AND the client catches any
  remaining slips.
- **Alternatives**: (a) Only prompt fix (rejected: AI may still slip), (b)
  Remove counterparty field entirely (rejected: loses merchant data).

## Decision 4: Account Suggestions — Deterministic Derivation

- **Decision**: Remove `accountSuggestions` from AI prompt, response schema, and
  Edge Function response entirely. Derive suggestions client-side by matching
  each parsed transaction's SMS sender address against
  `egyptian-bank-registry.ts`, grouping by `shortName` + currency.
- **Rationale**: The AI hallucinated merchants as banks, fabricated account
  names, and ignored the max-5 limit. Deterministic derivation using the
  existing bank registry eliminates all these problems and reduces AI prompt
  token usage.
- **Alternatives**: (a) Keep AI suggestions as fallback (rejected: adds
  complexity for no benefit — the registry covers all known Egyptian financial
  institutions), (b) Keep AI suggestions but ignore them (rejected: wasted
  tokens).

## Decision 5: Confidence Score Persistence

- **Decision**: Ephemeral only — confidence score exists during the review flow
  and is not persisted to the database.
- **Rationale**: Once the user reviews and saves a transaction, they've accepted
  it. Persisting confidence would require a migration for a column with no
  downstream use. Can be added later if analytics needs arise.
- **Alternatives**: Persist to DB (rejected for now: no current use case).
