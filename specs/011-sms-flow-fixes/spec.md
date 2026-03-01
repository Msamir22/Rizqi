# Feature Specification: Fix SMS Scan Reliability & UX

**Feature Branch**: `011-sms-flow-fixes`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "Fix SMS scan reliability and UX: stable SMS
hashing, transfers dedup check, account setup back button, loading state, and
scan progress text alignment."  
**Related Issues**: #67, #62, #49, #47, #46

---

## Clarifications

### Session 2026-02-28

- Q: Should existing transfers be retroactively backfilled with `sms_body_hash`?
  → A: No — new transfers only. App is still in development; no production data
  to backfill.
- Q: Cancel button styling? → A: Close icon in header, same pattern as the
  discard button in sms-review.tsx (TouchableOpacity + Ionicons "close").
- Q: What happens to parsed transactions when user taps "Cancel Setup"? → A:
  Discard all — clear parsed transactions and account suggestions. User must
  rescan if they return later.
- Q: Where should SMS body hash be computed — client-side or Edge Function? → A:
  Client-side only. Hash is used locally for dedup; no need to involve the Edge
  Function.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Rescan Never Shows Already-Saved Transactions (Priority: P1)

As a user performing a full SMS rescan, I want all previously saved transactions
(both regular transactions and ATM-withdrawal transfers) to be correctly
filtered out so that I never see duplicates in the review list.

**Why this priority**: Duplicate transactions directly corrupt the user's
financial data. This is the highest-severity issue — false duplicates erode
trust and require manual cleanup.

**Independent Test**: Save several SMS transactions (including at least one ATM
withdrawal saved as a transfer). Perform a full rescan. Verify that zero
already-saved items reappear in the review list.

**Acceptance Scenarios**:

1. **Given** a user has saved 10 SMS transactions (including 2 ATM transfers),
   **When** the user performs a full SMS rescan, **Then** none of those 12 items
   appear in the review list.
2. **Given** an SMS body contains leading/trailing whitespace or invisible
   Unicode characters, **When** the system hashes that SMS for deduplication,
   **Then** the hash is identical to the hash produced for the same SMS body
   without such characters.
3. **Given** an ATM withdrawal was saved as a transfer (not a transaction),
   **When** the system checks for duplicates on rescan, **Then** the duplicate
   check covers both the transactions table and the transfers table.
4. **Given** a new (unseen) SMS arrives after the initial scan, **When** the
   user performs a rescan, **Then** only the new SMS appears in the review list.

---

### User Story 2 — Account Setup Has Back and Cancel Buttons (Priority: P1)

As a user on the "Setup Your Accounts" screen, I want a back arrow button to
return to the scan success screen (SuccessState), and optionally a "Cancel
Setup" button to exit the setup flow entirely, so that I am not trapped with no
navigation options.

**Why this priority**: A screen with no exit path is a critical UX blocker.
Users can get permanently stuck on this screen with no way to return.

**Independent Test**: Navigate to the Account Setup screen during the SMS review
flow. Verify a back arrow icon is visible in the header and correctly navigates
back to the SuccessState screen.

**Acceptance Scenarios**:

1. **Given** the user is on the Account Setup screen, **When** they look at the
   header area, **Then** a back arrow icon button is visible.
2. **Given** the user taps the back arrow, **When** the action completes,
   **Then** the user is returned to the SuccessState screen in SmsScanProgress
   (the scan results summary).
3. **Given** the user has partially configured account cards, **When** they tap
   back, **Then** their progress is preserved so they can return to the setup
   screen later without re-entering data.
4. **Given** the user taps "Cancel Setup", **When** the action completes,
   **Then** all parsed transactions and account suggestions are discarded, the
   setup flow is dismissed, and the user is returned to the main app
   (dashboard/tabs). The user must rescan to re-enter the flow.

---

### User Story 3 — Account Setup Shows Loading State (Priority: P2)

As a user arriving at the Account Setup screen, I want to see a loading
indicator while account suggestion cards are being prepared so that I understand
the app is working and don't see an empty/jarring screen.

**Why this priority**: Without a loading state the screen appears broken for 1–2
seconds (only the "Add Account" button is visible, no cards). This degrades
perceived quality but doesn't block functionality.

**Independent Test**: Navigate to the Account Setup screen and observe the 1–2
second loading window. Verify a skeleton loader or spinner appears during
loading, and that primary action buttons are hidden or disabled until data is
ready.

**Acceptance Scenarios**:

1. **Given** the Account Setup screen is loading account suggestions, **When**
   the user sees the screen, **Then** a loading indicator (skeleton cards or
   spinner) is displayed instead of an empty screen.
2. **Given** account suggestions are still loading, **When** the user looks at
   the footer, **Then** the primary "Create accounts & review" button is
   disabled (visually greyed out) until loading completes.
3. **Given** account suggestion loading completes, **When** the cards appear,
   **Then** the transition from loading state to cards is smooth (no layout
   jump).

---

### User Story 4 — Scan Progress Text Is Properly Aligned (Priority: P3)

As a user watching the SMS scan progress, I want the progress message and
percentage to be cleanly positioned below the pipeline status card so that the
screen looks polished and professional.

**Why this priority**: Visual misalignment is a cosmetic issue. It doesn't block
functionality but degrades the perceived quality of the app.

**Independent Test**: Start an SMS scan and observe the progress text position
relative to the pipeline status card. Verify the text is below/above the card
without overlapping.

**Acceptance Scenarios**:

1. **Given** the SMS scan is in progress, **When** the progress text renders,
   **Then** it appears below the pipeline status card with proper spacing — no
   overlap.
2. **Given** the progress percentage changes, **When** the text updates,
   **Then** the layout remains stable (no jittering or repositioning).

---

### Edge Cases

- What happens when the SMS body is identical except for a trailing newline or
  carriage return? → Hash must be identical after normalization.
- What happens when an SMS body contains zero-width Unicode characters (ZWNJ,
  ZWS)? → These must be stripped before hashing.
- What happens when the transfers table has no `sms_body_hash` column yet? → A
  migration adds the column; old transfers without a hash are not retroactively
  matched (new entries only).
- What happens when the user taps "Back" on Account Setup during the first-ever
  scan (no previous accounts)? → They return to the SuccessState screen.
- What happens when account suggestion loading takes longer than 5 seconds? →
  The loading indicator remains visible until complete; no timeout.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST normalize SMS body text **client-side** before
  hashing by: trimming leading/trailing whitespace, collapsing consecutive
  whitespace to single spaces, removing zero-width Unicode characters, and
  normalizing line endings.
- **FR-002**: The hash function MUST produce identical output for semantically
  identical SMS bodies regardless of superficial whitespace or invisible
  character differences.
- **FR-003**: The duplicate detection logic MUST check `sms_body_hash` in both
  the `transactions` table AND the `transfers` table when filtering out
  already-processed SMS messages.
- **FR-004**: The `transfers` table MUST have an `sms_body_hash` column to store
  the hash of the originating SMS body for ATM-withdrawal transfers.
- **FR-005**: The Account Setup screen MUST display a back arrow icon button in
  the header that returns the user to the SuccessState screen (SmsScanProgress).
- **FR-006**: Tapping the back button MUST NOT discard the user's scan results
  or partial account configuration.
- **FR-006a**: The Account Setup screen MUST provide a "Cancel Setup" button
  (close icon in the header, same pattern as the discard button in sms-review)
  that discards all parsed transactions and account suggestions, exits the setup
  flow, and returns the user to the main app.
- **FR-007**: The Account Setup screen MUST display a loading indicator
  (skeleton cards or spinner) while account suggestions are being calculated.
- **FR-008**: The "Create accounts & review" button MUST be disabled (visually
  greyed out, not hidden) while account suggestions are loading.
- **FR-009**: The scan progress text on the SMS Scan screen MUST be properly
  positioned below the pipeline status card without overlapping.

### Key Entities

- **SMS Body Hash**: A deterministic fingerprint of an SMS body, computed after
  text normalization. Used to detect and skip already-processed messages across
  both transactions and transfers.
- **Transfer**: An inter-account movement (e.g., ATM withdrawal). Now also
  carries an `sms_body_hash` for deduplication parity with transactions.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 0% of already-saved SMS transactions or transfers reappear in the
  review list on a full rescan.
- **SC-002**: Identical SMS bodies with only whitespace/invisible character
  differences always produce the same hash.
- **SC-003**: The Account Setup screen always has a visible navigation option to
  return to the previous step.
- **SC-004**: Users see a loading indicator instead of an empty screen during
  the 1–2 second account suggestion loading period.
- **SC-005**: The scan progress text never overlaps with the pipeline status
  card.

---

## Assumptions

- The existing `sms_body_hash` column in the `transactions` table serves as the
  reference implementation for the same column to be added to `transfers`.
- The normalization algorithm (trim + collapse whitespace + strip zero-width
  chars) will cover the observed edge cases causing hash instability. If new
  cases emerge, additional normalization rules can be added.
- The back arrow on Account Setup navigates to the SuccessState screen in
  SmsScanProgress, not the review list or dashboard.
- A separate "Cancel Setup" button is under consideration to skip setup entirely
  and go to the main app.
- Skeleton card loaders are preferred over a simple spinner for the loading
  state, as they provide better perceived performance and context.
- The progress text alignment fix on the SMS Scan screen is a layout/spacing
  adjustment, not a redesign of the screen.
