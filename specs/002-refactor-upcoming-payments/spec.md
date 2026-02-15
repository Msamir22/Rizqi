# Feature Specification: Refactor Upcoming Payments

**Feature Branch**: `002-refactor-upcoming-payments`  
**Created**: 2026-02-14  
**Status**: Draft  
**Input**: User description: "Refactor the Upcoming Payments section in the
dashboard. Improve its UI and refactor its code applying all agent rules to
UpcomingPayments.tsx."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Clean Code & Rule Compliance (Priority: P1)

The developer opens the `UpcomingPayments.tsx` file and finds that the code
follows all project rules established in `.agent/rules/`. The component is
well-structured, modular, and maintainable. Business logic is separated from the
UI. Styling uses Tailwind CSS classes exclusively (except for documented
exceptions). No prohibited patterns exist in the file.

**Why this priority**: Code quality and rule compliance are the foundation of
this refactoring effort. Every other story depends on having clean, properly
structured code.

**Independent Test**: Open `UpcomingPayments.tsx` and verify that all agent
rules are satisfied. Run ESLint with the project configuration and confirm zero
violations.

**Acceptance Scenarios**:

1. **Given** the `UpcomingPayments.tsx` file, **When** a developer reviews it,
   **Then** all business logic (due date calculations, payment processing,
   next-due-date updates) lives in the service layer, not in the component file.
2. **Given** the refactored component, **When** ESLint runs with project rules,
   **Then** zero violations are reported — no hardcoded hex colors, no `isDark`
   ternary in styles, no `StyleSheet.create` patterns.
3. **Given** the component code, **When** reviewed against the styling rules,
   **Then** all colors come from `palette` or Tailwind classes, dark mode uses
   `dark:` variants, and the `PageHeader` component is used for headers.
4. **Given** the component file, **When** reviewed for code organization,
   **Then** sub-components are in their own files, types and interfaces are
   separated, and the main export is concise and focused.

---

### User Story 2 - Improved Light & Dark Mode UI (Priority: P2)

A user viewing the dashboard in either light or dark mode sees a visually
polished Upcoming Bills section. The component looks consistent with the rest of
the app's design language — using the same card styles, spacing, and typography
conventions as other dashboard sections.

**Why this priority**: The current component has hardcoded dark-mode-only styles
(e.g., `bg-slate-800/90`, `text-white`) that don't properly adapt to light mode.
Fixing this ensures the component works correctly in both themes.

**Independent Test**: Toggle between light and dark mode on the device and
verify the Upcoming Bills section looks correct in both modes — no invisible
text, no clashing backgrounds, no missing borders.

**Acceptance Scenarios**:

1. **Given** the app is in dark mode, **When** the user views the dashboard,
   **Then** the Upcoming Bills section, Featured Payment card, and Mini Payment
   items all use appropriate dark theme colors with proper contrast.
2. **Given** the app is in light mode, **When** the user views the dashboard,
   **Then** the same components render with appropriate light theme colors — no
   dark-only color classes bleeding through.
3. **Given** the Pay Now modal is opened, **When** the user is in either mode,
   **Then** the modal background, inputs, buttons, and text all respect the
   current theme correctly.

---

### User Story 3 - Improved Pay Now Modal UX (Priority: P3)

A user taps "Pay Now" on an upcoming bill and sees a polished confirmation
modal. The modal pre-fills the amount and account, allows editing, and provides
clear feedback on submission — both success and failure. The interaction feels
smooth, with proper keyboard handling, loading states, and visual transitions.

**Why this priority**: The Pay Now flow is the primary interaction in this
section. While it functions today, the UX can be improved with consistent use of
project form components (e.g., `TextField` instead of raw `TextInput`) and
smoother transitions.

**Independent Test**: Tap "Pay Now" on any upcoming payment, modify the amount,
change the account, and confirm. Verify the transaction is created, the next due
date is updated, and a success toast appears.

**Acceptance Scenarios**:

1. **Given** a user taps "Pay Now," **When** the modal opens, **Then** the
   amount field is pre-filled with the payment's amount and the account field
   shows the payment's linked account.
2. **Given** a user enters an invalid amount (zero, negative, or non-numeric),
   **When** they tap "Confirm," **Then** they see a clear validation message.
3. **Given** the user changes the account, **When** they confirm, **Then** the
   transaction is created against the newly selected account and the balance is
   updated accordingly.
4. **Given** the transaction is being submitted, **When** the user sees the
   Confirm button, **Then** a loading indicator is shown and the buttons are
   disabled to prevent double-submission.

---

### Edge Cases

- What happens when no upcoming payments exist? The section should not render at
  all (current behavior — preserve this).
- What happens when only one upcoming payment exists? The featured card should
  display alone without the side mini-items section.
- What happens when a payment is overdue (negative days until due)? The
  component should show a red "X days overdue" label.
- What happens when the user's linked account has been deleted? The Pay Now
  modal should default to the first available account or show a clear message.
- What happens when the network is unavailable during "Pay Now"? Since this is
  an offline-first app, the transaction should be created locally and synced
  later. No error should appear for network unavailability.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST separate all business logic from the UI
  rendering. Pure date functions (`calculateNextDueDate`, `formatDueDate`) MUST
  move to `apps/mobile/utils/dateHelpers.ts`. The DB-write function
  (`updateRecurringPaymentNextDueDate`) MUST move to `apps/mobile/services/`.
- **FR-002**: All styling MUST use Tailwind CSS classes. No `StyleSheet.create`,
  no hardcoded hex values, no `isDark` ternary in style objects/className.
  Exception: `isDark` may be used for component color props where Tailwind
  className does not apply.
- **FR-003**: The component MUST render correctly in both light and dark mode.
  All text, backgrounds, borders, and icons MUST adapt to the current theme.
- **FR-004**: Sub-components (PayNowModal, FeaturedPaymentCard, MiniPaymentItem)
  MUST be extracted into their own files within a dedicated subfolder at
  `components/dashboard/upcoming-payments/`, with an `index.ts` barrel export.
- **FR-005**: The Pay Now modal MUST use project form components (`TextField`,
  `Dropdown` or similar) instead of raw `TextInput` where applicable.
- **FR-006**: All `Alert.alert` calls MUST be replaced with the project's
  `useToast` pattern for inline feedback (validation errors) or kept only for
  critical destructive confirmations.
- **FR-007**: All commented-out code (EmptyState component, lines 422-438) MUST
  be either implemented or removed entirely.
- **FR-008**: The component MUST handle keyboard dismissal properly in the Pay
  Now modal (current behavior — preserve this).
- **FR-009**: Colors used in icon `color` props MUST come from the `palette`
  object, never hardcoded hex values.

### Key Entities

- **UpcomingPayment**: Represents a recurring payment that is due soon. Contains
  name, amount, currency, frequency, next due date, associated account, and
  category. Sourced from the `useUpcomingPayments` hook.
- **RecurringPayment**: The database model representing a recurring
  bill/payment. Has fields for amount, frequency, next due date, account
  linkage, and category. Lives in `@astik/db`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero ESLint violations reported on the refactored file(s) when
  running with the project's rule configuration.
- **SC-002**: The Upcoming Bills section renders identically in both light and
  dark mode — all elements are visible with proper contrast in both themes.
- **SC-003**: The Pay Now flow completes successfully — tapping Pay Now, editing
  the amount, selecting an account, and confirming creates a transaction and
  updates the next due date in under 3 seconds.
- **SC-004**: The main `UpcomingPayments.tsx` file is reduced to under 150 lines
  (from 559) by extracting sub-components and business logic.
- **SC-005**: All sub-components follow the Single Responsibility Principle —
  each file contains exactly one component or one set of related helpers.

## Assumptions

- The existing `useUpcomingPayments` hook does not need refactoring — it already
  follows proper patterns for data fetching.
- The `createTransaction` service function in `transaction-service.ts` is
  already properly structured and does not need changes.
- The project's existing `TextField`, `Dropdown`, and `useToast` components are
  stable and ready for use in this refactoring.
- The visual layout (featured card + side mini-items) is acceptable and does not
  require a complete redesign — only polish and rule compliance.

## Clarifications

### Session 2026-02-14

- Q: Where should extracted sub-components live? → A: Dedicated subfolder at
  `components/dashboard/upcoming-payments/` with an `index.ts` barrel export.
- Q: Where should business logic functions move? → A: Pure date functions
  (`calculateNextDueDate`, `formatDueDate`) →
  `apps/mobile/utils/dateHelpers.ts`. DB-write function
  (`updateRecurringPaymentNextDueDate`) → `apps/mobile/services/`.
- Q: Should `FlatList` be mandated for the side mini-items list? → A: No — the
  list is capped at 2 items, `.map()` is appropriate. FR-007 removed.
