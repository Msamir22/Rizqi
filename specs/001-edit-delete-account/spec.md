# Feature Specification: Edit Account & Delete Account

**Feature Branch**: `001-edit-delete-account`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: GitHub Issue #45 — "feat: Implement Edit Account and Delete Account
functionality"

## Clarifications

### Session 2026-03-18

- Q: How should the "Balance Adjustment" category be managed for tracked balance
  changes? → A: Two **system-managed categories** are required: "Balance
  Adjustment (Income)" (type: INCOME) for positive adjustments and "Balance
  Adjustment (Expense)" (type: EXPENSE) for negative adjustments. These are
  auto-created via database migration, non-deletable, and always available.
- Q: Can a user have two accounts with the same name? → A: Account names must be
  **unique per name + currency per user**. Duplicate validation is shown
  **inline under the name field** before the user taps Save, so they can adjust
  immediately.
- Q: What feedback does the user see after a successful save or delete? → A: A
  brief **success toast** that auto-dismisses: "Account updated" after save,
  "Account deleted" after delete.
- Q: Does the DIGITAL_WALLET account type have any special fields? → A: No.
  DIGITAL_WALLET is treated the same as CASH — only name, balance, and default
  toggle. No additional fields in v1.
- Q: Is the Save button always enabled or only when a field is modified? → A:
  Save is **disabled (dimmed) until at least one field value differs** from the
  original. Tapping a disabled Save does nothing.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit Account Details (Priority: P1)

A user navigates to an existing account (e.g., "CIB Checking") and opens the
Edit Account screen. The screen displays a header section with the account's
avatar icon, name, and type badge, followed by a form pre-filled with the
account's current details. The user modifies editable fields (account name,
balance, bank details, default account toggle) and taps "Save Changes" to
persist the updates.

**Why this priority**: Editing account details is the core value of this
feature. Users need to correct mistakes (e.g., typos in account names), update
balances, and modify bank-specific metadata. Without this, users would have to
delete and recreate accounts.

**Independent Test**: Can be fully tested by opening the Edit Account screen for
an existing account, modifying the account name and balance, saving, and
verifying the updated values persist on the accounts list.

**Acceptance Scenarios**:

1. **Given** a user has an existing bank account "CIB Checking" with EGP
   currency, **When** they navigate to Edit Account, **Then** the screen
   displays a header with gradient avatar, account name, and "Bank Account" type
   badge, followed by a pre-filled form with all editable fields.
2. **Given** the Edit Account form is displayed, **When** the user changes the
   account name from "CIB Checking" to "CIB Savings", **Then** the name field
   updates in real-time and passes validation.
3. **Given** the Edit Account form has modified fields, **When** the user taps
   "Save Changes", **Then** the changes are persisted locally and the user is
   navigated back with the updated data visible.
4. **Given** the user has a bank-type account, **When** the Edit Account form is
   displayed, **Then** the bank details section (bank name, card last 4, SMS
   sender) is visible and editable.
5. **Given** the user has a cash-type account, **When** the Edit Account form is
   displayed, **Then** the bank details section is hidden.

---

### User Story 2 - Read-Only Fields Communication (Priority: P1)

When editing an account, the account type and currency fields are displayed as
disabled dropdowns with lock icons. The user clearly understands why these
fields cannot be changed.

**Why this priority**: Equal to P1 because this directly affects the Edit
Account experience. Poorly communicated restrictions lead to confusion and
support issues.

**Independent Test**: Can be tested by opening the Edit Account screen and
verifying that account type and currency fields appear disabled with lock icons
and explanatory information.

**Acceptance Scenarios**:

1. **Given** the Edit Account form is displayed, **When** the user views the
   "Account Type" field, **Then** it appears as a disabled dropdown with a lock
   icon and the current type value (e.g., "Bank Account").
2. **Given** the Edit Account form is displayed, **When** the user views the
   "Currency" field, **Then** it appears as a disabled dropdown with a lock
   icon, showing the current currency (e.g., "EGP - Egyptian Pound").
3. **Given** the Edit Account form is displayed, **When** the user taps on
   either the Account Type or Currency disabled dropdown, **Then** the dropdown
   does not open, and an informational tooltip or message explains why the field
   cannot be changed (e.g., "Cannot be changed after creation").

---

### User Story 3 - Delete Account with Confirmation (Priority: P2)

A user wants to delete an account they no longer use. From the Edit Account
screen, they tap the "Delete Account" danger zone. A confirmation bottom sheet
appears, warning them about the consequences (data loss including linked
transactions and transfers). The user can confirm or cancel.

**Why this priority**: Delete is a destructive action and less commonly used
than editing. It is important but secondary to the core editing functionality.

**Independent Test**: Can be tested by opening the Edit Account screen, tapping
"Delete Account", verifying the confirmation bottom sheet appears with accurate
data counts, and confirming the deletion removes the account and all linked
records.

**Acceptance Scenarios**:

1. **Given** the Edit Account screen is displayed, **When** the user taps the
   "Delete Account" danger zone card, **Then** a confirmation bottom sheet
   slides up with a warning icon, the account name, and a data loss warning.
2. **Given** the delete confirmation bottom sheet is shown, **When** the bottom
   sheet displays, **Then** it shows the exact count of linked transactions and
   transfers that will be deleted (e.g., "This will remove 142 transactions and
   8 transfers").
3. **Given** the delete confirmation is shown, **When** the user taps "Delete
   Account" (red button), **Then** the account and all linked transactions,
   transfers, and bank details are permanently removed.
4. **Given** the delete confirmation is shown, **When** the user taps "Cancel",
   **Then** the bottom sheet dismisses and no data is modified.
5. **Given** the user confirms deletion, **When** the account is removed,
   **Then** the user is navigated back to the accounts list, and the deleted
   account no longer appears.

---

### User Story 4 - Default Account Protection on Delete (Priority: P2)

If the account being deleted is the user's default account, the system handles
the default designation appropriately to avoid leaving the user without a
default account.

**Why this priority**: Edge case that must be handled to prevent a broken state,
but it is not a primary flow.

**Independent Test**: Can be tested by setting an account as default, deleting
it, and verifying another account is automatically promoted to default (or the
flag is cleared if it's the last account).

**Acceptance Scenarios**:

1. **Given** the user has a default account and other non-default accounts,
   **When** the user deletes the default account, **Then** the system removes
   the default flag and does not automatically assign a new default (user can
   set one manually).
2. **Given** the user has only one account and it is the default, **When** the
   user deletes it, **Then** the account is deleted and the accounts list shows
   an empty state.

---

### User Story 5 - Navigate to Edit Account (Priority: P1)

The user can access the Edit Account screen from multiple entry points: (a) the
Accounts tab's account list, and (b) the dashboard's AccountsSection widget.
Tapping on any account card navigates to the Edit Account screen for that
specific account.

**Why this priority**: Without a navigation entry point, the Edit Account screen
is unreachable. This is a prerequisite for all other stories.

**Independent Test**: Can be tested by tapping on an account card from either
the Accounts tab or the dashboard, and verifying the Edit Account screen opens
with the correct account data pre-filled.

**Acceptance Scenarios**:

1. **Given** the user is on the Accounts tab with a list of accounts, **When**
   the user taps on an account card (e.g., "CIB Checking"), **Then** the Edit
   Account screen opens with that account's details pre-filled.
2. **Given** the user is on the Dashboard and the AccountsSection shows account
   cards, **When** the user taps on an account card, **Then** the Edit Account
   screen opens with that account's details pre-filled.
3. **Given** the user taps on an account card from any entry point, **When** the
   Edit Account screen loads, **Then** all fields (name, type, currency,
   balance, bank details if applicable, default toggle) reflect the current
   account state.

---

### User Story 6 - Balance Adjustment Tracking (Priority: P1)

When a user changes the account balance on the Edit Account screen and taps
"Save Changes", a "Balance Changed" bottom sheet appears. The user is shown the
previous balance, new balance, and difference. They must choose how to handle
the change: (a) **Just Update Balance** — correct the balance silently without
any transaction record, or (b) **Track as Transaction** — record the difference
as an income or expense transaction under a "Balance Adjustment" category.

**Why this priority**: Balance tracking is critical for financial accuracy.
Users who manually adjust an account balance need the option to either silently
correct it or maintain a full audit trail. This directly impacts data integrity
and user trust.

**Independent Test**: Can be tested by changing the balance value on the Edit
Account screen, tapping Save, verifying the bottom sheet appears with correct
calculations, selecting each option, and confirming the expected outcome (no
transaction vs. new transaction created).

**Acceptance Scenarios**:

1. **Given** the user has modified the balance from EGP 15,230.50 to EGP
   18,500.00, **When** the user taps "Save Changes", **Then** a "Balance
   Changed" bottom sheet appears showing: previous balance, new balance, and
   difference (+EGP 3,269.50 in green).
2. **Given** the Balance Changed bottom sheet is shown, **When** the user
   selects "Just Update Balance" and confirms, **Then** the account balance is
   updated directly without creating any transaction record.
3. **Given** the Balance Changed bottom sheet is shown, **When** the user
   selects "Track as Transaction" and confirms, **Then** a transaction of the
   difference amount is created (as income for positive difference, expense for
   negative) in the "Balance Adjustment" category, and the balance is updated.
4. **Given** the balance has decreased (e.g., from EGP 18,500 to EGP 15,000),
   **When** the bottom sheet appears, **Then** the difference is shown in red as
   a negative value (−EGP 3,500.00).
5. **Given** the user has modified fields other than balance (e.g., only renamed
   the account), **When** the user taps "Save Changes", **Then** the Balance
   Changed bottom sheet does NOT appear and the save happens directly.

---

### Edge Cases

- What happens when the user tries to save with an empty account name? →
  Validation error shown, save is blocked (existing `account-validation.ts`
  schema enforces this).
- What happens when the user enters a name that matches another account with the
  same currency? → Inline validation error appears under the name field
  immediately (e.g., "An account named 'Cash' with EGP already exists"). Save is
  blocked until resolved.
- What happens when the user enters a negative balance? → Allowed, as accounts
  can have negative balances (e.g., overdrafts). The existing Zod validation
  will be updated to remove the non-negative constraint for edits.
- What happens when the user changes the balance to a value with more decimal
  places than the currency supports? → The value is rounded to the currency's
  decimal precision.
- What happens if the user navigates back without saving? → Changes are
  discarded (no unsaved-changes prompt in v1).
- What happens when the user deletes an account while offline? → The deletion is
  queued for local processing and synced when connectivity is restored.
- What happens when the user edits the "Set as Default" toggle to ON? → The
  previously default account loses its default status (only one default allowed
  at a time). A database constraint MUST enforce that at most one account can
  have `is_default = true` per user.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an Edit Account screen accessible by tapping
  on an existing account card from both the Accounts tab list and the
  Dashboard's AccountsSection.
- **FR-002**: System MUST pre-fill the Edit Account form with the selected
  account's current data (name, type, currency, balance, bank details, default
  status).
- **FR-003**: System MUST allow editing of account name, balance, default
  account toggle, and bank details (bank name, card last 4, SMS sender name) for
  bank-type accounts.
- **FR-004**: System MUST display account type and currency as disabled
  dropdowns with lock icons. Tapping the lock icon MUST show a well-styled
  custom tooltip (not the native tooltip) explaining that the field cannot be
  changed after creation (e.g., "Cannot be changed after creation").
- **FR-005**: System MUST validate the Edit Account form using the existing
  `account-validation.ts` Zod schema. Additionally, account name uniqueness (per
  name + currency per user) MUST be validated **inline** under the name field as
  the user types, before tapping Save.
- **FR-006**: System MUST validate that "Card Last 4" contains exactly 4 numeric
  digits when provided (for bank-type accounts).
- **FR-007**: System MUST persist all editable field changes locally when the
  user taps "Save Changes".
- **FR-008**: System MUST enforce the single-default-account constraint — when
  the user toggles "Set as Default Account" to ON, any previously default
  account MUST be unset. A database-level constraint MUST ensure no more than
  one account per user has `is_default = true`.
- **FR-009**: System MUST display a "Delete Account" danger zone card on the
  Edit Account screen with a clear warning message.
- **FR-010**: System MUST show a confirmation bottom sheet before deleting an
  account, displaying a warning icon, the account name, balance, and the count
  of linked transactions and transfers.
- **FR-011**: System MUST cascade-delete all records linked to the account
  (transactions, transfers, bank details, debts, recurring payments) when the
  user confirms deletion.
- **FR-012**: System MUST navigate the user back to the accounts list after a
  successful save or delete operation, and display an auto-dismissing success
  toast (3 seconds): "Account updated" after save, "Account deleted" after
  delete.
- **FR-013**: System MUST conditionally show the bank details section only for
  accounts of type "BANK". Accounts of type "CASH" and "DIGITAL_WALLET" display
  only name, balance, and default account toggle (no additional fields).
- **FR-014**: System MUST support offline operations — both edit and delete
  actions must work without network connectivity and sync when online.
- **FR-015**: When the user modifies the balance and taps "Save Changes", the
  system MUST present a "Balance Changed" bottom sheet showing the previous
  balance, new balance, and difference.
- **FR-016**: The "Balance Changed" bottom sheet MUST offer two options: (a)
  "Just Update Balance" — updates the balance directly without creating a
  transaction, and (b) "Track as Transaction" — creates a transaction for the
  difference amount using the appropriate system category: "Balance Adjustment
  (Income)" for positive differences, "Balance Adjustment (Expense)" for
  negative differences.
- **FR-017**: The "Balance Changed" bottom sheet MUST NOT appear if the balance
  has not been modified (i.e., only other fields were changed).
- **FR-018**: Two system-managed transaction categories MUST be seeded in the
  categories table via database migration: "Balance Adjustment (Income)" (type:
  INCOME) and "Balance Adjustment (Expense)" (type: EXPENSE). These categories
  MUST NOT be deletable or renamable by the user.
- **FR-019**: System MUST enforce account name uniqueness per user at the
  **name + currency** level. Two accounts belonging to the same user cannot
  share the same name and the same currency. Different currencies are allowed
  (e.g., "Savings" in EGP and "Savings" in USD).
- **FR-020**: The "Save Changes" button MUST be visually disabled (dimmed) until
  at least one field value differs from the account's original data. Tapping a
  disabled Save button has no effect.

### Key Entities _(include if feature involves data)_

- **Account**: The primary entity being edited or deleted. Key attributes: name,
  type (CASH / BANK / DIGITAL_WALLET), currency, balance, is_default. Related to
  bank_details (1:1 for BANK type), transactions (1:many), and transfers
  (1:many).
- **Bank Details**: Optional child entity of Account (BANK type only). Key
  attributes: bank_name, card_last_4, sms_sender_name.
- **Transaction**: Financial record linked to an account. Cascade-deleted when
  the parent account is removed.
- **Transfer**: Movement of funds between two accounts. Cascade-deleted when
  either linked account is removed.
- **Balance Adjustment Categories**: Two system-managed, non-deletable
  categories seeded via migration: "Balance Adjustment (Income)" (type: INCOME)
  and "Balance Adjustment (Expense)" (type: EXPENSE). Used exclusively for
  tracked balance change transactions.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can navigate to the Edit Account screen, modify fields, and
  save changes in under 30 seconds for a typical edit (e.g., renaming an
  account).
- **SC-002**: 100% of saved edits persist correctly and are visible immediately
  upon returning to the accounts list.
- **SC-003**: The delete confirmation bottom sheet correctly displays the count
  of linked records (transactions and transfers) with zero inaccuracies.
- **SC-004**: After deletion, the account and all linked records (transactions,
  transfers, bank details) are completely removed with no orphaned data.
- **SC-005**: Read-only fields (account type, currency) are visually distinct
  from editable fields, with 100% of test users understanding they cannot be
  changed (validated by the presence of lock icons and explanatory text).
- **SC-006**: All edit and delete operations function correctly in offline mode
  and sync successfully when connectivity is restored.

## Assumptions

- The existing `add-account.tsx` form patterns (validation, field types,
  styling) will be reused and adapted for the Edit Account screen.
- The existing `account-validation.ts` Zod schema will be reused for validation
  in edit mode, with adjustments as needed (e.g., allowing negative balance for
  edits).
- Navigation to the Edit Account screen will be triggered by tapping on an
  existing `AccountCard` in the Accounts tab list, as well as tapping account
  cards in the Dashboard's `AccountsSection` component.
- The initial version (v1) will not include an "unsaved changes" confirmation
  when navigating away — changes are simply discarded.
- When the balance is changed, the user must explicitly choose between a silent
  update or a tracked transaction via the "Balance Changed" bottom sheet.
- The "Account Type" badge in the header uses blue (#3B82F6) for BANK, green
  (#10B981) for CASH, and violet (#8B5CF6) for DIGITAL_WALLET, consistent with
  existing iconography.
