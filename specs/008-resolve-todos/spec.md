# Feature Specification: Resolve Codebase TODOs

**Feature Branch**: `008-resolve-todos`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: Resolve multiple codebase TODOs: multi-currency stats aggregation,
DRY sms-scan retry logic, AI account suggestions from SMS, unsupported currency
handling, and counterparty field rename.

## Clarifications

### Session 2026-02-25

- Q: Where are account suggestions surfaced in the user flow? → A: The SMS
  review page (`sms-review.tsx`) already has editable account cards. The current
  client-side grouping logic (`buildInitialState`) will be replaced by
  AI-generated suggestions. No new UI is needed.
- Q: Where does the user's preferred currency come from? → A: The
  `usePreferredCurrency` hook already exists. It reads from Profile → device
  locale → USD fallback.
- Q: How are existing accounts provided to the AI for dedup? → A: Client sends
  accounts, categories, AND supported currencies in the request payload
  (`ai-sms-parser-service.ts`, `invokeParseChunk`). Categories replace the
  hardcoded `CATEGORY_TREE`, and currencies replace the hardcoded currency enum
  in the edge function.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - AI Suggests Accounts From SMS Scan (Priority: P1)

When a new or existing user scans their SMS inbox, the AI should analyze the
financial messages and suggest which accounts the user needs to create, based on
the financial entities and currencies detected in the SMS content. The AI uses
fuzzy matching (bidirectional substring) against the user's existing accounts by
name AND currency to avoid duplicate suggestions. For example, if the user has
an account named "QNB" with currency EGP, and the SMS sender is "QNB EGYPT" with
EGP transactions, the AI should NOT suggest a new account. However, if "QNB
EGYPT" also has messages in USD and the user has no QNB account with USD, the AI
SHOULD suggest `{name: "QNB EGYPT", currency: "USD"}`.

The SMS review page (`sms-review.tsx`) already displays editable account cards.
The current client-side grouping logic (`buildInitialState`) will be replaced by
the AI-generated suggestions, removing the need for client-side sender grouping.

**Why this priority**: This directly enhances the onboarding and scanning
experience. Without account suggestions, users have to manually figure out which
accounts to create after scanning — a friction point that undermines the
"frictionless" value proposition.

**Independent Test**: Can be tested by initiating an SMS scan with messages from
multiple banks/wallets and verifying the AI response includes an
`accountSuggestions` array with appropriate name/currency pairs.

**Acceptance Scenarios**:

1. **Given** a new user with no accounts, **When** they scan SMS messages from
   CIB and Vodafone Cash, **Then** the AI returns suggested accounts like
   `[{name: "CIB", currency: "EGP"}, {name: "Vodafone Cash", currency: "EGP"}]`.
2. **Given** an existing user with an account named "QNB" (EGP), **When** they
   scan SMS messages from sender "QNB EGYPT" with EGP transactions, **Then** the
   AI does NOT suggest a new account (fuzzy name match + same currency).
3. **Given** an existing user with an account named "QNB" (EGP), **When** they
   scan SMS from "QNB EGYPT" with USD transactions, **Then** the AI suggests
   `{name: "QNB EGYPT", currency: "USD"}` (same entity, different currency).
4. **Given** SMS messages containing transactions in multiple currencies (EGP
   and USD), **When** the AI parses them, **Then** account suggestions reflect
   the correct currency for each financial entity.
5. **Given** a new user with no existing accounts, **When** the AI returns
   account suggestions, **Then** the suggestions array is always non-empty (at
   least one account is suggested from the SMS content).
6. **Given** account suggestions are returned, **When** one account has more SMS
   messages associated with it than others, **Then** the AI marks that account
   as the default (`isDefault: true`).

---

### User Story 2 - Unsupported Currency Handling (Priority: P1)

When the AI detects a currency in an SMS that is not in the app's supported
currency list (36 currencies), the system should silently skip that message
rather than returning it with an invalid currency value.

**Why this priority**: An unsupported currency could cause data integrity issues
downstream (invalid enum values, failed inserts). This is a data safety concern.

**Independent Test**: Can be tested by sending SMS messages with unsupported
currency codes (e.g., PKR, NGN) and verifying they are excluded from the parsed
results.

**Acceptance Scenarios**:

1. **Given** an SMS message with a transaction in PKR (unsupported), **When**
   the AI parses it, **Then** the message is excluded from the results.
2. **Given** a batch of SMS messages where some have supported currencies and
   some have unsupported currencies, **When** the AI parses them, **Then** only
   transactions with supported currencies are returned.
3. **Given** the supported currencies list changes (a new currency is added),
   **When** the AI currency enum is updated, **Then** messages in that currency
   start being parsed correctly.

---

### User Story 3 - Counterparty Field Naming Consistency (Priority: P2)

The AI response field `merchant` should be renamed to `counterparty` to match
the database column name (`transactions.counterparty`), ensuring naming
consistency across the entire data pipeline — from AI parsing to storage. The
same rename applies to the voice parsing function.

**Why this priority**: Inconsistent naming between the AI response and the
database creates confusion, complicates mapping logic, and risks bugs during
refactoring. It's a housekeeping improvement that reduces cognitive overhead.

**Independent Test**: Can be tested by verifying the AI response schema uses
`counterparty` instead of `merchant`, and all client-side mapping code
references the new field name.

**Acceptance Scenarios**:

1. **Given** the AI parses an SMS message, **When** it returns a transaction,
   **Then** the field is named `counterparty` (not `merchant`).
2. **Given** the AI parses a voice input, **When** it returns a transaction,
   **Then** the field is named `counterparty` (not `merchant`).
3. **Given** the field rename is applied, **When** the mobile app processes AI
   responses, **Then** it correctly reads from `counterparty` without errors.

---

### User Story 4 - DRY SMS Scan Retry Logic (Priority: P2)

The scan initiation logic (determining `minDate`, loading existing hashes,
calling `startScan`) is duplicated between the initial mount and the retry
handler. This should be extracted so both flows use a single shared function.

**Why this priority**: Duplicate logic increases the risk of divergence (e.g.,
fixing a bug in one place but not the other). This is a code quality
improvement.

**Independent Test**: Can be tested by initiating a scan and then retrying —
both should behave identically, exercising the same code path.

**Acceptance Scenarios**:

1. **Given** a user starts an SMS scan automatically on page load, **When** the
   scan initiates, **Then** it uses the shared scan initiation function.
2. **Given** a scan fails and the user presses "Retry", **When** the retry
   triggers, **Then** it uses the same shared scan initiation function as the
   initial scan.
3. **Given** the shared function is modified (e.g., adding a new parameter),
   **When** both the initial and retry flows are exercised, **Then** both
   reflect the change.

---

### User Story 5 - Multi-Currency Stats Aggregation (Priority: P3)

Stats and drilldown views currently hardcode `EGP` as the display currency for
aggregated amounts. Instead, aggregated stats should use the user's preferred
currency and convert amounts from each account's native currency using market
rates.

**Why this priority**: While the app already supports multi-currency accounts,
the stats view doesn't reflect this properly. This is a UX gap but lower
priority because the majority of target users (Egyptian market) primarily use
EGP.

**Independent Test**: Can be tested by setting a preferred currency to USD,
adding transactions in both EGP and USD accounts, and verifying that the stats
drilldown displays converted totals in USD.

**Acceptance Scenarios**:

1. **Given** a user has transactions in EGP and USD accounts with preferred
   currency set to USD, **When** they view the stats drilldown, **Then** all
   amounts are converted to USD using current market rates.
2. **Given** a user changes their preferred currency from EGP to EUR, **When**
   they refresh the stats view, **Then** all aggregated amounts update to
   display in EUR.
3. **Given** market rates are unavailable (offline), **When** the stats view
   renders, **Then** it gracefully falls back to displaying amounts in their
   original currency without conversion errors.

---

### Edge Cases

- What happens when the AI returns an account suggestion with a currency not in
  the user's supported list?
- How does the system handle SMS messages in mixed languages (Arabic body with
  English currency abbreviation)?
- ~~What happens when the same financial entity appears with different
  currencies (e.g., "CIB EGP" and "CIB USD")?~~ → **Resolved**: The AI suggests
  separate accounts for the same entity when the currency differs and the user
  lacks a matching account for that currency.
- How does the counterparty rename affect existing parsed data stored locally
  that was created before the rename?
- What happens when market rates are stale or missing for a specific currency
  pair during stats aggregation?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The SMS parsing AI MUST return an `accountSuggestions` array
  alongside `transactions`, containing `{name, currency}` pairs for accounts
  detected in the SMS content. This replaces the client-side `buildInitialState`
  grouping logic in `sms-review.tsx`.
- **FR-002**: The AI MUST receive the user's existing account names and
  currencies as input context and use fuzzy matching (bidirectional substring by
  name AND exact match by currency) to avoid suggesting duplicates.
- **FR-003**: If no existing accounts are provided (new user), the AI MUST
  always return at least one account suggestion based on the SMS content.
- **FR-004**: The AI MUST NOT return transactions with currencies outside the
  app's supported currency list (36 currencies).
- **FR-005**: The currency enum in the AI response schema MUST be dynamically
  derived from the client-provided supported currencies list, not hardcoded.
- **FR-005a**: The AI MUST mark one account suggestion as the default
  (`isDefault: true`), choosing the account with the highest message frequency.
- **FR-006**: The `merchant` field in both `parse-sms` and `parse-voice` AI
  response schemas MUST be renamed to `counterparty`.
- **FR-007**: All client-side code that maps the AI `merchant` field MUST be
  updated to reference `counterparty`.
- **FR-008**: The SMS scan initiation logic (minDate calculation + hash
  loading + startScan call) MUST be extracted into a single reusable function.
- **FR-009**: Both the initial mount scan and the retry handler MUST use the
  same extracted function.
- **FR-010**: Stats aggregation MUST use the user's preferred currency (from
  settings) instead of the hardcoded `DEFAULT_DISPLAY_CURRENCY` constant.
- **FR-011**: Stats aggregation MUST convert each transaction's amount from its
  account currency to the preferred currency using current market rates.
- **FR-012**: Stats aggregation MUST gracefully handle missing market rates
  (fallback to original currency or display a warning).
- **FR-013**: The client MUST send the user's existing accounts (name +
  currency), the current category hierarchy, AND the supported currencies list
  in the `parse-sms` request body, alongside the SMS messages.
- **FR-014**: The edge function MUST replace the hardcoded `CATEGORY_TREE` and
  hardcoded currency enum with the client-provided values, formatted in a
  well-structured way for AI comprehension.

### Key Entities

- **Account Suggestion**: A proposed account for the user to create, containing
  a display name (derived from the financial entity) and a currency code.
  Generated by AI during SMS parsing.
- **Supported Currencies**: The set of 36 currencies defined in the
  `currency_type` enum. Used as the source of truth for valid currency values
  across the system.
- **Counterparty**: The person, merchant, or entity on the other side of a
  transaction. Previously named `merchant` in AI responses, now unified under
  `counterparty`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of AI-parsed SMS transactions have valid currencies from the
  supported currency list.
- **SC-002**: New users completing an SMS scan receive at least one account
  suggestion without any manual account configuration beforehand.
- **SC-003**: The `merchant` field name is completely eliminated from all AI
  response schemas, client mapping code, and related type definitions.
- **SC-004**: SMS scan retry behavior is functionally identical to the initial
  scan, exercising the same code path.
- **SC-005**: Users with multi-currency accounts see stats aggregated in their
  preferred currency, with all amounts converted using current market rates.
- **SC-006**: The stats view renders without errors when market rates are
  unavailable for one or more currencies.

## Assumptions

- The `currency_type` enum in the database (36 currencies) is the authoritative
  list of supported currencies.
- The user's preferred currency is provided by the `usePreferredCurrency` hook
  (reads from Profile → device locale → USD fallback).
- Market rate conversion utilities already exist or will be provided by
  `@astik/logic`.
- The `parse-voice` edge function should also receive the counterparty rename
  for consistency, even though the primary TODOs are in `parse-sms`.
- Existing locally stored transactions with the `merchant` field (from previous
  AI responses) do not need retroactive migration — the mapping layer already
  handles the aliasing.
