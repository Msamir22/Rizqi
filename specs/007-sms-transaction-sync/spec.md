# Feature Specification: SMS Transaction Sync

**Feature Branch**: `007-sms-transaction-sync`  
**Created**: 2026-02-21  
**Updated**: 2026-02-22  
**Status**: Draft (v3 — post-clarification)  
**Input**: User description: "Implement automated SMS transaction syncing:
request READ_SMS permission, scan inbox for Egyptian financial SMS, parse
transactions with regex, show sync progress UI, and display extracted
transactions in a grouped list"

## Clarifications

### Session 2026-02-22

- Q: When does SMS sync trigger? → A: Auto-triggers once on first app launch
  after onboarding (when user arrives at dashboard). Re-sync available from
  Settings.
- Q: Where should parsed transactions go after scan? → A: To a transaction
  review page (not directly to the transaction list), where the user confirms
  before saving.
- Q: Where to store financial entity definitions? → A: In an extensible typed
  registry file in `packages/logic/src/parsers/`.
- Q: What parsing approach to use? → A: Regex/template-based with typed
  per-sender configs (offline, deterministic, testable). Architecture must use
  Strategy pattern to allow future transition to LLM-based parsing.
- Q: What about the legacy `notification-parser.ts`? → A: Start fresh; reuse
  individual patterns only if directly applicable.
- Q: Should live SMS detection be included? → A: Yes, as a separate user story
  (P3), implemented after the main feature but considered during architecture.
- Q: Where do confirmed SMS transactions get saved? → A: Into the existing
  `transactions` table with a `source` field to distinguish origin (`"manual"`,
  `"voice"`, `"sms"`).
- Q: How to identify duplicate transactions during re-scan? → A: Store a SHA-256
  hash of the original SMS body (`sms_body_hash`). Duplicates are detected by
  matching this hash.
- Q: What happens to discarded transactions on full re-scan? → A: They are not
  tracked. Discarded transactions will reappear on a full re-scan for the user
  to review again.
- Q: Does the app qualify for Google Play's READ_SMS permission? → A: Yes, under
  the "SMS-based money management" exception. Permissions Declaration Form and
  Play Store listing updates deferred to pre-production phase.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Permission Request on First Launch (Priority: P1)

A **new user** who has just completed the onboarding flow arrives at the
dashboard for the first time. The app automatically displays a clear, friendly
explanation of **why** READ_SMS access is needed (e.g., "We scan your messages
locally on your device to find bank and wallet transactions — nothing leaves
your phone"). The user can either grant permission and proceed to scanning, or
decline and stay on the dashboard.

This permission prompt triggers **only once automatically** — on the user's
first arrival at the dashboard after onboarding. If the user declines, the
prompt does not re-appear automatically. The user can manually trigger SMS sync
later from the Settings screen.

**Why this priority**: Without the permission, no other functionality in this
feature can work. This is the gate for everything else.

**Independent Test**: Can be tested by completing onboarding and arriving at the
dashboard for the first time. The explanation appears. Tapping "Allow" triggers
the native dialog. Tapping "Not Now" dismisses the prompt and user remains on
dashboard.

**Acceptance Scenarios**:

1. **Given** a new user has just completed onboarding, **When** they arrive at
   the dashboard for the first time, **Then** they see an explanation
   modal/screen describing why SMS access is needed.
2. **Given** the explanation is visible, **When** the user taps "Allow",
   **Then** the native Android permission dialog appears.
3. **Given** the native dialog is shown, **When** the user grants permission,
   **Then** the app proceeds to SMS scanning (User Story 2).
4. **Given** the explanation is visible, **When** the user taps "Not Now",
   **Then** the prompt is dismissed and the user remains on the dashboard.
5. **Given** the user previously declined the auto-prompt, **When** they
   navigate to Settings and tap "Sync SMS Transactions", **Then** the permission
   flow is triggered again.
6. **Given** the user previously denied READ_SMS permanently (via the OS),
   **When** they tap "Sync SMS Transactions" in Settings, **Then** the app shows
   a screen guiding the user to enable the permission in device Settings, with a
   button to open Settings directly.
7. **Given** the user is on iOS, **When** they view the Settings screen,
   **Then** the SMS Sync option displays an informational message explaining
   that SMS scanning is only available on Android.

---

### User Story 2 - SMS Scanning with Progress UI (Priority: P1)

After granting permission, the app begins reading the SMS inbox in the
background. The user sees a "Syncing" screen with:

- An animated circular progress indicator
- A live counter: "Messages scanned: X / Total"
- A live counter: "Transactions found: Y"

The scanning happens entirely on-device. No data is sent to any server.

Upon completion, a **success animation** (green checkmark) is displayed briefly,
then the user is redirected to the **Transaction Review Page** (User Story 4)
where they can review and confirm the parsed transactions before saving.

**Why this priority**: Core functionality — this is the main value proposition
of the feature. The progress UI provides transparency and keeps the user
informed during a potentially long operation.

**Independent Test**: Can be tested by granting SMS permission and observing the
progress screen update in real-time as messages are scanned.

**Acceptance Scenarios**:

1. **Given** SMS permission is granted, **When** scanning starts, **Then** the
   user sees an animated circular progress indicator and counters at 0 / Total.
2. **Given** scanning is in progress, **When** each message is processed,
   **Then** the "Messages scanned" counter increments in real-time.
3. **Given** a financial SMS is detected during scanning, **When** the parser
   extracts a valid transaction, **Then** the "Transactions found" counter
   increments.
4. **Given** scanning completes successfully, **When** the progress reaches
   100%, **Then** the user sees a green checkmark success animation.
5. **Given** the success animation has played, **When** it completes, **Then**
   the user is automatically redirected to the Transaction Review Page.
6. **Given** the inbox contains 0 messages, **When** scanning completes,
   **Then** the user sees an empty state message: "No messages found" and a
   button to return to the dashboard.
7. **Given** scanning is in progress, **When** the user navigates away or the
   app backgrounds, **Then** the scan should gracefully pause or cancel without
   crashing.

---

### User Story 3 - Message Parsing for Egyptian Financial Entities (Priority: P1)

The app filters SMS messages from known Egyptian financial senders (banks,
digital wallets, payment services) and extracts structured transaction data from
each matching message using a **regex/template-based** approach.

**Parsing Architecture**: The parsing engine uses a **Strategy pattern** so the
underlying parsing approach (regex/template today, potentially LLM-based in the
future) can be swapped without changing the caller or flow logic. Each known
financial entity is defined in an **extensible typed registry**
(`FinancialSender` registry). Each registry entry contains the sender's address
patterns, display name, default category mapping, and a set of regex templates
for extracting transaction data from that sender's SMS format. Adding a new
financial entity requires only adding a new entry to the registry — no parser
logic changes.

The parser recognizes messages from entities including but not limited to:
**Instapay, NBE (National Bank of Egypt), CIB, Vodafone Cash, Fawry, Etisalat
Cash, Orange Cash, BM (Banque Misr), QNB, HSBC Egypt**.

For each matched message, the parser extracts:

- **Amount** (in EGP or other currency)
- **Date** of the transaction
- **Merchant / Sender / Counterparty** name
- **Transaction Type**: Debit (expense) or Credit (income)

A category is auto-assigned based on the sender and message content, using the
app's existing category hierarchy (L1 and L2 levels). For example:

- "Telecom" for Vodafone/Etisalat
- "Transfers" for Instapay
- "Refund" (L2 subcategory) for reversals and refund messages

Category detection should aim for maximum accuracy by leveraging sender
identity, transaction keywords, and merchant name matching against known
mappings.

**Why this priority**: Parsing accuracy is the backbone of the feature. Without
reliable extraction, the displayed data is meaningless.

**Independent Test**: Can be tested with a set of sample SMS strings. Each known
format should produce the correct structured output. Unknown formats should be
gracefully skipped.

**Acceptance Scenarios**:

1. **Given** an SMS from a known financial sender (e.g., "Instapay"), **When**
   the parser processes it, **Then** it extracts amount, date, merchant, and
   transaction type correctly.
2. **Given** an SMS that does not match any known financial pattern, **When**
   the parser processes it, **Then** it is silently skipped (not shown as a
   transaction).
3. **Given** an SMS with an amount containing comma separators (e.g., "EGP
   1,234.56"), **When** parsed, **Then** the amount is correctly extracted as
   1234.56.
4. **Given** an SMS from a telecom provider (e.g., Vodafone Cash), **When**
   parsed, **Then** the auto-assigned category is "Telecom".
5. **Given** an SMS that is a reversal or refund, **When** parsed, **Then** the
   transaction type is set to "Credit" and the L2 subcategory is set to
   "Refund".
6. **Given** a new financial entity is added to the registry, **When** SMS from
   that entity are scanned, **Then** they are correctly parsed without any
   changes to the core parser logic.

---

### User Story 4 - Transaction Review Page (Priority: P2)

After scanning completes, the app displays all extracted transactions on a
**Transaction Review Page**. This is a dedicated review screen (not the existing
transaction list page) where the user can inspect, select/deselect, and confirm
transactions before they are saved to the database.

The review page includes:

- **Transaction count summary bar**: "23 transactions found. 23 selected."
  (updates live as user checks/unchecks)
- **"Select All" / "Deselect All" toggle** at the top
- **Scrollable transaction list grouped by date** with formatted date headers
  (e.g., "Thursday, 19 February 2026")
- Each transaction row displays:
  - A checkbox for selection (checked by default)
  - A placeholder icon representing the merchant/category
  - The merchant or sender name
  - The auto-detected category label (tappable for **quick category correction**
    via dropdown — this is the only edit allowed on the review page)
  - The formatted amount (color-coded: green for credit, red for debit)
- **"Discard All" button**: Clears all selections for users who want to reject
  everything
- **"Save Selected" button**: Saves only the checked transactions to the
  database and redirects to the main transaction list page

No other editing (amount, date, merchant, type) is allowed on the review page.
Full editing is available later from the main transaction list.

**Why this priority**: Users need to review and confirm before data is saved.
This prevents false positives from polluting the database.

**Independent Test**: Can be tested by completing a scan that finds at least 3
transactions across 2 different dates, and verifying the review page renders
with correct grouping, selection, and save behavior.

**Acceptance Scenarios**:

1. **Given** scanning completes with extracted transactions, **When** the review
   page loads, **Then** transactions are displayed in a scrollable list grouped
   by date, with all transactions checked by default.
2. **Given** the review page is loaded, **When** viewing the summary bar,
   **Then** it shows the total count and selected count (e.g., "23 transactions
   found. 23 selected.").
3. **Given** a user unchecks a transaction, **When** viewing the summary bar,
   **Then** the selected count decreases accordingly.
4. **Given** the user taps "Select All", **When** viewing the list, **Then** all
   transaction checkboxes are checked.
5. **Given** the user taps a category label on a transaction, **When** the
   category dropdown appears, **Then** the user can select a different category
   from the existing category hierarchy.
6. **Given** a debit transaction, **When** displayed, **Then** the amount is
   shown in red with a "-" prefix.
7. **Given** a credit transaction, **When** displayed, **Then** the amount is
   shown in green with a "+" prefix.
8. **Given** the user taps "Discard All", **When** viewing the list, **Then**
   all transaction checkboxes are unchecked and the selected count is 0.
9. **Given** the user has selected some transactions and taps "Save Selected",
   **When** the save completes, **Then** only the selected transactions are
   persisted to the database and the user is redirected to the main transaction
   list page.
10. **Given** no transactions were found during scanning, **When** the review
    page loads, **Then** the user sees an empty state with a message like "No
    transactions found in your messages" and a button to return to the
    dashboard.

---

### User Story 5 - Re-Sync & Incremental Scanning (Priority: P2)

A user who has already synced once can trigger a re-sync from the **Settings
screen**. By default, the app only scans messages received **after** the last
sync timestamp to avoid duplicates. The user can also choose a "Full Re-scan"
option, which scans all messages but handles duplicates silently (no warning —
duplicate transactions are simply not added again).

Duplicates are identified by a **SHA-256 hash of the original SMS body**
(`sms_body_hash` field). If a transaction with the same hash already exists in
the database, it is silently skipped.

A `hasSynced` boolean and a `lastSyncTimestamp` are stored in the database to
track sync state.

**Why this priority**: Important for ongoing use. This enhances the feature from
"one-time tool" to "ongoing companion".

**Independent Test**: Can be tested by performing an initial sync, then
re-syncing and verifying only new messages are processed. For full re-scan,
verify no duplicates are created.

**Acceptance Scenarios**:

1. **Given** the user has synced before, **When** they trigger a re-sync from
   Settings, **Then** only messages received after the last sync timestamp are
   scanned.
2. **Given** the user chooses "Full Re-scan", **When** scanning runs, **Then**
   all inbox messages are scanned and duplicates are silently ignored.
3. **Given** a re-scan finds a previously synced transaction, **When**
   comparing, **Then** the duplicate is not added again (no warning shown).
4. **Given** the re-sync finds new transactions, **When** scanning completes,
   **Then** the user is taken to the Transaction Review Page to confirm the new
   transactions.
5. **Given** the user previously discarded a transaction on the Review Page,
   **When** a full re-scan runs, **Then** the discarded transaction reappears on
   the Review Page (since it was never saved, its hash is not in the database).

---

### User Story 6 - Live SMS Transaction Detection (Priority: P3)

After the initial sync is complete, the app can optionally **listen for incoming
SMS messages in real-time** (while the app is running or in the background on
Android). When a new SMS from a known financial sender is received, the app
parses it immediately and notifies the user.

The user is shown a **notification** with the parsed transaction summary
(amount, merchant, type) and two quick action buttons:

- **Confirm**: Save the transaction to the database immediately.
- **Discard**: Ignore the transaction.

The user can configure their preference in Settings:

- **"Ask me each time"** (default): Show a notification for each detected
  transaction and wait for user confirmation.
- **"Auto-confirm"**: Silently parse and save detected transactions without
  showing a notification. The user can review auto-confirmed transactions later
  in the transaction list.

**Why this priority**: This is an enhancement that builds on the main SMS sync
infrastructure. The parsing engine, entity registry, and permission handling are
all shared with the main feature. It should be implemented after the core sync
flow is complete, but the architecture should accommodate it from the start.

**Independent Test**: Can be tested by sending a test SMS from a known financial
sender while the app is running, and verifying the notification appears with
correct transaction data and action buttons.

**Acceptance Scenarios**:

1. **Given** the user has granted READ_SMS permission and live detection is
   enabled, **When** a new SMS from a known financial sender is received,
   **Then** the app parses it and shows a notification with the transaction
   summary.
2. **Given** a live detection notification is shown, **When** the user taps
   "Confirm", **Then** the transaction is saved to the database.
3. **Given** a live detection notification is shown, **When** the user taps
   "Discard", **Then** the transaction is not saved and the notification is
   dismissed.
4. **Given** the user has set preference to "Auto-confirm", **When** a new
   financial SMS is received, **Then** the transaction is parsed and saved
   silently without a notification.
5. **Given** the user has set preference to "Ask me each time", **When** a new
   financial SMS is received, **Then** a notification is shown and the
   transaction is NOT saved until the user confirms.
6. **Given** the app is in the background, **When** a financial SMS is received,
   **Then** the notification still appears (background processing).

---

### Edge Cases

- What happens when the user has 10,000+ SMS messages? The scan should process
  in batches and remain responsive (no UI freezing).
- How does the system handle SMS messages in Arabic? The parser should support
  Arabic-formatted amounts and mixed Arabic/English SMS.
- What happens when an SMS has a partial match (e.g., contains "EGP" but in a
  promotional context)? The parser should use strict patterns to minimize false
  positives.
- What if the user revokes SMS permission after scanning? The app should
  gracefully show the permission explanation when the user next tries to sync
  from Settings.
- What happens on iOS? This feature is Android-only. On iOS, the Settings screen
  shows an informational message explaining that SMS scanning is only available
  on Android.
- What if the user force-closes the app during scanning? The scan state should
  not corrupt; the next attempt should start fresh or resume from last known
  position.
- What if live detection receives an SMS while the user is on the review page?
  The new transaction should be queued and shown after the current review
  session.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST request READ_SMS permission with a pre-dialog
  explanation that auto-triggers once on the user's first dashboard visit after
  onboarding.
- **FR-002**: The app MUST read SMS messages locally on the device; no message
  content should be transmitted to any external server.
- **FR-003**: The app MUST display a syncing progress screen with an animated
  circular indicator, a "messages scanned" counter, and a "transactions found"
  counter.
- **FR-004**: The app MUST show a green checkmark success animation upon scan
  completion, then redirect to the Transaction Review Page.
- **FR-005**: The app MUST filter SMS messages by sender addresses that match
  known Egyptian financial and telecom entities defined in an extensible typed
  registry.
- **FR-006**: The app MUST extract Amount, Date, Merchant/Sender, and
  Transaction Type from each matching SMS using regex/template-based pattern
  matching.
- **FR-007**: The app MUST assign an auto-detected category (L1 and L2) to each
  parsed transaction, using the "Refund" L2 subcategory for reversal/refund
  messages.
- **FR-008**: The app MUST display a Transaction Review Page with bulk selection
  (checkboxes, Select All, Deselect All), a summary bar, quick category
  correction, a Discard All option, and a Save Selected button.
- **FR-009**: Only transactions explicitly confirmed by the user on the Review
  Page are saved to the existing `transactions` table with a `source` field set
  to `"sms"` to distinguish from manual and voice entries.
- **FR-010**: The app MUST handle the case where the user has no SMS messages or
  no matching financial SMS with appropriate empty state messaging.
- **FR-011**: The app MUST store `hasSynced` (boolean) and `lastSyncTimestamp`
  in the database to support incremental re-scanning and sync state tracking.
- **FR-012**: The app MUST allow re-sync from Settings with incremental scanning
  (default) and full re-scan options, detecting duplicates via SHA-256 hash of
  the SMS body and silently skipping them.
- **FR-013**: The app MUST be an Android-only feature; iOS should display an
  informational message in Settings.
- **FR-014**: The parsing utility MUST support amounts with comma separators,
  decimal points, and currency prefixes/suffixes.
- **FR-015**: The progress UI MUST not freeze the main thread during scanning
  (background/batch processing).
- **FR-016**: The app MUST support live SMS detection (P3) with configurable
  user preferences: "Ask me each time" (notification with Confirm/Discard) or
  "Auto-confirm" (silent save).
- **FR-017**: If the user denies the SMS permission on the initial auto-prompt,
  they MUST remain on the dashboard (no redirect, no error).

### Key Entities

- **SMSTransaction**: Represents a parsed transaction extracted from an SMS.
  When confirmed, it is saved to the existing `transactions` table with
  `source = "sms"`. Key attributes: amount, currency, date, merchant/sender,
  transaction type (debit/credit), auto-detected category (L1 + L2), original
  SMS body, sender address, `sms_body_hash` (SHA-256 for dedup), review status
  (pending/confirmed/discarded).
- **SyncSession**: Represents a single sync operation. Key attributes: start
  time, end time, total messages scanned, transactions found, lastSyncTimestamp,
  hasSynced (boolean).
- **FinancialSender**: Represents a known Egyptian financial entity whose SMS
  messages should be parsed. Key attributes: sender address patterns, entity
  name, default category (L1 + L2), regex templates for extraction. Stored in an
  extensible typed registry file.
- **LiveDetectionPreference**: User-configurable setting for live SMS detection
  behavior. Values: "ask_each_time" (default), "auto_confirm".

## Compliance & Distribution (Pre-Production)

Astik qualifies for Google Play's READ_SMS permission under the **"SMS-based
money management"** exception category (apps that track and manage budget).

**Eligible permissions**: `READ_SMS`, `RECEIVE_MMS`, `RECEIVE_SMS`,
`RECEIVE_WAP_PUSH`.

**Requirements for compliance** (to be completed before production release):

- **Permissions Declaration Form**: Must be submitted to Google before Play
  Store review. Declares the "SMS-based money management" use case.
- **Privacy Policy**: Must clearly state what SMS data is accessed, that all
  processing is local (no data transmitted off-device), and that only financial
  SMS is read.
- **Prominent Disclosure & Consent**: A clear explanation must be shown before
  requesting permission (already designed in User Story 1).
- **No data exfiltration**: Non-financial or personal SMS must not be shared or
  transmitted. All processing is on-device (already designed in FR-002).
- **Play Store listing**: SMS transaction tracking must be described as a core
  feature in the app description.

**Prohibited uses** (from Google's policy):

- No research or market research based on SMS content.
- No selling or transferring SMS data (including via SDKs).
- No social profiling from SMS content.

> [!NOTE] The Permissions Declaration Form and Play Store listing updates are
> deferred to the pre-production phase. Development can proceed without them.

## Assumptions

- The user's SMS inbox is accessible via a React Native community library
  (Android only).
- The parser implementation will be built fresh, not extending the legacy
  `notification-parser.ts`. Individual regex patterns from that file may be
  reused if directly applicable.
- The existing `ParsedNotification` interface in `packages/logic/src/types.ts`
  can inform the design of the new SMS transaction type but is not a dependency.
- The feature reads messages in a read-only manner; it does not modify, delete,
  or send any SMS.
- Gold/asset-related SMS (e.g., gold purchase confirmations) are out of scope
  for V1.
- The parsed transactions are shown on a Review Page and are only saved to the
  database after explicit user confirmation (Save Selected).
- The live SMS detection feature (User Story 6) will be implemented after the
  core sync flow but should be architecturally considered during design.
- The auto-prompt for SMS permission only fires once (first dashboard visit
  after onboarding). Subsequent access is only via Settings.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the full flow (permission → scan → review →
  save) in under 2 minutes for an inbox of up to 5,000 messages.
- **SC-002**: The parser correctly identifies and extracts transactions from at
  least 90% of standard Egyptian bank and wallet SMS formats.
- **SC-003**: False positive rate (non-financial messages incorrectly identified
  as transactions) is below 5%.
- **SC-004**: The progress UI updates smoothly without any visible lag or frame
  drops during scanning.
- **SC-005**: Zero SMS message content is transmitted off-device during
  scanning.
- **SC-006**: Users can re-sync and see only new transactions (no duplicates
  from previously scanned messages).
- **SC-007**: Users can review, select/deselect, and correct categories on the
  Review Page before saving to the database.
- **SC-008**: Live detection notifications appear within 5 seconds of receiving
  a financial SMS (when enabled).
