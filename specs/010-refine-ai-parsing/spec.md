# Feature Specification: Refine AI SMS Parsing Accuracy

**Feature Branch**: `010-refine-ai-parsing`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: User description: "Refine AI SMS parsing accuracy: real confidence
scores, enforce predefined categories, fix merchant/counterparty hallucination,
and improve account suggestions"  
**Related Issues**: #29, #48, #63, #65

---

## Clarifications

### Session 2026-02-28

- Q: Should `accountSuggestions` be removed from the AI prompt & response schema
  now that suggestions are derived deterministically? → A: Yes — remove entirely
  (Option A). Reduces prompt tokens, eliminates hallucination vector, simplifies
  Edge Function.
- Q: Which string should be used to match against the bank registry for account
  suggestions? → A: Use the SMS sender address (Option A). It is already
  pre-matched during SMS filtering and is the most reliable, deterministic
  input.
- Q: Should the confidence score be persisted in the database? → A: Ephemeral
  only (Option A). Score is used during the review flow and discarded after
  save. No database migration needed.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - AI Returns Real Confidence Scores (Priority: P1)

As a user reviewing parsed SMS transactions, I want to see how confident the AI
was about each parsed transaction so that I can quickly identify which
transactions need manual corrections before saving.

**Why this priority**: Without real confidence scores, users have no way to
distinguish between perfectly parsed and potentially inaccurate transactions.
Every transaction currently appears equally trustworthy (hardcoded at 85%),
leading to silent data corruption when users save incorrect entries.

**Independent Test**: Can be fully tested by scanning SMS messages and verifying
that each transaction card in the review list displays a meaningful confidence
indicator (e.g., "Needs Review" vs "High Confidence") based on the AI's actual
certainty.

**Acceptance Scenarios**:

1. **Given** the AI parses an unambiguous bank debit SMS (clear amount, date,
   merchant), **When** the transaction appears in the review list, **Then** the
   confidence score is above 0.8 and a "High Confidence" tag is displayed on the
   card.
2. **Given** the AI parses an ambiguous SMS (unclear merchant, partial amount),
   **When** the transaction appears in the review list, **Then** the confidence
   score is below 0.7 and a prominent "Needs Review" tag is displayed on the
   card.
3. **Given** the AI returns a confidence score for each transaction, **When**
   the user views the review list, **Then** no transaction shows the old
   hardcoded value of 0.85.

---

### User Story 2 - AI Only Returns Valid Predefined Categories (Priority: P1)

As a user reviewing parsed SMS transactions, I want every AI-assigned category
to exist in my app's category system so that I never encounter broken or
unrecognized category labels when editing or saving transactions.

**Why this priority**: The AI currently hallucinates non-existent categories
(e.g., "cash withdrawal"), which causes runtime errors and silent data
corruption. This is a data integrity blocker.

**Independent Test**: Can be fully tested by scanning SMS messages (including
ATM withdrawals) and verifying that every category label on every transaction
card maps to a real entry in the system's predefined category list.

**Acceptance Scenarios**:

1. **Given** the AI parses a batch of SMS messages, **When** a transaction
   result is returned, **Then** the `categorySystemName` is always one of the
   exact `system_name` values from the embedded category tree (e.g.,
   `groceries`, `food_drinks`, `other`).
2. **Given** the AI cannot confidently categorize a transaction, **When** it
   returns a result, **Then** it falls back to the L1 parent category or to
   `other` — never to a fabricated name.
3. **Given** a runtime validation check on the client, **When** a transaction
   has an unrecognized `categorySystemName`, **Then** the system silently falls
   back to `other` and logs a warning.

---

### User Story 3 - AI Never Uses Bank Name as Merchant (Priority: P2)

As a user reviewing parsed SMS transactions, I want the merchant/counterparty
field to show the actual vendor or person I transacted with — not the bank that
sent the SMS — so that my transaction history is meaningful and searchable.

**Why this priority**: Currently, transactions from QNB or CIB show the bank
itself as the "merchant," making the counterparty field useless. This degrades
the user experience but doesn't cause data corruption, hence P2.

**Independent Test**: Can be fully tested by scanning SMS messages from known
bank senders (e.g., QNB, CIB, NBE) and verifying that none of those bank names
appear in the counterparty/merchant field of the parsed transactions.

**Acceptance Scenarios**:

1. **Given** the AI parses a QNB debit SMS for a purchase at "Carrefour,"
   **When** the transaction is returned, **Then** `counterparty` is "Carrefour"
   and `financialEntity` is "QNB."
2. **Given** the AI parses a bank SMS where the actual merchant is not
   mentioned, **When** the transaction is returned, **Then** `counterparty` is
   left empty or set to "Unknown" — never set to the bank name.
3. **Given** the `financialEntity` field contains "QNB," **When** the user views
   the transaction card, **Then** the merchant/counterparty displayed is
   different from "QNB."

---

### User Story 4 - Deterministic Account Suggestions (Priority: P2)

As a user setting up accounts from SMS analysis, I want the system to derive
account suggestions deterministically from the parsed transactions — by matching
each transaction's financial entity against a known bank registry — so that
suggestions are always real, accurate, and free of AI hallucinations.

**Why this priority**: The AI currently hallucinates non-existent accounts
(e.g., "QNB Egypt Savings"), suggests merchants as banks, and returns
duplicates. A deterministic approach eliminates all hallucination problems at
the root. This doesn't corrupt existing data, hence P2.

**Independent Test**: Can be fully tested by running the SMS scan during
onboarding and verifying that (a) every suggestion corresponds to a recognized
entry in the bank registry, (b) at most 5 suggestions are shown, (c) no
duplicates or merchants appear, and (d) no generic "Cash" account is suggested.

**Acceptance Scenarios**:

1. **Given** the system iterates parsed transactions, **When** the SMS sender
   address matches an entry in the bank registry, **Then** an account suggestion
   is created using the registry's `shortName` and the transaction's currency.
2. **Given** transactions for the same bank (e.g., "QNB") but different
   currencies (EGP and USD), **When** suggestions are built, **Then** two
   separate entries appear: "QNB" (EGP) and "QNB" (USD).
3. **Given** a transaction's `financialEntity` is "QNB EGP" and another
   suggestion already exists as "QNB" with EGP currency, **When** suggestions
   are deduplicated, **Then** they are treated as the same account (fuzzy
   matching by name + exact currency match).
4. **Given** a transaction's `financialEntity` does not match any entry in the
   bank registry, **When** suggestions are built, **Then** it is excluded (no
   merchants like "Google Play" or "Vodafone" appear as account suggestions).
5. **Given** the app auto-creates a default Cash account, **When** the system
   builds suggestions, **Then** no generic "Cash" account is included.
6. **Given** suggestions already exist from the user's account list, **When**
   the system builds suggestions, **Then** existing accounts are excluded via
   fuzzy matching (bidirectional substring by name + exact currency match).
7. **Given** 5 account cards already exist, **When** the user tries to add
   another, **Then** the UI prevents creation of a new account card.

---

### Edge Cases

- What happens when the AI returns a confidence score outside the 0.0–1.0 range?
  → Clamp to the nearest valid boundary (0.0 or 1.0).
- What happens when the AI returns an empty `counterparty` string? → Display
  "Unknown" on the transaction card.
- What happens when the AI returns fewer than 1 account suggestion? → Show the
  setup screen with an empty "Add Account" form.
- What happens when every SMS in a batch is promotional? → Return zero
  transactions and zero account suggestions gracefully.
- What happens when the AI assigns a valid L1 category instead of an L2? →
  Accept it — L1 categories are valid assignments.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The AI MUST return a `confidenceScore` (0.0 to 1.0) for each
  parsed transaction, reflecting how certain it is about the extraction
  accuracy.
- **FR-002**: The client MUST display a visual confidence tag on each
  transaction card in the SMS review list:
  - Score ≥ 0.8: "High Confidence" tag (subtle/positive styling)
  - Score 0.5–0.79: "Needs Review" tag (prominent/warning styling)
  - Score < 0.5: "Low Confidence" tag (prominent/alert styling)
- **FR-003**: The AI MUST only return `categorySystemName` values that exactly
  match a `system_name` from the predefined category tree embedded in the
  prompt.
- **FR-004**: The client MUST validate every incoming `categorySystemName`
  against the known category list and fall back to `other` if unrecognized.
- **FR-005**: The AI MUST NOT set the `counterparty` field to the same value as
  `financialEntity`. If no distinct merchant/vendor can be extracted,
  `counterparty` MUST be left empty or set to "Unknown."
- **FR-006**: Account suggestions MUST be derived deterministically from parsed
  transactions by matching the SMS sender address against the known bank
  registry — NOT from AI output. The `accountSuggestions` field MUST be removed
  from the AI prompt, response JSON schema, and Edge Function response.
- **FR-007**: The system MUST NOT suggest a generic "Cash" account, as the app
  auto-creates one.
- **FR-008**: Only financial entities that match a recognized entry in the bank
  registry are eligible as account suggestions (this inherently excludes
  merchants and promotional senders).
- **FR-009**: Account suggestions MUST be deduplicated using fuzzy matching
  (bidirectional substring by name + exact currency match) to prevent near-
  duplicates like "QNB EGP" vs "QNB" with EGP currency.
- **FR-010**: The hardcoded confidence value of `0.85` in the client-side
  mapping function MUST be replaced with the real AI-provided score.
- **FR-011**: The UI MUST prevent creation of more than 5 account cards on the
  Account Setup screen. If 5 cards already exist, the "Add Account" action MUST
  be disabled.

### Key Entities

- **Parsed Transaction**: Represents a single financial transaction extracted
  from an SMS. Key attributes: amount, currency, type, counterparty, category,
  confidence score, financial entity, SMS body hash.
- **Account Suggestion**: A proposed bank/wallet account for the user to create.
  Key attributes: name, currency, account type (BANK/CASH/DIGITAL_WALLET),
  isDefault flag.
- **Category Tree**: The hierarchical, predefined list of valid transaction
  categories (L1 parents and L2 children) that constrains AI output.
- **Bank Registry**: The curated registry of known Egyptian financial
  institutions (banks, wallets, fintechs) used to deterministically derive
  account suggestions from transaction data.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of parsed transactions display a real, AI-generated
  confidence score (no hardcoded values remain).
- **SC-002**: 0% of parsed transactions contain a `categorySystemName` that does
  not exist in the predefined category tree.
- **SC-003**: 0% of parsed transactions have `counterparty` equal to
  `financialEntity` (the bank sender).
- **SC-004**: Account suggestions are derived only from recognized bank registry
  entries — no AI-hallucinated or merchant accounts appear.
- **SC-005**: Users can identify low-confidence transactions at a glance via
  visual tagging on the review screen.
- **SC-006**: No generic "Cash" account appears in the suggestions list.
- **SC-007**: The UI enforces a maximum of 5 account cards on the setup screen.

---

## Assumptions

- The AI model (Gemini 2.5 Flash-Lite) supports returning a `confidenceScore`
  field when instructed via the response JSON schema and system prompt.
- The existing category tree embedded in the Edge Function is the single source
  of truth for valid categories.
- The confidence thresholds (0.8 for high, 0.5 for needs-review) are initial
  values that may be fine-tuned based on user feedback.
- The confidence score is ephemeral — used only during the SMS review flow and
  not persisted to the database. No migration is required for this field.
- The "at most 5 suggestions" limit matches the current UI constraint on the
  Account Setup screen.
