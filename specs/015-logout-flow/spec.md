# Feature Specification: Logout Flow

**Feature Branch**: `015-logout-flow` **Created**: 2026-03-07 **Updated**:
2026-03-08 **Status**: Clarified **Input**: User description: "Implement logout
flow with confirmation dialog, WatermelonDB reset, and re-authentication support
for signed-in users"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Signed-In User Logs Out (Priority: P1)

A user who has linked their Google (or other social) identity wants to log out
of the app. They tap "Logout" in the navigation drawer (or settings screen), see
a confirmation modal explaining the consequences, confirm, and the app syncs any
pending local data, clears the local database, signs them out, and starts a
fresh anonymous session.

**Why this priority**: This is the core logout flow and the most common
scenario. Without it, users have no way to switch accounts or sign out.

**Independent Test**: Can be tested by signing in with Google, adding some data,
tapping Logout, confirming, and verifying the app resets to a clean anonymous
state with no previous data visible.

**Acceptance Scenarios**:

1.  **Given** a signed-in (non-anonymous) user with data, **When** they tap
    "Logout" (from drawer or settings), **Then** a confirmation modal (using the
    existing `ConfirmationModal` component with `warning` variant) appears
    explaining that local data will be cleared and they can sign back in to
    recover it.
2.  **Given** the confirmation modal is shown, **When** the user taps "Logout"
    (confirm button), **Then** a sync is triggered to ensure all local data is
    backed up to the server, then the local WatermelonDB database is reset, the
    Supabase session is destroyed, a new anonymous session is created, and the
    user sees the home screen with no previous data.
3.  **Given** the confirmation modal is shown, **When** the user taps "Cancel",
    **Then** the modal closes and nothing changes.
4.  **Given** a signed-in user has logged out, **When** they re-open the app,
    **Then** they are on a fresh anonymous session with no residual data from
    the previous account, but they are NOT shown onboarding again (onboarding
    completion state is preserved per-device).

---

### User Story 2 — Hide Logout for Anonymous Users (Priority: P1)

An anonymous user (who hasn't linked any identity) should not see the "Logout"
option in either the navigation drawer or the settings screen. Logging out of an
anonymous session would create another anonymous session with data loss and no
recovery path — this must be prevented.

**Why this priority**: Equally critical as the logout itself. Showing logout to
anonymous users creates a dangerous data-loss scenario with no recovery. This is
a safety guardrail.

**Independent Test**: Can be tested by opening the app as a fresh anonymous user
and verifying the Logout option is not visible in either the drawer or settings.

**Acceptance Scenarios**:

1.  **Given** an anonymous user, **When** they open the navigation drawer,
    **Then** the "Logout" menu item is not visible.
2.  **Given** an anonymous user, **When** they visit the settings screen,
    **Then** the "Logout" option is not visible.
3.  **Given** a signed-in user, **When** they open the navigation drawer or
    settings screen, **Then** the "Logout" option is visible and styled with a
    red/destructive appearance.

---

### User Story 3 — Re-Authentication After Logout (Priority: P2)

A user who previously logged out wants to sign back in using the same social
account. They use the auth banner in settings or the sign-up prompt to link
their Google identity to the new anonymous session. After successful
re-authentication, their synced data should be pulled down from Supabase during
the next sync cycle.

**Why this priority**: Important for user confidence — users need to know their
data isn't lost when they log out. However, this story depends on adapting the
existing sign-up banner/prompt to serve both sign-up and log-in scenarios.

**Independent Test**: Can be tested by logging out, then using the auth banner
to link the same Google account, and verifying previously synced data reappears
after a sync.

**Acceptance Scenarios**:

1.  **Given** a user who previously logged out, **When** they link the same
    social identity via the auth banner or sign-up prompt, **Then** the identity
    is successfully linked (not blocked by "already linked to another user").
2.  **Given** a re-authenticated user, **When** the next sync cycle runs,
    **Then** their previously synced data is pulled down from Supabase and
    appears in the app.

---

### User Story 4 — Generic Auth Banner Messaging (Priority: P2)

The existing sign-up banner in settings currently says "Sign up to back up your
data." This wording is confusing for returning users who logged out — they'd
think "I want to log in, not sign up again." Since we can't reliably distinguish
new vs. returning users (AsyncStorage flags are lost on reinstall), the banner
should use generic, neutral language that works for both cases.

The banner should say: **"Connect Your Account"** with subtitle **"Link your
Google account to back up and sync your data across devices."** The word
"Connect" is neutral — it doesn't imply signing up (new) or logging in
(returning). Under the hood, `linkIdentity` handles both cases identically.

**Why this priority**: Without this, returning users will see "Sign Up" and may
think they need to create a new account, leading to confusion. A stateful
approach (storing "previously logged out" flag) breaks on reinstall.

**Independent Test**: Can be tested by verifying the banner says "Connect Your
Account" (not "Sign Up") for any anonymous user.

**Acceptance Scenarios**:

1.  **Given** any anonymous user (new or returning after logout), **When** they
    visit settings, **Then** the banner says "Connect Your Account" with neutral
    messaging.
2.  **Given** any anonymous user, **When** they tap the banner, **Then** they
    are taken to the auth screen where `linkIdentity` handles both sign-up and
    log-in scenarios transparently.

---

### Edge Cases

- **Sync failure before logout**: If the pre-logout sync fails, the system
  auto-retries once. If the retry also fails, show a `ConfirmationModal`
  (warning variant) warning that some data may not be backed up and giving the
  choice to proceed with logout anyway or cancel.
- **No network connection**: If the user has no network connection when
  attempting to logout, show an error message informing them that a network
  connection is required to safely log out (so their data can be synced first).
  Do not proceed with the logout.
- **Force-close during logout**: Persist a `logout_in_progress` flag to
  AsyncStorage before starting the logout process. On next app launch, check for
  this flag — if present, complete the cleanup (reset DB, clear session, remove
  the flag). This ensures the logout completes even if the user force-closes the
  app mid-process.
- **Active sync during logout**: The sync must complete before the database
  reset begins. Since sync typically takes only a few seconds, the logout flow
  should wait for it to finish — showing a brief loading/spinner state. Do not
  allow the database to be reset while sync is running.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST show a confirmation modal (using the existing
  `ConfirmationModal` component with `warning` variant and `log-out-outline`
  icon) before processing a logout request, clearly stating that local data will
  be cleared and can be recovered by signing back in.
- **FR-002**: System MUST hide the "Logout" option from both the navigation
  drawer and the settings screen when the user is anonymous.
- **FR-003**: System MUST trigger a data sync before resetting the local
  database, ensuring all local data is backed up to the server.
- **FR-004**: System MUST reset the local WatermelonDB database (all tables and
  sync metadata) only after sync has completed successfully.
- **FR-005**: System MUST destroy the current Supabase session and create a new
  anonymous session after logout.
- **FR-006**: System MUST allow a previously logged-out user to re-authenticate
  using the same social identity they used before.
- **FR-007**: System MUST clear locally persisted user preferences on logout
  (sign-up prompt dismissal state, cached data) but MUST preserve the onboarding
  completion flag so users are not forced through onboarding again on the same
  device.
- **FR-008**: System MUST handle errors during the logout process gracefully —
  if the database reset fails, the session should still be cleared.
- **FR-009**: System MUST require a network connection to initiate logout. If
  offline, show an error message and do not proceed.
- **FR-010**: System MUST provide the logout option in both the navigation
  drawer and the settings screen.
- **FR-011**: The settings banner MUST use generic neutral messaging ("Connect
  Your Account" / "Link your Google account") that works for both new and
  returning anonymous users, avoiding "Sign Up" or "Log In" language.
- **FR-012**: System MUST persist a `logout_in_progress` flag so that if the app
  is force-closed during logout, the cleanup can be completed on next launch.
- **FR-013**: If the pre-logout sync fails, the system MUST auto-retry once. If
  the retry also fails, show a warning modal giving the user the choice to
  proceed (risking data loss) or cancel the logout.

### Key Entities

- **User Session**: Represents the active authentication state (anonymous or
  permanent). Destroyed on logout and recreated as anonymous.
- **Local Database**: WatermelonDB instance containing transactions, accounts,
  transfers, and sync metadata. Fully reset on logout after sync.
- **Persisted Preferences**: AsyncStorage/SecureStore keys for sign-up prompt
  dismissal and other per-user settings. Cleared on logout except for
  device-level flags like onboarding completion.
- **Logout-In-Progress Flag**: AsyncStorage flag set before the logout process
  begins and cleared after completion. Used to recover from force-close
  scenarios.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the full logout flow (tap → confirm → sync →
  clean slate) in under 10 seconds.
- **SC-002**: After logout, zero records from the previous user remain in the
  local database.
- **SC-003**: After logout, the app starts a fresh anonymous session with empty
  data but skips onboarding.
- **SC-004**: Users who log out and re-authenticate with the same social account
  recover 100% of their previously synced data.
- **SC-005**: Anonymous users never see or interact with the logout option in
  either the drawer or settings.
- **SC-006**: All anonymous users see neutral "Connect Your Account" messaging
  that works regardless of whether they are new or returning.

## Assumptions

- The existing sign-up/re-authentication flow (from feature #80) handles
  identity linking correctly and does not need modification for the re-auth
  scenario.
- WatermelonDB's `unsafeResetDatabase()` is the appropriate method for clearing
  all local data and sync metadata.
- The user confirmed that logout should only be available for non-anonymous
  (signed-in) users.
- The existing `ConfirmationModal` component will be used for the logout
  confirmation dialog (warning variant, log-out-outline icon).
- The onboarding completion flag will be preserved across logout so users don't
  repeat onboarding on the same device.
- A network connection is required to log out, so data can be synced first.

## Clarifications

### Session 2026-03-08

- Q: If the pre-logout sync fails, how should the user be warned? → A:
  Auto-retry sync once. If retry also fails, show a `ConfirmationModal` (warning
  variant) informing the user that some data may not be backed up, with
  "Proceed" and "Cancel" options.
