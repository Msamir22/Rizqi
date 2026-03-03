# Feature Specification: Refactor SMS Transaction Flow

**Feature Branch**: `013-refactor-sms-flow` **Created**: 2026-03-02 **Status**:
Draft **Input**: User description: "Refactor the SMS transaction flow: remove
AccountSetupStep, enhance transaction review with account matching via
resolveAccountForSms, display transfer cards for cash withdrawals, and redesign
the edit modal with account dropdowns and currency conversion"

---

## Clarifications

### Session 2026-03-02

- Q: When PendingAccounts are persisted, should we also create a bank_details
  record? → A: Yes — create bank_details with sms_sender_name (from sender
  address) and cardLast4 (if detected in the SMS). This ensures future scans
  auto-match to user-created accounts.
- Q: Should currency conversion replace the amount or display alongside? → A:
  Display alongside — the amount field keeps the original value; a read-only
  notice below shows the converted amount and exchange rate.
- Q: How should the UI handle loading while resolving accounts for 100+
  transactions? → A: Batched — resolve in batches of ~20, render each batch as
  it completes so the user sees progressive results.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Direct Review After Scan (Priority: P1)

After SMS scanning completes and the AI returns parsed transactions, the user is
taken **directly** to the transaction review page. The old "Account Setup" step
(where senders were mapped to accounts) is removed entirely.

**Why this priority**: This is the core structural change — every other story
depends on the account setup step being gone. Without it, users reach review
faster (fewer taps, less friction).

**Independent Test**: Trigger an SMS scan, wait for parsed transactions, and
verify the user navigates directly to the review list without seeing any
account-setup screen.

**Acceptance Scenarios**:

1. **Given** the AI returns ≥ 1 parsed transaction, **When** the scan completes
   and the user taps "Review", **Then** the review list appears immediately (no
   account setup step).
2. **Given** the AI returns 0 transactions, **When** the scan completes,
   **Then** the empty-state screen is shown (existing behaviour, unchanged).

---

### User Story 2 — Account Matching Per Transaction Card (Priority: P1)

On the review page, each transaction card shows a matched account name:

- If the user has ≥ 1 **bank account**, the system runs account resolution (via
  `resolveAccountForSms`) and displays the matched account name on the card.
- If **no bank accounts** exist, the SMS sender display name (parsed from the
  message) is shown instead.
- Account resolution is performed in **batches of ~20 transactions**. Each batch
  renders as it completes, so the user sees progressive results rather than
  waiting for all 100+ to resolve.

**Why this priority**: This is the primary value-add — the user sees which
account each transaction belongs to _before_ editing.

**Independent Test**: Create a user with two bank accounts, scan SMS messages
from a known bank sender, and verify each transaction card displays the correct
matched account name.

**Acceptance Scenarios**:

1. **Given** the user has bank accounts **and** a parsed transaction matches one
   via sender/card, **When** the review list renders, **Then** the matched
   account name appears on that card.
2. **Given** the user has bank accounts **but** no match is found via
   sender/card/registry, **When** the review list renders, **Then** the first
   bank account is shown as a fallback on that card.
3. **Given** the user has **no** bank accounts, **When** the review list
   renders, **Then** the sender display name from the SMS is shown on each card.

---

### User Story 3 — Edit Modal: Account Selection (Priority: P1)

When a user opens the edit modal for a transaction:

- **If bank accounts exist**: A dropdown lists all user accounts. The
  pre-matched account (from `resolveAccountForSms`) is auto-selected. If no
  match was found, the first account in the list is selected (handled by the
  resolver's fallback).
- **If no bank accounts exist**: A text field is shown pre-populated with the
  SMS sender display name. A helper message below explains: _"We'll create an
  account named '{name}' in {currency}."_ Once the user saves the modal, the
  typed account is saved **in-memory** for the session and appears in the
  dropdown for subsequent transactions (same behaviour as User Story 3b).

**Why this priority**: The edit modal is the most critical user touchpoint for
correcting AI decisions.

**Independent Test**: Open the edit modal for a matched transaction and verify
the dropdown shows the correct auto-selected account. Then test with a user who
has zero bank accounts and verify the text input + helper message.

**Acceptance Scenarios**:

1. **Given** the user has bank accounts and a transaction matched to account
   "CIB", **When** the edit modal opens, **Then** the dropdown shows all
   accounts with "CIB" pre-selected.
2. **Given** the user has bank accounts but no match, **When** the edit modal
   opens, **Then** the first bank account in the list is selected by default. If
   this fallback account's currency differs from the transaction currency, the
   amount is converted and a conversion notice is shown (per User Story 4).
3. **Given** the user has **no** bank accounts, **When** the edit modal opens,
   **Then** a text input with the sender display name and a helper message is
   shown.

---

### User Story 3b — Edit Modal: Create New Account (Priority: P1)

Even when the user has existing bank accounts, the correct account for a
transaction may not be among them. The edit modal provides a toggle (e.g., a "+
New" button next to the account label) that switches the account field from a
dropdown to a text input where the user can type a new account name.

- The new account is saved **in-memory only** (React state at the review-page
  level). It is **not** written to the database at this point.
- Once created in-memory, the new account appears in the account dropdown for
  all subsequent transactions in the same SMS review session, so the user
  doesn't have to re-type it.
- The new account inherits the **transaction's currency** and is typed as
  **BANK**.
- All in-memory accounts are persisted to the database only when the user taps
  the final "Save" button to commit the review session.
- A cancel/dismiss action next to the text input returns the field to the
  dropdown.

**Why this priority**: Without this, a user with 3 bank accounts who receives an
SMS from a 4th bank has no way to assign it correctly.

**Independent Test**: Open the edit modal for a transaction, tap "+ New", type
"QNB", save the modal. Then open the edit modal for a different transaction and
verify "QNB" appears in the account dropdown.

**Acceptance Scenarios**:

1. **Given** the user has bank accounts, **When** they tap the "+ New" toggle,
   **Then** the dropdown is replaced by a text input.
2. **Given** the user types "QNB" and saves, **When** they open the edit modal
   for another transaction, **Then** "QNB" appears in the account dropdown.
3. **Given** the user taps cancel/dismiss on the text input, **When** the field
   resets, **Then** the dropdown reappears with the previously selected account.
4. **Given** the user completes the full save (commits the session), **When**
   save finishes, **Then** all in-memory accounts are persisted to the database
   with type BANK and the transaction's currency.

---

### User Story 4 — Edit Modal: Currency Conversion (Priority: P2)

When the selected account in the edit modal has a **different currency** than
the transaction:

- The system shows the converted amount as a **read-only notice** below the
  amount field (e.g., "≈ {converted} {targetCurrency} at rate {rate}").
- The amount field itself **keeps the original transaction amount** — it is not
  replaced.

When the currencies match, no conversion is needed and no notice is shown.

**Why this priority**: Important for multi-currency users (less common) but not
blocking for the core flow.

**Independent Test**: Create a user with a USD bank account, import an EGP
transaction, open the edit modal, and verify the converted amount notice appears
below the original amount.

**Acceptance Scenarios**:

1. **Given** a transaction is in EGP and the selected account is in USD,
   **When** the account is selected, **Then** the amount field keeps the
   original EGP value, and a read-only notice below shows "≈ X.XX USD at rate
   Y.YY".
2. **Given** a transaction and the selected account are in the same currency,
   **When** the account is selected, **Then** no conversion happens and no
   notice is shown.
3. **Given** the exchange rate is unavailable, **When** the user selects a
   different-currency account, **Then** the system shows a warning that the rate
   is unavailable and keeps the original amount.

---

### User Story 5 — Cash Withdrawal as Transfer Card (Priority: P2)

When a transaction is identified as a **cash withdrawal** (ATM withdrawal), the
review page displays it with a **"Cash Withdrawal"** label on the card (keeping
the current visual style). The From/To account details are only shown inside the
edit modal (User Story 6), not on the card itself.

When the user saves, if no cash account exists in that currency, one is created
automatically.

**Why this priority**: Correctly modelling withdrawals as transfers is
financially accurate and avoids double-counting.

**Independent Test**: Scan an ATM withdrawal SMS, verify the review page shows
the card with a "Cash Withdrawal" label.

**Acceptance Scenarios**:

1. **Given** a cash withdrawal transaction, **When** the review list renders,
   **Then** the card displays a "Cash Withdrawal" label (not From/To).
2. **Given** the user saves a withdrawal where no cash account exists, **When**
   save completes, **Then** a cash account in the withdrawal currency is
   auto-created and the transfer is recorded.

---

### User Story 6 — Cash Withdrawal Edit Modal (Priority: P2)

When the edit modal is opened for a cash withdrawal:

- The transaction type tabs show **only "Transfer"** (Income and Expense tabs
  are hidden).
- Two account fields are shown: **"From"** and **"To"**.
- The **"From"** field follows the same account dropdown/text-input rules as
  regular transactions (User Story 3).
- The **"To"** field:
  - **If the user has ≥ 1 cash account in the same withdrawal currency**: A
    dropdown lists those cash accounts, with the **first one auto-selected**.
  - **If the user has no cash account in that currency**: A text input
    pre-populated with "Cash" is shown, with a helper message: _"We'll create a
    cash account in {currency} for you."_

**Why this priority**: Provides correct editing UX for the cash withdrawal card
introduced in User Story 5.

**Independent Test**: Open the edit modal for a cash withdrawal, verify only
"Transfer" tab is visible, and the From/To fields render correctly.

**Acceptance Scenarios**:

1. **Given** a cash withdrawal and the user has cash accounts in EGP, **When**
   the edit modal opens, **Then** only the "Transfer" tab is shown, "From" has
   the account dropdown, and "To" has a dropdown of EGP cash accounts with the
   first one auto-selected.
2. **Given** a cash withdrawal and the user has no cash accounts, **When** the
   edit modal opens, **Then** "To" shows a text input pre-populated with "Cash"
   and a helper message about auto-creating a cash account.

---

### Edge Cases

- **Multiple bank accounts from same sender**: `resolveAccountForSms` uses
  card-last-4 matching first, falling back to sender name. If multiple accounts
  match the same sender, the first match is returned.
- **User changes account to a different currency mid-edit**: The conversion
  notice updates in real-time as the user switches accounts in the dropdown.
- **Offline / no exchange rate data**: If the exchange rate is unavailable,
  display a warning and keep the original amount without conversion.
- **Zero-amount transactions or transfers**: The system MUST NOT allow saving a
  transaction or transfer with a zero amount. Validation rejects it with an
  error message.
- **User wants to change a previously typed account name**: The user can re-open
  the edit modal, tap "+ New" again, and type a different name. Alternatively,
  they can switch back to the dropdown and select an existing account.
- **User creates an in-memory account with the same name as an existing one**:
  The system should prevent duplicates by showing a validation error if the
  typed name matches an existing account name (case-insensitive).

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST skip the Account Setup step and navigate directly from
  scan completion to the transaction review page.
- **FR-002**: System MUST remove or deprecate `AccountSetupStep`,
  `SenderAccountMapper`, `AccountCard`, and related setup utilities from the
  active code path.
- **FR-003**: System MUST run account matching (via `matchAccountCore`, called
  by `resolveAccountForSms` or `matchTransactionsBatched`) for each parsed
  transaction on the review page and display the matched account name on each
  card.
- **FR-004**: The account matching core (`matchAccountCore`) MUST include a
  final fallback (Step 5) that returns the **first bank account** if all
  previous resolution steps fail.
- **FR-005**: When no bank accounts exist for the user, the system MUST display
  the SMS sender display name on the transaction card.
- **FR-006**: The edit modal MUST show an account dropdown when the user has ≥ 1
  bank account, with the resolved account auto-selected.
- **FR-007**: The edit modal MUST show a text input pre-populated with the
  sender display name when no bank accounts exist, with a helper message
  indicating an account will be created.
- **FR-008**: When the selected account currency differs from the transaction
  currency, the system MUST display a read-only conversion notice below the
  amount field showing the converted amount and exchange rate. The original
  amount MUST be preserved in the amount field (not replaced).
- **FR-009**: Cash withdrawal transactions MUST display a "Cash Withdrawal"
  label on the review card (keeping current visual style). From/To details are
  shown only in the edit modal.
- **FR-010**: The edit modal for cash withdrawals MUST show only the "Transfer"
  type tab, hiding Income and Expense.
- **FR-011**: The edit modal for cash withdrawals MUST show "From" and "To"
  fields — "From" uses the same account rules as regular transactions; "To"
  shows a dropdown of cash accounts in the same currency (first auto-selected),
  or a text input with "Cash" and a helper message if none exist.
- **FR-012**: On final save, the system MUST first create any in-memory accounts
  that are referenced by at least one selected transaction, then save the
  transactions linked to their newly created accounts. For each persisted
  account, a `bank_details` record MUST also be created with the transaction's
  `senderAddress` as `sms_sender_name` and `cardLast4` (if detected in the SMS).
- **FR-013**: When saving a cash withdrawal where no cash account exists in that
  currency, the system MUST auto-create a cash account in that currency.
- **FR-014**: The edit modal MUST provide a toggle ("+ New" button) that allows
  the user to switch from the account dropdown to a text input for creating a
  new account, even when existing bank accounts are present.
- **FR-015**: Accounts created via the "+ New" toggle MUST be stored in-memory
  (session state) and appear in the account dropdown for all other transactions
  in the same review session. On final save, only in-memory accounts that are
  referenced by at least one selected transaction are persisted to the database.
  Unused in-memory accounts (created but never assigned to any transaction) are
  discarded.
- **FR-016**: The system MUST NOT allow saving a transaction or transfer with a
  zero amount. Validation MUST reject it with an error message.
- **FR-017**: Account resolution on the review page MUST be performed in batches
  (~20 transactions per batch). Each batch's results render progressively as
  they complete, so the user sees cards populating incrementally.

### Key Entities

- **ParsedSmsTransaction**: Transaction parsed from SMS — includes amount,
  currency, type, sender display name, counterparty, date, category. Cash
  withdrawals are identified by the `isAtmWithdrawal: boolean` field (populated
  by the AI parser).
- **ResolvedAccount**: Result of `resolveAccountForSms` — includes `accountId`
  and `accountName`.
- **TransactionEdits**: Override fields the user can change in the edit modal —
  amount, counterparty, category, type, accountId, accountName. Extended for
  transfers with `toAccountId` and `toAccountName`.
- **PendingAccount**: In-memory account created during the review session —
  includes a temporary ID, name, currency (from the transaction), type (BANK),
  senderAddress, and cardLast4 (if detected). Promoted to a real Account +
  BankDetails record on final save.
- **Account**: WatermelonDB model — includes name, type (CASH, BANK, etc.),
  currency, userId.
- **BankDetails**: WatermelonDB model — linked to Account, stores SMS sender
  name, card last 4, bank name.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users reach the transaction review page in ≤ 1 tap after scan
  completion (down from 2+ taps with Account Setup).
- **SC-002**: ≥ 90% of transactions from known bank senders are auto-matched to
  the correct account without manual editing.
- **SC-003**: Cash withdrawals are correctly displayed with a "Cash Withdrawal"
  label on the review card, and the edit modal shows the Transfer tab with
  From/To fields.
- **SC-004**: Currency conversion notice appears within 1 second of selecting a
  different-currency account.
- **SC-005**: Users with zero bank accounts see a clear text input and helper
  message, completing the flow without confusion.

---

## Assumptions

- The `resolveAccountForSms` function's existing resolution chain (card last 4 →
  sender match → bank registry → default account) is kept intact; only a new
  final step is added that returns the **first non-CASH (bank) account** as
  fallback.
- Cash withdrawal detection uses the existing `isAtmWithdrawal` boolean field on
  `ParsedSmsTransaction`, already populated by the AI parser.
- Exchange rates are available from the existing `market_rates` table in
  WatermelonDB, which stores currency-to-USD rates (e.g., `egp_usd`, `eur_usd`).
  Cross-currency conversion uses USD as the pivot currency. The `useMarketRates`
  hook provides real-time access. If no rate exists, the system warns the user
  but does not block the flow.
- The "create account on save" logic will create accounts with type **BANK** for
  new sender-based accounts and type **CASH** for auto-created cash accounts.
