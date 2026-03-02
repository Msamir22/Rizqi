# Feature Specification: Fix SMS Transaction & Default Cash Account Bugs

**Feature Branch**: `012-fix-sms-account-bugs`  
**Created**: 2026-03-01  
**Status**: Draft  
**Input**: Fix GitHub issues #42, #43, #44, #55, #61 — covering default cash
account bugs (duplication, wrong currency, wrong timing), SMS review UX, and
edit modal validation.  
**Deferred**: Issue #56 (SMS currency-matching account assignment) — will be
addressed in the new SMS flow redesign.

## Clarifications

### Session 2026-03-02

- Q: What should happen if Cash wallet creation fails during the final
  onboarding step? → A: Non-blocking failure. Show a brief error toast, navigate
  to home anyway. `index.tsx` silently retries on next launch. The retry must
  check if the user already has a cash account in their local currency
  (including manually created ones) before attempting creation — no duplicates.
- Q: What defines a "recognized" currency for FR-010? → A: Use the existing
  `SUPPORTED_CURRENCIES` list from `packages/logic/src/utils/currency-data.ts`
  (35 currencies). Any currency code not in this list is "unrecognized."
- Q: Should the `index.tsx` retry logic be kept or removed now that onboarding
  handles wallet creation? → A: Keep the retry as a silent safety net but remove
  the `SHOW_CASH_TOAST_KEY` flag logic entirely (no dashboard toast). The retry
  in `index.tsx` runs silently with no user-facing feedback.
- Q: Should the currency picker "Continue" button be disabled until user selects
  a currency? → A: No. Pre-select the first currency in the list (e.g., EGP).
  "Continue" is always enabled. The user can change the selection but doesn't
  have to.
- Q: How large should the chevron's hit area be for separate tap handling? → A:
  44×44pt per Apple HIG minimum. The card layout must remain visually clean —
  the expanded hit area should use `hitSlop` or padding rather than visually
  enlarging the icon.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Default Cash Account Created Once at Correct Time (Priority: P1)

A new user completes onboarding and the system automatically creates exactly one
"Cash" account in the user's local currency (e.g., EGP for Egyptian users). The
cash account is a fundamental part of the app — most people carry cash or have
bank accounts, and the app needs a default account ready for manual entries and
SMS cash withdrawal tracking.

The final onboarding step shows the user that their cash wallet is being created
with a friendly message and loading state, then confirms success before
navigating to the home page. On subsequent app restarts, no duplicate Cash
accounts appear.

**Why this priority**: A default Cash account is essential for every user. It
enables manual cash transaction entry from day one and serves as the target
account for ATM cash withdrawal SMS transactions. It must exist before any
financial tracking can begin.

**Independent Test**: Can be tested by completing onboarding, verifying a single
Cash account exists in the local currency, restarting the app, and verifying no
duplicate was created.

**Acceptance Scenarios**:

1. **Given** a new user just completed onboarding, **When** the app creates the
   default cash account, **Then** exactly one "Cash" account is created with the
   user's device-detected local currency (EGP for Egypt locale).
2. **Given** a Cash account already exists, **When** the app restarts, **Then**
   no duplicate Cash account is created.
3. **Given** the user's device locale currency cannot be detected or is
   unsupported, **When** the user is in onboarding, **Then** an additional
   onboarding step appears allowing the user to select their preferred currency
   before the Cash account is created. The first currency in the list is
   pre-selected and "Continue" is always enabled.
4. **Given** the user is on the final onboarding step, **When** the Cash wallet
   is being created, **Then** a friendly message with a loading indicator is
   displayed (e.g., "We're creating a Cash wallet for you…"), and once created,
   a success confirmation is shown (e.g., "💰 Cash wallet ready!") before
   navigating to the home screen.
5. **Given** the app is in the onboarding flow, **When** onboarding completes,
   **Then** the Cash account is created before navigating to the home screen —
   no separate toast notification on the dashboard.
6. **Given** the Cash wallet creation fails during onboarding (e.g., network
   error), **When** the error occurs, **Then** a brief error toast is shown and
   the user navigates to the home screen. The system retries silently on the
   next app launch.
7. **Given** the retry-on-launch logic runs, **When** a cash account in the
   user's local currency already exists (whether auto-created or user-created),
   **Then** no new account is created.

**Related Issues**: [#42](https://github.com/Msamir22/Astik/issues/42),
[#43](https://github.com/Msamir22/Astik/issues/43),
[#44](https://github.com/Msamir22/Astik/issues/44)

---

### User Story 2 — Chevron Expands SMS Body vs Card Opens Edit Modal (Priority: P2)

In the SMS Transaction Review page, tapping the chevron icon on a transaction
card expands/collapses the original SMS body text. Tapping the card body itself
opens the Edit Transaction modal for that transaction.

**Why this priority**: The current UX is confusing — both actions open the edit
modal. Users need to see the raw SMS to verify parser accuracy before confirming
a transaction, which is a common use case during review.

**Independent Test**: Can be tested by tapping the chevron on a parsed SMS
transaction card, verifying the original SMS text is shown, then tapping the
card body to verify the edit modal opens.

**Acceptance Scenarios**:

1. **Given** a collapsed transaction card, **When** the user taps the chevron
   icon (44×44pt touch target), **Then** the card expands to show the original
   SMS body text.
2. **Given** an expanded transaction card, **When** the user taps the chevron
   icon again, **Then** the card collapses and hides the SMS body text.
3. **Given** a transaction card (expanded or collapsed), **When** the user taps
   the card body (excluding the chevron and checkbox), **Then** the Edit
   Transaction modal opens.
4. **Given** a transaction card, **When** the user taps the checkbox area,
   **Then** only the selection state toggles (no expand or edit).

**Related Issues**: [#55](https://github.com/Msamir22/Astik/issues/55)

---

### User Story 3 — Edit Transaction Modal Validates Required Fields (Priority: P2)

When editing a parsed SMS transaction in the Edit Transaction modal, the system
prevents saving if required fields (account, amount, category) are missing or
invalid. Transaction data is only updated when the user explicitly taps the save
button — not during editing.

**Why this priority**: Saving a transaction with null required fields
(especially `account_id`) corrupts the database. This is a data integrity
safeguard.

**Independent Test**: Can be tested by opening the edit modal, clearing the
account selection, attempting to save, and verifying that an error is shown and
save is blocked.

**Acceptance Scenarios**:

1. **Given** the Edit Transaction modal is open, **When** the user clears the
   account selection and taps save, **Then** the form shows an "Account is
   required" error and the save is blocked.
2. **Given** the Edit Transaction modal is open, **When** the user enters zero
   or negative amount and taps save, **Then** the form shows an "Amount must be
   greater than zero" error.
3. **Given** all required fields are properly filled, **When** the user taps
   save, **Then** the transaction is saved successfully with all field values.
4. **Given** the user edits fields in the modal but does not tap save, **When**
   they close the modal, **Then** no changes are persisted to the transaction.

**Note**: The existing `transaction-validation.ts` already has
`baseTransactionSchema` (Zod) validating `amount`, `accountId`, and
`categoryId`. This should be reused for the SMS edit modal validation.

**Related Issues**: [#61](https://github.com/Msamir22/Astik/issues/61)

---

### Edge Cases

- What happens when the device locale returns an unsupported currency code for
  Cash account creation? → Show an additional onboarding step to let the user
  select their preferred currency.
- How does the system handle a transaction with an unrecognized currency during
  SMS parsing? → Ignore the transaction entirely and do not list it in the
  transaction review page.
- What happens if Cash wallet creation fails during onboarding? → Non-blocking.
  Show brief error toast, navigate to home. Retry silently on next launch, but
  only if no cash account in the user's local currency exists yet.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST create exactly one default "Cash" account per user as
  the final step of onboarding, before navigating to the home screen.
- **FR-002**: Default Cash account MUST use the user's device-detected local
  currency. If detection fails or the currency is not in `SUPPORTED_CURRENCIES`,
  the system MUST show an onboarding step allowing the user to select their
  currency from the supported list.
- **FR-003**: System MUST NOT create duplicate Cash accounts on app restart. The
  idempotency check must verify the existence of any cash account in the user's
  local currency (including manually created ones) before attempting creation.
- **FR-004**: The final onboarding step MUST display a friendly loading message
  while the Cash wallet is being created, followed by a success confirmation
  before navigating to the home screen. The existing dashboard toast for cash
  account creation MUST be removed, including the `SHOW_CASH_TOAST_KEY`
  AsyncStorage usage in both `index.tsx` and `(tabs)/index.tsx`. The `index.tsx`
  retry MUST remain as a silent safety net (no toast, no flag).
- **FR-005**: In the SMS Transaction Review list, tapping the chevron icon MUST
  expand/collapse the original SMS body text. The chevron MUST have a minimum
  44×44pt touch target (via `hitSlop` or padding) while keeping the card
  visually clean.
- **FR-006**: In the SMS Transaction Review list, tapping the card body
  (excluding chevron and checkbox) MUST open the Edit Transaction modal.
- **FR-007**: The Edit Transaction modal MUST validate that `account_id`,
  `amount`, and `category` are non-empty before allowing save, reusing the
  existing `validateTransactionForm` from `transaction-validation.ts`.
- **FR-008**: The Edit Transaction modal MUST only persist field changes when
  the user explicitly taps the save button.
- **FR-009**: The Edit Transaction modal MUST display clear inline error
  messages for any validation failures.
- **FR-010**: SMS transactions whose currency is not in `SUPPORTED_CURRENCIES`
  (from `currency-data.ts`) MUST be ignored and excluded from the transaction
  review page.

### Key Entities _(include if feature involves data)_

- **Account**: Represents a financial account. The default Cash account is a
  special case with `type = 'CASH'`. Currency attribute is set from device
  locale or user selection.
- **ParsedSmsTransaction**: In-memory representation of an SMS-parsed
  transaction. Contains currency, amount, sender, and resolved account_id.
  Transactions with unrecognized currencies are excluded from review.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After onboarding, users have exactly one Cash account in their
  local currency (zero duplicates across 10 consecutive app restarts).
- **SC-002**: Users who cannot have their currency auto-detected are presented
  with a currency selection step — 100% of users complete onboarding with a
  correctly-currencied Cash account.
- **SC-003**: Users can expand/collapse the original SMS body via the chevron
  icon without accidentally opening the edit modal.
- **SC-004**: 0% of transactions can be saved through the edit modal with empty
  required fields (account, amount, or category).
