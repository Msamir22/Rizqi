# Feature Specification: Optional Sign-Up Prompt to Secure Anonymous User Data

**Feature Branch**: `014-signup-prompt`  
**Created**: 2026-03-05  
**Status**: Draft  
**GitHub Issue**: #80  
**Input**: User description: "Implement an optional sign-up prompt that
encourages anonymous users to create an account, protecting their data from
loss. Three surfaces: post-onboarding full-screen, re-engagement bottom sheet,
and Settings banner. Auth providers: Google + Facebook on Android, Google +
Facebook + Apple on iOS."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Post-Onboarding Sign-Up Prompt (Priority: P1)

After completing the full onboarding flow (carousel, currency picker, and wallet
creation), a new anonymous user is shown a full-screen sign-up page encouraging
them to create an account. The screen communicates data protection benefits,
shows trust badges (Encrypted, Backed Up, Private), and offers social login
buttons (Google + Facebook on Android; Google + Facebook + Apple on iOS). The
user can skip and continue using the app anonymously.

**Why this priority**: This is the first touchpoint where the user has the most
momentum and openness to setup tasks. Converting here means the user's data is
protected from the very start.

**Independent Test**: Can be fully tested by completing onboarding as an
anonymous user and verifying the sign-up screen appears with correct content.
Tapping any social login button initiates the corresponding OAuth flow; tapping
"I'll do it later" navigates to the main tabs.

**Acceptance Scenarios**:

1. **Given** a new anonymous user completing onboarding, **When** they finish
   the wallet-creation step (final onboarding step), **Then** a full-screen
   sign-up page is displayed with trust messaging and platform-appropriate
   social login options (Google + Facebook on Android; Google + Facebook + Apple
   on iOS).
2. **Given** the sign-up page is shown, **When** the user taps any social login
   button (Google, Facebook, or Apple), **Then** the corresponding OAuth flow
   initiates and, upon success, the anonymous account is converted to a
   permanent linked account with no data loss.
3. **Given** the sign-up page is shown, **When** the user taps "I'll do it
   later", **Then** the sign-up page is dismissed and the user navigates to the
   main tabs.
4. **Given** an authenticated (non-anonymous) user, **When** they complete
   onboarding, **Then** the sign-up page is NOT shown.

---

### User Story 2 - Re-Engagement Urgency Prompt (Priority: P2)

After an anonymous user reaches 50+ transactions OR has been using the app for
10+ days (whichever comes first), a bottom sheet with urgency messaging appears
on the next cold app launch showing the user how much data they risk losing. The
sheet displays real-time stats (transaction count, accounts count, total amount
tracked) and provides sign-up options.

**Why this priority**: By this point the user has invested significant effort.
Showing them concrete numbers about what they'd lose creates a strong conversion
incentive.

**Independent Test**: Can be tested by creating 50+ transactions as an anonymous
user (or advancing the install date by 10+ days) and verifying the bottom sheet
appears on the next cold app launch.

**Acceptance Scenarios**:

1. **Given** an anonymous user with fewer than 50 transactions and fewer than 10
   days since first use, **When** they cold-launch the app, **Then** the urgency
   prompt is NOT shown.
2. **Given** an anonymous user with 50+ transactions, **When** they cold-launch
   the app, **Then** the urgency bottom sheet appears showing their real data
   stats and sign-up options.
3. **Given** an anonymous user who has used the app for 10+ days (regardless of
   transaction count), **When** they cold-launch the app, **Then** the urgency
   bottom sheet appears.
4. **Given** the urgency prompt is shown, **When** the user taps "Skip for now",
   **Then** the prompt is dismissed and will re-appear after the next 50
   transactions OR 10 days (whichever comes first).
5. **Given** the urgency prompt is shown, **When** the user taps "Never show
   this again", **Then** the prompt is permanently suppressed and never shown
   again.
6. **Given** an authenticated (non-anonymous) user, **When** the trigger
   conditions are met, **Then** the urgency prompt is NOT shown.

---

### User Story 3 - Settings Sign-Up Access (Priority: P2)

Anonymous users see a prominent emerald green gradient banner at the top of the
Settings screen that provides persistent access to the sign-up flow.
Authenticated users see their account information instead.

**Why this priority**: Users who dismissed the prompts need a persistent,
self-service way to sign up when they're ready. Settings is the natural place
for account management.

**Independent Test**: Can be tested by opening Settings as an anonymous user and
verifying the banner appears. Tapping the button should navigate to the sign-up
screen.

**Acceptance Scenarios**:

1. **Given** an anonymous user, **When** they open the Settings screen, **Then**
   a green gradient banner is shown at the top with "Secure Your Account"
   messaging and a "Sign Up" button.
2. **Given** an anonymous user views the Settings banner, **When** they tap
   "Sign Up", **Then** they navigate to the sign-up screen.
3. **Given** a previously anonymous user who just signed up, **When** they open
   Settings, **Then** the banner is replaced by their account information
   (email/Google profile) shown in the Profile row.

---

### User Story 4 - Social Account Conversion (Priority: P1)

When an anonymous user initiates sign-up via any supported provider (Google,
Facebook, or Apple on iOS), the system links the chosen identity to the existing
anonymous Supabase user. All existing data (transactions, accounts, transfers,
assets, etc.) remains intact because the `user_id` is preserved. No data
migration is required.

**Why this priority**: This is the core technical capability that enables all
three UI surfaces. Without working account conversion, no prompt surface
delivers value.

**Independent Test**: Can be tested by signing up with each provider (Google,
Facebook, Apple) as an anonymous user and verifying that all previously recorded
data is still accessible and the user is now authenticated.

**Acceptance Scenarios**:

1. **Given** an anonymous user with existing data, **When** they complete
   sign-in via any supported provider (Google, Facebook, or Apple), **Then**
   their user account is converted from anonymous to a provider-linked account.
2. **Given** a successful conversion, **When** the user checks their data,
   **Then** all transactions, accounts, transfers, and assets are intact (same
   `user_id`).
3. **Given** a conversion attempt fails (network error, OAuth cancellation),
   **When** the error occurs, **Then** the user sees a clear error message and
   remains anonymous with all data intact.
4. **Given** a social account that is already linked to another Supabase user,
   **When** the anonymous user tries to link it, **Then** the system shows a
   clear error explaining the account is already in use.

---

### Edge Cases

- What happens when the user has no internet during Google sign-in? → Show a
  clear error toast; the user remains anonymous, no data is affected.
- What happens if the user force-closes the app during OAuth redirect? → The
  conversion is never completed; the user remains anonymous on next launch.
- What happens if the same user signs up on two devices? → Each device has its
  own anonymous session. Only the device that completes sign-up gets linked. The
  other device's anonymous data remains separate.
- What happens if the user's transaction count is exactly 50? → The prompt
  triggers at ≥ 50.
- What happens if the "first use" date is not recorded and the user has < 50
  transactions? → The time-based trigger falls back to the app install date; if
  unavailable, only the transaction-count trigger applies.
- What happens when the user dismisses the post-onboarding screen and then opens
  the app again? → The post-onboarding screen only appears once, immediately
  after onboarding. It does not re-appear.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST detect whether the current user is anonymous via
  Supabase's `user.is_anonymous` flag.
- **FR-002**: System MUST display a full-screen sign-up page immediately after
  the onboarding wallet-creation step for anonymous users only (shown once).
- **FR-003**: System MUST display an urgency bottom sheet when an anonymous user
  reaches ≥ 50 transactions OR ≥ 10 days since first app use, whichever comes
  first.
- **FR-004**: System MUST show real user statistics (transaction count, account
  count, total amount tracked) in the urgency bottom sheet.
- **FR-005**: System MUST allow the user to dismiss the urgency prompt via "Skip
  for now" with a cooldown of 50 additional transactions OR 10 additional days
  before re-triggering.
- **FR-006**: System MUST allow the user to permanently suppress the urgency
  prompt via "Never show this again".
- **FR-007**: System MUST persist the dismissal preference (cooldown or
  permanent) across app restarts using local storage.
- **FR-008**: System MUST display a green gradient sign-up banner at the top of
  the Settings screen for anonymous users.
- **FR-009**: System MUST hide the sign-up banner and show account information
  for authenticated (non-anonymous) users.
- **FR-010**: System MUST provide Google Sign-In and Facebook Sign-In on both
  platforms, and additionally Apple Sign-In on iOS devices.
- **FR-011**: System MUST convert the anonymous account to a provider-linked
  account using Supabase's `linkIdentity()` method, preserving the existing
  `user_id`.
- **FR-016**: System MUST conditionally display Apple Sign-In only on iOS
  devices. Android users see Google + Facebook only.
- **FR-012**: System MUST NOT require any data migration after account
  conversion — all existing data must remain intact and accessible.
- **FR-013**: System MUST handle conversion errors gracefully, showing clear
  error messages and ensuring no data is lost.
- **FR-014**: System MUST show a success toast/snackbar (e.g., "Account secured
  ✓") and auto-navigate the user to the main app tabs upon successful conversion
  from any surface.
- **FR-015**: System MUST NOT show any sign-up prompts to already-authenticated
  users.

### Key Entities _(include if feature involves data)_

- **User/Profile**: Existing entity. The `profiles` table stores `user_id`,
  `onboarding_completed`, and related user preferences. No schema changes needed
  — anonymous detection comes from Supabase auth, not from the local DB.
- **Prompt Dismissal State**: New local-only state (AsyncStorage). Tracks:
  timestamp of last dismissal, transaction count at dismissal, and a permanent
  suppression flag. Not synced to Supabase — this is device-local behavior.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Anonymous users are shown the post-onboarding sign-up screen 100%
  of the time after completing onboarding.
- **SC-002**: The urgency prompt correctly triggers when the 50-transaction or
  10-day threshold is met.
- **SC-003**: The "Never show this again" option permanently suppresses the
  urgency prompt with zero false re-appearances.
- **SC-004**: All existing user data (transactions, accounts, transfers, assets)
  is preserved with zero data loss after account conversion.
- **SC-005**: The OAuth flow for each supported provider (Google, Facebook,
  Apple) completes successfully within 30 seconds.
- **SC-006**: Users who dismiss the urgency prompt do not see it again until the
  next cooldown cycle (50 additional transactions OR 10 additional days).
- **SC-007**: The Settings sign-up banner is visible to all anonymous users and
  correctly hidden for authenticated users.
- **SC-008**: Error scenarios (network failure, cancelled OAuth, duplicate
  account) display clear, user-friendly error messages without data corruption.
- **SC-009**: Android users see exactly 2 sign-in options (Google, Facebook) and
  iOS users see exactly 3 (Google, Facebook, Apple).

## Clarifications

### Session 2026-03-05

- Q: Should the post-onboarding sign-up screen appear after the currency picker
  step or after the wallet-creation step? → A: After wallet creation (onboarding
  fully complete). The currency picker and wallet creation are related steps;
  the sign-up screen appears only after the entire onboarding is done.
- Q: When does the urgency prompt check and display — on every foreground event
  or cold launch only? → A: Cold app launch only (once per session). Avoids
  interrupting the user mid-task.
- Q: What visual feedback does the user see after successful account conversion?
  → A: Success toast/snackbar (e.g., "Account secured ✓") + auto-navigate to
  main tabs. No full-screen success page.

## Assumptions

- V1 includes Google + Facebook on all platforms, plus Apple on iOS.
  Email/password is deferred to future iterations.
- The existing Supabase anonymous auth setup correctly supports `linkIdentity()`
  for all three providers (Google, Facebook, Apple).
- `expo-auth-session` and `expo-web-browser` are suitable packages for the OAuth
  flows in the Expo managed workflow.
- OAuth credentials (client IDs, redirect URIs) for Google, Facebook, and Apple
  will be configured manually in their respective developer consoles and in the
  Supabase dashboard as separate setup steps.
- Apple Sign-In requires an Apple Developer account ($99/year) and app-specific
  configuration.
- Facebook Sign-In requires a Meta Developer app with "Facebook Login" product
  enabled.
- The urgency prompt's transaction count and day count are reset per-dismissal,
  not globally. Each cooldown cycle is independent.
- The post-onboarding sign-up screen appears only once per user lifecycle —
  after onboarding. It is not re-shown on subsequent app launches.
