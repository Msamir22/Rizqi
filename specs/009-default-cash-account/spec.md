# Feature Specification: Default Cash Account

**Feature Branch**: `009-default-cash-account`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Auto-create a default Cash account after
onboarding, with a fun notification. Replace lazy cash account creation in
batch-sms-transactions."

## Clarifications

### Session 2026-02-26

- Q: Should users be allowed to manually create additional CASH-type accounts
  beyond the system-created one? → A: Yes. Multiple CASH accounts are allowed.
  ATM routing uses the first CASH account found by query. Users will review the
  transaction/transfer before it is saved, so they can change the destination
  account.
- Q: If no CASH account can be found or created at ATM-processing time, what
  should happen to the ATM withdrawal? → A: Skip the ATM/bank withdrawals and
  show a message to the user that they were skipped because no Cash account
  exists to link them.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Cash Account Auto-Created on First Launch (Priority: P1)

A new user installs Astik, swipes through the onboarding carousel, and taps "Get
Started." Behind the scenes the system creates a Cash account in their preferred
currency. A playful toast notification appears, welcoming them with a message
like **"💰 We set up a Cash wallet for you — because who leaves the house
without their pocket money?"**

The user lands on the Dashboard and sees the Cash account already listed
alongside any future bank accounts, ready to receive transactions.

**Why this priority**: Every user has physical cash. Having a Cash account from
day one removes friction for the most common first action (adding a cash
transaction) and ensures ATM withdrawals always have a destination account.

**Independent Test**: Can be fully tested by completing onboarding as a new user
and verifying the Cash account appears on the Dashboard.

**Acceptance Scenarios**:

1. **Given** a new user who has never opened the app, **When** they complete
   onboarding (tap "Get Started" on the last slide), **Then** a Cash account is
   automatically created with the user's preferred currency and zero balance.
2. **Given** a new user completing onboarding, **When** the Cash account is
   created successfully, **Then** a playful toast notification is shown
   acknowledging the Cash account creation.
3. **Given** a user who skips onboarding (taps "Skip"), **When** they land on
   the Dashboard, **Then** a Cash account is still auto-created for them.

---

### User Story 2 — Returning User Not Duplicated (Priority: P1)

A returning user who already has a Cash account (from a previous onboarding or
SMS setup) opens the app after an update. The system checks for an existing Cash
account and does **not** create a duplicate. No notification is shown.

**Why this priority**: Data integrity — duplicate accounts would corrupt
balances and confuse the user.

**Independent Test**: Can be tested by onboarding twice (clearing `hasOnboarded`
flag but keeping DB) and verifying only one Cash account exists.

**Acceptance Scenarios**:

1. **Given** a user who already has a Cash account, **When** the auto-creation
   logic runs, **Then** no duplicate account is created.
2. **Given** a user with an existing Cash account, **When** they re-open the
   app, **Then** no notification about Cash account creation is shown.

---

### User Story 3 — ATM Withdrawals Use the Cash Account (Priority: P2)

A user scans SMS transactions that include ATM withdrawals. The system routes
ATM withdrawals to the existing Cash account (auto-created during onboarding)
instead of lazily creating one at transaction save time.

**Why this priority**: Removes the need for the current lazy-creation codepath,
simplifying the SMS transaction save flow.

**Independent Test**: Can be tested by scanning SMS with ATM withdrawals and
verifying the transfer destination is the existing Cash account.

**Acceptance Scenarios**:

1. **Given** a user who completed onboarding and has a Cash account, **When**
   they scan SMS with ATM withdrawals, **Then** the ATM transfer destination is
   pre-filled with the first Cash account found.
2. **Given** a user with a Cash account in EGP, **When** an ATM withdrawal is
   processed, **Then** the Cash account balance is updated correctly.
3. **Given** a user with multiple CASH accounts, **When** an ATM withdrawal is
   detected, **Then** the system pre-fills the first Cash account but the user
   can change the destination during the review step before saving.
4. **Given** a user with no CASH account (deleted or never created), **When**
   ATM withdrawals are found during SMS scan, **Then** they are skipped and the
   user sees a message explaining withdrawals were skipped because no Cash
   account exists.

---

### Edge Cases

- What happens if account creation fails mid-onboarding (network error, DB
  lock)? → No error is shown during onboarding. Any downstream flow that depends
  on the Cash account (ATM withdrawal routing, SMS setup, manual transaction
  entry) MUST detect its absence and retry creation before proceeding. This
  cascading fallback ensures the Cash account is eventually created even if
  onboarding failed.
- What happens if the user changes their preferred currency after onboarding? →
  The Cash account keeps its original currency. Currency changes apply to new
  accounts only.
- What happens if the user manually deletes the Cash account and no other Cash
  accounts exist? → The system warns the user before deletion: "Without a Cash
  account, ATM withdrawals from SMS scans won't be tracked." If the user
  confirms, the account stays deleted. Future ATM withdrawals are skipped during
  SMS processing and the user is shown a message explaining that withdrawals
  were skipped because no Cash account exists.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST automatically create a single "Cash" account with zero
  balance when a new user completes onboarding (both "Get Started" and "Skip"
  paths).
- **FR-002**: The Cash account MUST use the user's preferred currency (detected
  from device locale or user setting).
- **FR-003**: System MUST NOT auto-create a Cash account if any CASH-type
  account already exists for the user. Users MAY manually create additional CASH
  accounts.
- **FR-004**: System MUST show a playful, non-blocking toast notification upon
  successful Cash account creation. The tone should be warm and humorous (e.g.,
  "pocket money" or "wallet in your pocket" themed).
- **FR-005**: System MUST retry Cash account creation on next app launch if the
  initial attempt fails silently.
- **FR-006**: The existing lazy cash-account creation in the SMS transaction
  save flow MUST be removed once this feature is implemented (replaced by a
  lookup of the pre-existing Cash account).
- **FR-007**: ATM withdrawal processing MUST look up the first existing CASH
  account (by query order) and pre-fill it as the transfer destination. The user
  can change this during the review step before saving. If no CASH account
  exists, ATM withdrawals MUST be skipped and the user MUST see a message
  explaining that withdrawals were skipped due to no Cash account.
- **FR-008**: Any flow that depends on a Cash account (ATM withdrawal routing,
  SMS transaction save) MUST check for its existence and attempt to create it if
  missing, as a fallback for failed onboarding creation.
- **FR-009**: When a user attempts to delete their only Cash account, the system
  MUST show a warning explaining that ATM withdrawals from SMS scans will no
  longer be tracked. Deletion proceeds only after user confirmation.

### Key Entities

- **Cash Account**: A standard Account entity with `type = "CASH"`,
  `name = "Cash"`, `balance = 0`, created in the user's preferred currency. One
  per user, auto-created.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of new users have a Cash account within 2 seconds of
  completing onboarding.
- **SC-002**: Zero duplicate Cash accounts exist for any user in the system.
- **SC-003**: The playful notification is visible for at least 3 seconds and
  does not block user interaction.
- **SC-004**: ATM withdrawal processing during SMS scan completes without
  creating new accounts — it uses the pre-existing Cash account.
- **SC-005**: The lazy `findOrCreateCashAccount` codepath in SMS batch
  processing is fully removed.

## Assumptions

- The user's preferred currency is available at onboarding time via device
  locale detection (already implemented: region-to-currency auto-detection).
- Toast notification infrastructure already exists in the app (`useToast` hook).
- The `accounts` table already supports `type = "CASH"` (confirmed in existing
  schema).
