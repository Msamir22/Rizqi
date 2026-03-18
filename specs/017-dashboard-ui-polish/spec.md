# Feature Specification: Dashboard & UI Polish

**Feature Branch**: `017-dashboard-ui-polish`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: GitHub Issues #109, #107, #104 (grouped as a single polish batch)  
**Related Bug**: Issue #111 — handled directly during implementation (clamp
negative saved to 0)

## Clarifications

### Session 2026-03-18

- Q: Should the avatar fallback for users with no name data show a "generic
  person icon" or an initials circle derived from email? → A: Always use
  initials circle — derive from name if available, else from email. No generic
  icon needed.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Dynamic User Profile in Drawer (Priority: P1)

As a signed-in user, when I open the side drawer, I see my real name, email, and
profile picture instead of the current hardcoded "User" / "user@email.com"
placeholder values.

**Why this priority**: The drawer is visible on every session; hardcoded data
makes the app feel incomplete and unpolished. Since the user has already
authenticated, the data is available in the `profiles` table — this is a quick
win with high visibility.

**Independent Test**: Open the drawer after sign-in and verify the user's real
name, email, and avatar are displayed. If the avatar is missing, fallback
initials (first letter of name) should appear.

**Acceptance Scenarios**:

1. **Given** a user signed in via Google OAuth, **When** they open the drawer,
   **Then** the drawer shows their Google display name, email, and avatar image.
2. **Given** a user signed in via Email/Password whose profile has a
   `first_name` and `last_name`, **When** they open the drawer, **Then** the
   drawer shows "FirstName LastName", their email, and fallback initials if no
   avatar URL exists.
3. **Given** a user whose profile has no `display_name`, no `first_name`, and no
   `last_name`, **When** they open the drawer, **Then** the name area shows the
   user's email address and the avatar shows an initials circle derived from the
   email (e.g., "MO" from "mo@gmail.com").
4. **Given** a user whose avatar URL fails to load (broken link), **When** they
   open the drawer, **Then** the avatar falls back to showing the user's
   initials circle.

---

### User Story 2 — Period Filter on Upcoming Bills (Priority: P2)

As a user viewing the Dashboard, I want to filter the "Upcoming Bills" section
by a time-period so I can see which bills are due in the near future or further
ahead.

**Why this priority**: The Upcoming Bills section currently shows all active
bills regardless of when they are due. Adding a period filter gives users
control over their cashflow forecast, which is core to financial planning.

**Independent Test**: On the Dashboard, tap the period filter on the Upcoming
Bills section and verify that the bills list updates to match only payments due
within the selected window.

**Acceptance Scenarios**:

1. **Given** the user has multiple upcoming bills with varying due dates,
   **When** they select "This Week", **Then** only bills whose `next_due_date`
   falls within the current week are displayed.
2. **Given** the user selects "This Month", **When** viewing the Upcoming Bills
   section, **Then** only bills due within the current calendar month are shown,
   and the "Total due" row updates accordingly.
3. **Given** the user selects "6 Months", **When** viewing the Upcoming Bills
   section, **Then** bills due within the next 6 months from today are shown.
4. **Given** the user selects "1 Year", **When** viewing the Upcoming Bills
   section, **Then** bills due within the next 12 months from today are shown.
5. **Given** the user selects a period and no bills fall within it, **When**
   viewing the section, **Then** the section shows an empty state message like
   "No bills due in this period".
6. **Given** the user changes the filter, **Then** the "Total due" summary row
   at the bottom updates to reflect only the bills visible under the new filter.
7. **Given** the user re-opens the Dashboard after closing the app, **Then** the
   default filter is "This Month".

---

### User Story 3 — Equivalent Preferred Currency on Transaction Cards (Priority: P3)

As a user with a global preferred currency (e.g., SAR) who records transactions
in another currency (e.g., EGP), I want to see the equivalent amount in my
preferred currency beneath the transaction amount, so I can understand the value
at a glance without mental conversion.

**Why this priority**: Multi-currency is already supported, but the UI doesn't
surface conversion info on individual cards. This is a low-effort enhancement
that significantly improves the experience for users dealing with multiple
currencies. It leverages the existing `market_rates` table for historical rate
lookups — no schema changes required.

**Independent Test**: Create a transaction in a currency that differs from the
user's preferred currency and view it in the transaction list — the equivalent
preferred-currency amount should appear beneath the primary amount.

**Acceptance Scenarios**:

1. **Given** a user whose preferred currency is SAR, **When** they view a
   transaction that was recorded in EGP, **Then** the card shows the EGP amount
   as the primary amount and the SAR equivalent beneath it in smaller text,
   converted using the market rate from the transaction's date.
2. **Given** a user whose preferred currency is EGP, **When** they view a
   transaction also recorded in EGP, **Then** no equivalent line is shown (same
   currency — no conversion needed).
3. **Given** a transaction whose date has no corresponding entry in the market
   rates history, **When** the card is rendered, **Then** no equivalent amount
   is shown (graceful fallback — no crash, no stale data).
4. **Given** a user changes their preferred currency from EGP to SAR, **When**
   they view their existing transactions, **Then** all transaction cards now
   show equivalents in SAR (the new preferred currency) using rates from the
   market rates history.

---

### Edge Cases

- What happens when the `profiles` record has not synced yet after first
  sign-in? → Show loading shimmer or fallback to initials from email.
- What happens when the preferred currency is changed after transactions were
  already recorded? → All equivalent amounts recalculate automatically using the
  user's new preferred currency and the historical market rates for each
  transaction's date.
- What happens when no market rate exists for a transaction's date? → The
  equivalent line is not shown on that card.
- What happens if bills with CUSTOM frequency have unusual next_due_dates? → The
  filter compares `next_due_date` against the selected period range regardless
  of frequency type.

## Requirements _(mandatory)_

### Functional Requirements

**Drawer Profile (Issue #109)**

- **FR-001**: The app drawer MUST display the authenticated user's real name
  from the `profiles` table (using `fullName` computed property: firstName +
  lastName, or displayName as fallback).
- **FR-002**: The app drawer MUST display the authenticated user's email
  address, retrieved from the Supabase session or `profiles` table.
- **FR-003**: The app drawer MUST display the user's profile image if
  `avatar_url` is available; otherwise, it MUST show a fallback circle with the
  user's initials.
- **FR-004**: If no name data is available at all, the drawer MUST display the
  user's email in place of the name and show an initials circle derived from the
  email address.
- **FR-005**: The drawer MUST handle image loading failures gracefully (e.g.,
  broken URL) by falling back to the initials circle.

**Upcoming Bills Filter (Issue #107)**

- **FR-006**: The Upcoming Bills section MUST include a period filter with the
  options: `This Week`, `This Month`, `6 Months`, `1 Year`.
- **FR-007**: The default selected period MUST be `This Month`.
- **FR-008**: The displayed bills list MUST update dynamically when the user
  changes the filter selection.
- **FR-009**: The "Total due" summary row MUST reflect only the bills that match
  the active filter.
- **FR-010**: If no bills match the selected period, the section MUST show an
  appropriate empty state instead of hiding entirely.

**Transaction Currency Equivalent (Issue #104)**

- **FR-011**: When displaying a transaction whose currency differs from the
  user's preferred currency, the card MUST show the equivalent
  preferred-currency amount beneath the primary amount.
- **FR-012**: The equivalent amount MUST be calculated using the historical
  market rate from the `market_rates` table that corresponds to the
  transaction's date.
- **FR-013**: If no market rate entry exists for the transaction's date, the
  equivalent line MUST NOT be shown.
- **FR-014**: If the transaction currency matches the user's preferred currency,
  the equivalent line MUST NOT be shown.
- **FR-015**: When the user changes their preferred currency, all transaction
  cards MUST reflect equivalents in the new preferred currency using the
  appropriate historical rates.

**Negative Saved Bug (Issue #111 — handled during implementation)**

- **FR-016**: The "Saved" value in the period summary (This Month section) MUST
  be clamped to a minimum of `0`. A negative saved amount MUST NOT be displayed
  to the user.

### Key Entities _(include if feature involves data)_

- **Profile**: Represents the authenticated user's identity. Key attributes:
  `firstName`, `lastName`, `displayName`, `avatarUrl`, `preferredCurrency`,
  `userId`. Already exists in the `profiles` table.
- **Transaction**: Represents a financial event. No schema changes needed. The
  equivalent currency display uses the existing `market_rates` table for
  historical rate lookups based on transaction date.
- **Market Rates**: Stores historical exchange rates. Used to look up the
  conversion rate for a given transaction date. Already exists.
- **Recurring Payment**: Represents a scheduled bill/payment. Already has
  `next_due_date` which is used for period filtering. No schema changes needed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The drawer displays the correct user name, email, and avatar (or
  fallback) for 100% of authenticated users, verified by opening the drawer
  after sign-in.
- **SC-002**: Users can switch between all 4 period filters in the Upcoming
  Bills section and see the bill list update within 500ms.
- **SC-003**: For transactions in a different currency than the user's preferred
  currency, the equivalent amount is shown on the card whenever a historical
  market rate exists for that transaction's date.
- **SC-004**: The "Saved" value never shows a negative number in the period
  summary section.
- **SC-005**: Transactions whose date has no corresponding market rate entry
  gracefully omit the equivalent line without crashing or showing stale data.
- **SC-006**: Changing the user's preferred currency causes all transaction
  equivalents to recalculate correctly using the new preferred currency.
