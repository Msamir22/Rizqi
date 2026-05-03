# Feature Specification: Finalize Transactions Module (v2)

**Feature Branch**: `004-finalize-transactions`  
**Created**: 2026-02-15  
**Updated**: 2026-02-15 (v2 — incorporates user feedback)  
**Status**: Draft v2

## Clarifications

### Session 2026-02-15

- Q: When a Transaction with linked relationships (linkedDebtId, linkedAssetId,
  linkedRecurringId) is converted to a Transfer (or vice versa), what should
  happen to those linkages? → A: Allow with warning — show a warning listing the
  affected linkages, let the user proceed. Linkages stay on the soft-deleted
  record only (audit trail).
- Q: When converting a Transfer to a Transaction, which account becomes the
  transaction's accountId? → A: User picks — default to fromAccountId but let
  the user change it in the single-account selector.
- Q: If a user is editing a transaction and a background sync delivers a change
  to the same record, what should happen? → A: Last-write-wins — the local save
  overwrites whatever came from sync (existing WatermelonDB default behavior).

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Edit Transaction (Priority: P1)

A user notices they entered the wrong amount, category, note, or even the wrong
transaction type for a transaction. They tap the transaction in the list, and
the Edit Transaction screen opens with all current values pre-populated. They
can modify any field — including changing the type (Income ↔ Expense) and the
associated account — and save.

**Acceptance Scenarios**:

1. **Given** a user has an existing expense of EGP 150 in "Food & Drinks",
   **When** they tap it in the list, **Then** the Edit Transaction screen opens
   with all fields pre-populated.
2. **Given** the Edit Transaction screen is open, **When** the user changes the
   amount from 150 to 200, **Then** the amount display updates and shows the
   original amount for comparison.
3. **Given** the Edit Transaction screen is open, **When** the user changes the
   category from "Food & Drinks" to "Shopping", **Then** the category chip,
   icon, and color update.
4. **Given** the user changes the amount from 150 to 200 (type EXPENSE) and
   saves, **Then** the account balance decreases by an additional 50.
5. **Given** the Edit Transaction screen is open, **When** the user taps the
   type selector to change from EXPENSE to INCOME, **Then** the type changes and
   the account balance adjusts by `+2 × amount` upon save.
6. **Given** the Edit Transaction screen is open, **When** the user changes the
   account from "Main Wallet" to "Savings", **Then** the old account balance
   reverts and the new account balance applies the transaction effect upon save.
   Cross-currency swaps are allowed — the same numeric amount is used in the new
   account's currency.
7. **Given** the Edit Transaction screen is open for a transaction linked to a
   recurring payment, **Then** a warning informs them that only this instance is
   being edited, with a link to navigate to the recurring template's edit page.
8. **Given** the user taps the back button with unsaved changes, **Then** a
   discard confirmation dialog appears.
9. **Given** the user edits the date, **Then** the transaction moves to the
   correct date group in the list after saving.

---

### User Story 2 — Edit Transfer (Priority: P1)

A user taps a transfer in the transaction list and the Edit Transfer screen
opens, allowing them to modify the amount, from/to accounts, date, and notes.

**Acceptance Scenarios**:

1. **Given** a user taps a transfer in the list, **Then** the Edit Transfer
   screen opens with pre-populated values (amount, from account, to account,
   date, notes).
2. **Given** the user changes the amount from 500 to 700, **Then** both account
   balances adjust correctly (from account debited by +200 more, to account
   credited +200 more).
3. **Given** the user swaps the from/to accounts, **Then** balances for both
   accounts fully revert and re-apply.

---

### User Story 3 — Convert Transaction to Transfer (Priority: P2)

A user realizes that a transaction they entered was actually a transfer between
accounts. They open the Edit Transaction screen, switch the type to "Transfer",
select the destination account, and save. The system soft-deletes the original
transaction and creates a new transfer record atomically.

**Acceptance Scenarios**:

1. **Given** the user is on the Edit Transaction screen, **When** they switch
   the type tab to "Transfer", **Then** the UI changes to show From/To account
   selectors instead of a single account + category.
2. **Given** the user completes the transfer fields and saves, **Then** the
   original transaction is soft-deleted, a new transfer is created, and account
   balances are adjusted atomically.
3. **Given** the conversion fails (e.g., same from/to account), **Then** an
   error is displayed and no changes are persisted.
4. **Given** the transaction has linked relationships (debt, asset, or
   recurring), **When** the user switches to Transfer, **Then** a warning lists
   the affected linkages. The user can proceed or cancel. Linkages remain on the
   soft-deleted transaction record.

---

### User Story 3b — Convert Transfer to Transaction (Priority: P2)

A user realizes a transfer they entered was actually a regular transaction. They
open the Edit Transfer screen, switch the type to "Expense" or "Income", and
save. The system soft-deletes the original transfer and creates a new
transaction record atomically.

**Acceptance Scenarios**:

1. **Given** the user is on the Edit Transfer screen, **When** they switch the
   type tab to "Expense" or "Income", **Then** the UI changes to show a single
   account + category selector, defaulting to the transfer's `fromAccountId`.
2. **Given** the user completes the transaction fields and saves, **Then** the
   original transfer is soft-deleted, a new transaction is created, and balances
   are adjusted atomically.
3. **Given** the user switches to "Expense" and the default account is
   pre-selected, **When** they tap the account selector, **Then** they can
   change to any other account.

---

### User Story 4 — Unit Tests for Transaction Logic (Priority: P2)

Unit tests cover all service functions, validation logic, and edge cases
including type changes, account swaps, and balance calculations.

**Acceptance Scenarios**:

1. `createTransaction` with EXPENSE → balance decreases.
2. `updateTransaction` changing amount → balance delta applied correctly.
3. `updateTransaction` changing type (EXPENSE→INCOME) → balance adjusts by
   `2 × amount`.
4. `updateTransaction` changing account → old account reverts, new account
   applies.
5. `deleteTransaction` on EXPENSE → balance increases, record soft-deleted.
6. `batchDeleteDisplayTransactions` → all records soft-deleted, all balances
   adjusted atomically.
7. `validateTransactionForm` with empty amount → returns error.

---

### User Story 5 — E2E Testing (Priority: P3)

Automated E2E tests simulate real user interactions for the complete
transactions module.

**Acceptance Scenarios**:

1. Create a transaction and verify it appears in the list.
2. Edit a transaction's category only (tap category in the list → quick edit).
3. Edit a transaction's amount only (tap amount in the list → quick edit).
4. Open edit screen, swap the account, save, verify balances.
5. Open edit screen, change transaction type, save, verify balance adjustment.
6. Delete a transaction from the edit screen and verify removal.
7. Filter transactions by type and verify correct filtering.
8. Search transactions by counterparty name.

---

### User Story 6 — UX Polish (Priority: P4)

Polish the transactions module for a premium user experience.

**Acceptance Scenarios**:

1. Calculator keypad styling matches the mockup exactly.
2. Account and Category selectors are in the same horizontal row.
3. Delete button is inside the keypad area as shown in the mockup.
4. Delete and Discard modals are generic, reusable components.
5. Recurring transaction warning includes a navigation link to the template's
   edit page.
6. The Edit Transaction screen header shows "Edit Transaction" and transitions
   smoothly from the list.

---

### Edge Cases

- **Cross-currency account swap**: Allowed — the same numeric amount is applied
  to the new account in its currency. No automatic conversion.
- **Converting transfer to transaction**: Supported — soft-deletes the transfer
  and creates a new transaction atomically.
- **Editing a soft-deleted transaction**: Not accessible from the list (filtered
  out).
- **Editing while offline**: All changes persist locally and sync when
  connectivity resumes.
- **Amount set to 0**: Validation rejects it — amount must be > 0.
- **Type change with linked debt/asset**: Show a warning that linkages will be
  preserved but may need manual review.
- **Conversion with linked relationships**: When converting a Transaction (with
  linkedDebtId, linkedAssetId, or linkedRecurringId) to a Transfer, a warning
  lists the affected linkages. User may proceed — linkages stay on the
  soft-deleted record only.
- **Sync conflict during editing**: Last-write-wins — the local save overwrites
  any changes delivered by background sync (default WatermelonDB behavior).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a full-screen Edit Transaction screen
  accessible by tapping a transaction in the list.
- **FR-002**: The Edit Transaction screen MUST pre-populate all current field
  values.
- **FR-003**: System MUST allow editing: amount, category, note, date,
  counterparty, transaction type, and account.
- **FR-004**: System MUST allow changing the transaction type (EXPENSE ↔ INCOME)
  via selection tabs, pre-selected with the current type.
- **FR-005**: System MUST allow changing the associated account, with correct
  balance adjustments for both old and new accounts. Cross-currency swaps are
  allowed (same numeric amount, no conversion).
- **FR-006**: System MUST atomically update account balances using the
  revert-and-apply pattern for all editable fields that affect balance (amount,
  type, account).
- **FR-007**: System MUST validate edited fields using the same rules as
  transaction creation.
- **FR-008**: System MUST show a discard confirmation when the user navigates
  back with unsaved changes.
- **FR-009**: System MUST show a warning for recurring-linked transactions,
  including a navigation link to the template's edit page.
- **FR-010**: System MUST support editing transfers from the transaction list
  (Edit Transfer screen).
- **FR-011a**: System MUST support converting a transaction to a transfer
  (soft-delete transaction + create transfer, atomic).
- **FR-011b**: System MUST support converting a transfer to a transaction
  (soft-delete transfer + create transaction, atomic).
- **FR-012**: System MUST provide unit tests for all transaction/transfer
  service functions with ≥80% coverage.
- **FR-013**: System MUST support E2E test automation covering all granular
  editing scenarios.
- **FR-014**: The Edit Transaction screen design MUST match the Add Transaction
  screen layout (calculator keypad, category chips, same color system).
- **FR-015**: Delete and Discard confirmation modals MUST be generic, reusable
  components usable across modules.
- **FR-016**: The Delete button MUST be placed inside the keypad area as shown
  in the mockup.
- **FR-017**: Account and Category selectors MUST be in the same horizontal row.
- **FR-018**: The Supabase account balance triggers MUST be removed via a new
  migration to prevent double-counting during sync (see
  [research.md](file:///E:/Work/My%20Projects/Monyvi/specs/004-finalize-transactions/research.md)).

### Key Entities

- **Transaction**: amount, currency, type (EXPENSE/INCOME), categoryId,
  accountId, counterparty, note, date, source, isDraft, linkedDebtId,
  linkedAssetId, linkedRecurringId.
- **Transfer**: amount, currency, fromAccountId, toAccountId, convertedAmount,
  exchangeRate, notes, date.
- **Account**: balance, currency. One account = one currency.
- **Category**: 3-level hierarchy.

## Success Criteria _(mandatory)_

- **SC-001**: Users can edit any field of an existing transaction (including
  type and account) and save in under 15 seconds.
- **SC-002**: All transaction/transfer service functions have ≥80% unit test
  coverage.
- **SC-003**: E2E test suite covers ≥8 granular scenarios and runs on Android
  emulator.
- **SC-004**: Account balances remain mathematically accurate after any
  combination of operations.
- **SC-005**: The Edit screen passes visual review: consistent with Add
  Transaction, keypad matches mockup.
- **SC-006**: Zero regressions — all existing functionality continues to work.
- **SC-007**: Delete and Discard modals are used in ≥2 different contexts
  (proving reusability).

## Assumptions

- The existing `updateTransaction` service can be extended for type, account,
  and counterparty.
- No schema migrations are required — all fields already exist.
- The Supabase balance triggers are REMOVED — balance management is entirely in
  the app layer (see
  [research.md](file:///E:/Work/My%20Projects/Monyvi/specs/004-finalize-transactions/research.md)).
- Cross-currency account swaps are allowed — the same numeric amount is applied
  in the new account's currency.
- The Discard Changes modal is always enabled — no settings toggle (a financial
  app should prioritize data safety over convenience).
- Transfer editing uses a separate Edit Transfer route/screen (not the same as
  Edit Transaction).
- Bidirectional conversion is supported: Transaction ↔ Transfer.
- E2E testing uses Maestro (YAML-based, Expo-friendly).
