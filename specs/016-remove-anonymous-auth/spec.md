# Feature Specification: Remove Anonymous User Flow and Enforce Authentication

**Feature Branch**: `016-remove-anonymous-auth` **Created**: 2026-03-09
**Status**: Draft (Updated after review) **Input**: GitHub Issue #84 — "Remove
Anonymous User Flow and Enforce Authentication"

## Clarifications

### Session 2026-03-09

- Q: When a user signs up with email/password, must they verify their email
  before accessing the app? → A: Require email verification — user must click a
  verification link before accessing the app.
- Q: Are Facebook and Apple OAuth configurations part of this feature's scope? →
  A: Google + email/password now; Facebook and Apple deferred to separate
  issue(s).
- Q: Is a "Forgot Password" / password reset flow in scope? → A: Yes, in scope —
  include a "Forgot Password?" link that triggers a password reset email.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — New User Must Authenticate Before Using the App (Priority: P1)

A first-time user downloads and opens Astik. Instead of being dropped into the
dashboard with anonymous tracking, the user is greeted by a unified
**Authentication screen** (internally `auth.tsx`). They must create an account
or sign in using one of:

- **OAuth provider**: Google (Facebook and Apple are deferred to a future issue)
- **Email/password**: A new capability that allows users to register or sign in
  with their email and a password

Once authenticated, they proceed to onboarding and then the dashboard. There is
no "Skip" or "Continue as Guest" option.

**Why this priority**: This is the core change — the entire value proposition of
this feature. Without it, anonymous users can still bypass authentication, which
contradicts the security posture of a fintech app.

**Independent Test**: Can be tested by installing the app fresh, launching it,
and verifying that the only available path is sign-up or sign-in — no "Skip" or
"Continue as Guest" option exists.

**Acceptance Scenarios**:

1. **Given** a new user with no existing account, **When** they open the app for
   the first time, **Then** the app displays the Authentication screen with a
   Google OAuth button and an email/password option — no option to skip.
   (Facebook and Apple buttons may be shown as disabled/coming-soon or hidden.)
2. **Given** an unauthenticated user, **When** they attempt to navigate to any
   protected screen (dashboard, settings, transactions), **Then** they are
   redirected to the Authentication screen.
3. **Given** a new user on the Authentication screen, **When** they sign up via
   Google, **Then** they are authenticated, proceed to onboarding, and then see
   the dashboard.
4. **Given** a new user on the Authentication screen, **When** they sign up with
   email/password, **Then** they receive a verification email and must confirm
   their email address before being granted access to the app.
5. **Given** a user who has submitted email/password registration but not yet
   verified, **When** they try to access the app, **Then** they see a message
   asking them to check their email and verify their account.

---

### User Story 2 — Returning User Signs In Directly (Priority: P1)

A returning user who already has an account opens the app. If their session is
still valid, they go directly to the dashboard. If their session has expired,
they see the Authentication screen, sign in using any supported method, and
return to the dashboard.

**Why this priority**: Equally critical — existing users must have a seamless
return experience after the anonymous flow is removed.

**Independent Test**: Can be tested by signing in, force-closing the app,
reopening, and verifying either automatic session restoration or an
authentication prompt.

**Acceptance Scenarios**:

1. **Given** a returning user with a valid session, **When** they open the app,
   **Then** they go directly to the dashboard without being prompted to sign in.
2. **Given** a returning user with an expired session, **When** they open the
   app, **Then** they see the Authentication screen, sign in successfully, and
   are taken to the dashboard.
3. **Given** a returning user, **When** they sign in via any supported method
   (Google or email/password), **Then** they are authenticated and taken to the
   dashboard.

---

### User Story 3 — User Logs Out and Session Is Fully Cleared (Priority: P2)

A signed-in user taps "Log Out" in Settings. The app clears the session entirely
(no anonymous fallback session is created) and returns the user to the
Authentication screen. The user must sign in again to access any features.

**Why this priority**: Logout correctness is critical for security and privacy,
but it's a secondary flow compared to sign-up/sign-in.

**Independent Test**: Can be tested by signing in, going to Settings, tapping
"Log Out", and verifying the session is cleared and the Authentication screen is
displayed.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they tap "Log Out" in Settings, **Then**
   the session is fully cleared (no anonymous session is created as a fallback).
2. **Given** a user who just logged out, **When** they navigate back or reopen
   the app, **Then** they see the Authentication screen — not the dashboard.
3. **Given** a user who just logged out, **When** they sign in again, **Then**
   they see their previously saved data (data belongs to their authenticated
   account, not an anonymous one).

---

### User Story 4 — Sign-Up Prompts and Anonymous-Specific UI Are Removed (Priority: P2)

All UI elements that were designed for anonymous/guest users are removed. This
includes: the sign-up prompt bottom sheet, the sign-up banner in Settings, the
"Continue as Guest" option in onboarding, and any conflict/identity-linking
modals. The settings screen no longer conditionally renders based on
`isAnonymous`.

The existing `sign-up.tsx` page is renamed and repurposed as the unified
Authentication screen (`auth.tsx`).

**Why this priority**: These UI elements become dead code once anonymous auth is
removed. Cleaning them up prevents confusion and reduces maintenance burden.

**Independent Test**: Can be tested by navigating through all screens and
verifying no guest-mode UI elements appear.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they visit Settings, **Then** no sign-up
   banner is displayed — only account information and settings are shown.
2. **Given** any user on the onboarding screen, **When** the screen loads,
   **Then** no "Skip sign-up" or "Continue as Guest" option is present.
3. **Given** a signed-in user, **When** they use the app normally, **Then** no
   sign-up prompt bottom sheet ever appears.

---

### Edge Cases

- What happens if a user's network is unavailable during authentication? → The
  app should display a clear error message and allow retry.
- What happens if an OAuth sign-in fails mid-flow (e.g., user cancels the
  browser)? → The user remains on the Authentication screen with an appropriate
  error message.
- What happens on app force-close and reopen while signed in? → The session
  should persist and the user should go directly to the dashboard.
- What happens if email/password sign-up is attempted with an already-registered
  email? → The app should display a clear message indicating the email is
  already in use and suggest signing in instead.
- What happens if the user enters an incorrect password during sign-in? → The
  app should display a clear error message and allow retry.
- What happens if the user forgets their password? → The Authentication screen
  provides a "Forgot Password?" link. Tapping it prompts the user for their
  email, sends a password reset email, and shows a confirmation message. The
  user clicks the link in the email to set a new password.
- What happens if the user has not verified their email yet? → The app should
  display a clear message asking them to check their inbox and verify their
  email. A "Resend verification email" option should be available.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST NOT create anonymous Supabase sessions under any
  circumstances (remove `signInAnonymously()` usage).
- **FR-002**: System MUST require authentication before granting access to any
  financial tracking feature.
- **FR-003**: The unified Authentication screen MUST be the initial entry point
  for all unauthenticated users, supporting: Google (OAuth) and email/password.
  Facebook and Apple OAuth are deferred to a separate issue.
- **FR-004**: System MUST remove all identity-linking logic
  (`linkIdentityWithProvider`, `initiateOAuthLink`, identity conflict
  resolution) since there are no anonymous users to upgrade.
- **FR-005**: OAuth flow MUST use `signInWithOAuth` directly (not
  `linkIdentity`) for user authentication.
- **FR-006**: System MUST support email/password authentication (both
  registration and sign-in) as a new capability.
- **FR-007**: Log Out MUST fully clear the session without creating a new
  anonymous session as a fallback.
- **FR-008**: System MUST remove the `isAnonymous` flag from `AuthContext` and
  all dependent conditional logic.
- **FR-009**: System MUST remove all sign-up prompt UI (bottom sheet, Settings
  banner, usage-based triggers, dismissal tracking).
- **FR-010**: System MUST remove the `resolveUser` function and its
  anonymous-specific verification logic from `AuthContext`.
- **FR-011**: App routing MUST redirect to the Authentication screen when no
  valid authenticated session exists.
- **FR-012**: Onboarding MUST NOT offer a "Skip" or "Continue as Guest" option.
  It runs after authentication, not before.
- **FR-013**: System MUST preserve all existing non-anonymous auth functionality
  (session persistence, token refresh, secure storage).
- **FR-014**: The existing sign-up page MUST be renamed/refactored into a
  unified Authentication screen that handles both sign-up and sign-in flows.
- **FR-015**: Email/password registration MUST require email verification before
  granting access to the app. Users must click a verification link sent to their
  email before they can use any features.
- **FR-016**: The Authentication screen MUST include a "Forgot Password?" flow
  that sends a password reset email and allows the user to set a new password.

### Key Entities

- **User Session**: Represents an authenticated user's session. Always linked to
  a real account (never anonymous). Contains JWT, refresh token, user profile.
- **Auth State**: The global authentication state exposed by AuthContext.
  Simplified to: `authenticated` (has valid session) or `unauthenticated` (no
  session / expired session). No longer has an `anonymous` intermediate state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: No anonymous Supabase sessions are created anywhere in the app —
  verifiable by searching the entire codebase for `signInAnonymously` calls.
- **SC-002**: A new user cannot access any financial feature (dashboard,
  transactions, accounts) without first completing authentication — verifiable
  by fresh install testing.
- **SC-003**: All unit tests pass after the refactoring, with updated mocks that
  no longer reference anonymous sessions or identity linking.
- **SC-004**: The Settings screen no longer conditionally renders any sign-up
  banner — verifiable by visual inspection for authenticated users.
- **SC-005**: Logout results in a fully cleared session (no anonymous fallback)
  — verifiable by checking that reopening the app after logout shows the
  Authentication screen, not the dashboard.
- **SC-006**: The entire sign-up prompt system (bottom sheet, usage tracking,
  dismissal logic, storage keys) is removed — verifiable by confirming the
  deletion of related files and references.
- **SC-007**: Users can successfully authenticate using email/password (both
  registration and sign-in) — verifiable by manual testing.
- **SC-008**: Email/password sign-up requires email verification before app
  access — verifiable by registering with a test email and confirming the
  verification flow works end-to-end.

## Assumptions

- Email/password authentication is a **new capability** that needs to be built.
- Only Google OAuth is in scope for this feature. Facebook and Apple OAuth will
  be addressed in separate issue(s) — they require additional platform-specific
  configuration (FB Developer Console, Apple Developer certificates).
- The onboarding flow runs after authentication, not before.
- Existing anonymous user data is not a migration concern at this stage (the app
  is in development phase, so orphaned anonymous data is acceptable).
- RLS policies on the database currently require `authenticated` role and
  **should be verified** during the planning phase to ensure they meet the new
  requirements without modification.

## Authentication Screen Design

The unified Authentication screen (replacing the current `sign-up.tsx`) should:

- Display a welcoming title/header (e.g., "Welcome to Astik")
- Show Google OAuth button (Facebook and Apple deferred — may show as
  disabled/coming-soon or be hidden until implemented)
- Include an email/password section with a toggle/tab between "Sign Up" and
  "Sign In" modes
- Include a "Forgot Password?" link visible in Sign In mode
- Handle all authentication flows from a single screen
- Follow the existing app design language (Egyptian-inspired palette, dark mode
  support, premium aesthetic)
