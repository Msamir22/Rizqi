# Feature Specification: Skip Onboarding for Returning Users

**Feature Branch**: `024-skip-returning-onboarding` **Created**: 2026-04-17
**Status**: Draft **Input**: User description: "Skip the onboarding flow
(Language → Slides → Currency → Cash-account confirmation) for returning users
who already have an existing profile on Supabase." (see linked issue #226 for
full context)

## Clarifications

### Session 2026-04-18

- Q: When the post-sign-in profile fetch fails and the retry screen is shown,
  what actions must be available to the user? → A: Two actions — **Retry** and
  **Sign out**. Sign-out clears the session and returns the user to the sign-in
  screen. Design dependency: the retry screen needs mockups before
  implementation.
- Q: How long does the loading state persist before the profile fetch is
  declared failed and the retry screen appears? → A: **20 seconds**.
- Q: How does this feature compose with the app's offline-first (WatermelonDB)
  architecture — do onboarding writes require connectivity? → A: **No**. Sign-in
  triggers a **blocking pull-sync** that populates the local database from the
  server; the routing gate then reads the profile from the local database. After
  that point, each onboarding step writes to the local database first and
  background push-sync catches the server up whenever connectivity is available.
  Offline during onboarding is not a concern because WatermelonDB is the
  authoritative local source of truth. Planning must verify that the current
  sign-in code actually performs a blocking pull-sync before routing and, if
  not, make it so.
- Q: Should the routing gate emit observability signals to help diagnose future
  regressions? → A: **Yes, log the routing decision once per gate evaluation**:
  the outcome (dashboard / Language / Slides / Currency / Cash-account / retry)
  and the inputs used (overall flag value and which per-step signals were null).
  Info-level, no PII.

### User Story 1 - Returning user lands on dashboard without re-onboarding (Priority: P1)

A user who previously created an account on another device, or who is
reinstalling the app on the same device, signs in and reaches the dashboard
directly. Their language, currency, and cash account — already stored with their
remote profile — are restored before any screen appears, so they never see the
onboarding flow again and never re-enter data they have already provided.

**Why this priority**: This is the core problem the feature solves. Without it,
every returning user is forced to duplicate their setup on each install/login,
which creates data inconsistency between their remote profile and fresh local
answers, and breaks the expectation that their account "remembers" them. Fixing
this unblocks reinstall and multi-device journeys in a single change.

**Independent Test**: Can be fully tested by signing in as a user whose remote
profile is already marked as fully onboarded, then confirming the dashboard is
the first screen shown, the previously chosen language and currency are in
effect, and the existing cash account is visible in the account list — no
onboarding step is rendered at any point.

**Acceptance Scenarios**:

1. **Given** a user whose remote profile has onboarding marked as completed,
   with a stored language, currency, slides-viewed flag, and at least one cash
   account, **When** the user signs in on a fresh install, **Then** the app
   shows a loading indicator until the profile has been restored locally, and
   then routes directly to the dashboard with those preferences applied and the
   existing cash account visible in the account list — no onboarding screen is
   shown.
2. **Given** a returning user who has just signed in, **When** the dashboard
   renders for the first time, **Then** the language and currency match the
   values on the remote profile, the cash account appears in the account list,
   and no prompt to choose a language, view slides, choose a currency, or create
   an account is presented.

---

### User Story 2 - New user completes the full onboarding flow (Priority: P1)

A user signing up for the very first time — with no remote profile yet, or with
a remote profile that has not been onboarded — is guided through the four-step
flow: Language → Slides → Currency → Cash-account confirmation. Language and
Currency are mandatory (the user must pick one, with no skip affordance). Slides
can be skipped or viewed; either action advances the user. The cash-account
confirmation step is an informational message confirming the app auto-created
the user's default cash account in the chosen currency.

**Why this priority**: Equally critical with US1: a silent regression here would
mean new users land on an empty dashboard without a language, currency, or cash
account, which breaks the rest of the app. The change must tighten the gate, not
loosen it.

**Independent Test**: Can be fully tested by signing up a brand-new user (no
prior profile) and confirming the Language picker is the first screen, followed
by the slides, followed by the Currency picker (with no skip button), followed
by the cash-account confirmation message. Only after dismissing the confirmation
does the dashboard appear, with a cash account already present in the account
list.

**Acceptance Scenarios**:

1. **Given** a user with no remote profile (first-time sign-up), **When**
   sign-up completes, **Then** the Language picker is shown first, followed by
   the onboarding slides, followed by the Currency picker, followed by the
   cash-account confirmation message, before the dashboard is reachable.
2. **Given** a new user on the Currency step, **When** the screen is inspected,
   **Then** no skip affordance is present — currency selection is mandatory and
   the Continue action requires a selection.
3. **Given** a user who selects a currency, **When** the Continue action is
   invoked, **Then** a cash account is created in that currency and the
   confirmation message reflects it.
4. **Given** a user whose remote profile exists but has no language set and
   onboarding not completed, **When** they sign in, **Then** the full onboarding
   flow starts from the Language step.

---

### User Story 3 - User resumes partial onboarding at the step they left off (Priority: P2)

A user who started onboarding previously but quit before finishing signs in
again and is taken straight to the first step they have not yet completed. Steps
they have already completed are not re-shown, and the values they already
provided (language, currency, cash account) are preserved.

**Why this priority**: This is a meaningful quality-of-life improvement and
prevents data-inconsistency regressions (re-picking a currency that differs from
the stored one), but it affects fewer users than US1/US2 — only those whose
previous session was interrupted. It is a P2 refinement on top of the core
binary skip/show behavior.

**Independent Test**: Can be fully tested by seeding a profile at each possible
partial-progress state and confirming the app routes to the correct next step on
sign-in, without re-showing completed steps.

**Acceptance Scenarios**:

1. **Given** a returning user whose remote profile has a language set, slides
   not yet viewed, and the overall onboarding flag false, **When** they sign in,
   **Then** the first screen they see is the onboarding slides — not the
   Language picker.
2. **Given** a returning user whose remote profile has a language set, slides
   viewed, no currency set, and the overall onboarding flag false, **When** they
   sign in, **Then** the first screen they see is the Currency picker, with the
   saved language already active.
3. **Given** a returning user whose remote profile has language, slides-viewed,
   and currency set, a cash account present, but the overall onboarding flag
   still false (quit on the confirmation step), **When** they sign in, **Then**
   the first screen they see is the cash-account confirmation message.
4. **Given** a user who completes the resumed step(s), **When** the final
   confirmation message is dismissed, **Then** the overall onboarding flag is
   set to true on the remote profile and they are routed to the dashboard. The
   next sign-in on any device goes straight to the dashboard (US1).

---

### User Story 4 - Slow or failed initial sync does not fall through to onboarding (Priority: P2)

When a returning user signs in on a slow or flaky network, they see a loading
state while the remote profile is fetched. If the fetch fails, they are offered
a retry rather than silently dropped into the onboarding flow, which would cause
them to overwrite their real preferences with fresh answers.

**Why this priority**: Protects against the worst failure mode of US1 — silently
showing onboarding to a user who is already onboarded because the server
couldn't be reached in time. Without this guard, the feature would introduce a
new class of data-loss bug on bad networks. P2 rather than P1 because it is a
correctness safeguard on top of the primary routing change.

**Independent Test**: Can be fully tested by simulating a slow or unavailable
profile fetch after sign-in for a known returning user, and confirming a loading
screen persists (with a retry option on failure) rather than the onboarding flow
appearing.

**Acceptance Scenarios**:

1. **Given** a returning user signing in on a slow network, **When** the profile
   fetch takes several seconds, **Then** a loading indicator is shown during the
   wait and neither the onboarding flow nor an empty-data flash of the dashboard
   appears.
2. **Given** a returning user signing in while the profile fetch fails (network
   error or server error), **When** the failure is detected, **Then** the user
   sees an error state with two actions — Retry and Sign out — rather than being
   routed into the onboarding flow. Tapping Sign out clears the session and
   returns the user to the sign-in screen.
3. **Given** the user taps retry after a failed fetch, **When** the fetch
   succeeds, **Then** routing resumes as if the first fetch had succeeded
   (returning user → dashboard; new or partially-onboarded user → the
   appropriate onboarding step per US2/US3).

---

### Edge Cases

- **Reinstall with cached session**: A user reinstalls the app, but the stored
  sign-in session is still valid on device. After app launch, they are treated
  as a returning user — the profile is re-fetched and they land on the
  dashboard, not the onboarding flow.
- **Cleared app data, server profile intact**: Local data is wiped but the
  remote profile still exists. On next sign-in the local state is seeded from
  the server before routing, so the user does not see onboarding.
- **Remote profile exists but is empty** (no language, slides not viewed, no
  currency, no cash account, flag false): Treated as a new user — full
  onboarding is shown starting at Language (US2).
- **User signs out and signs back in as a different returning user on the same
  device**: The new user's profile is fetched and applied; the previous user's
  cached preferences are not carried over into the routing decision.
- **User deletes their account and signs up again**: Treated as a brand-new user
  — full onboarding is shown.
- **Pre-existing device where language was only in local-device storage
  (pre-release legacy)**: Local-only language preference is ignored by the
  routing gate; the server profile is the sole source of truth. (Acceptable
  because the app is not yet in production and no real users are affected.)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST determine post-sign-in routing by reading the
  profile state from the local database **after a blocking pull-sync from the
  server has completed on sign-in**. The pull-sync ensures the local database
  reflects the authoritative server state — so reinstalls and new devices do not
  re-trigger onboarding for already-onboarded users — but the routing gate
  itself reads local, not remote. The gate MUST NOT rely on a pre-existing
  local-only flag that was never reconciled against the server.
- **FR-002**: The system MUST show a loading state between sign-in and the first
  post-sign-in screen while the remote profile is being fetched and the local
  state is being seeded.
- **FR-003**: If the remote profile indicates onboarding is completed, the
  system MUST route the user directly to the dashboard without rendering any
  onboarding step.
- **FR-004**: If the remote profile does not exist or indicates onboarding is
  not completed, the system MUST start the onboarding flow at the first step the
  user has not yet completed (Language, Slides, Currency, or Cash-account
  confirmation), preserving any values already saved on the remote profile.
- **FR-005**: On successful sign-in of a returning user, the system MUST restore
  the user's language, currency, and existing cash account(s) from the remote
  profile to the local state before the dashboard renders, so that the first
  render of the dashboard already reflects the user's stored preferences and
  account list.
- **FR-006**: If the remote profile fetch has not succeeded within **20
  seconds** of sign-in, or if it fails with a network/server error before that
  window expires, the system MUST declare the fetch failed and present an error
  state with two actions — **Retry** and **Sign out** — and MUST NOT fall
  through to the onboarding flow. Sign-out clears the authenticated session and
  returns the user to the sign-in screen so they can try a different account or
  come back later.
- **FR-007**: The system MUST persist the user's chosen language to the remote
  profile (not only to on-device storage), so that language survives reinstall,
  device switch, and sign-in from a new device without requiring the Language
  step to be re-shown.
- **FR-008**: The system MUST persist the slide-viewing state (viewed or
  skipped) to the remote profile, so that the Slides step is not re-shown to
  returning users.
- **FR-009**: The Currency step MUST be mandatory — the user MUST select a
  currency to continue and the step MUST NOT expose any skip affordance.
- **FR-010**: Upon currency selection, the system MUST auto-create the user's
  default cash account in the chosen currency, so that the cash-account
  confirmation step can present it to the user.
- **FR-011**: The system MUST set the overall onboarding-completed flag on the
  remote profile to true only when the cash-account confirmation step is
  dismissed (i.e., when the user has reached the end of the flow), so that the
  flag is a reliable single source of truth for the routing gate.
- **FR-012**: The routing gate described above MUST run on every
  post-authentication entry into the app — fresh install sign-in and subsequent
  launches with a cached session — so the decision is never cached from a prior
  routing outcome.
- **FR-013**: The feature MUST NOT change the behavior of the dashboard's
  setup-guide card (a separate post-onboarding guidance mechanism); this spec
  concerns only the pre-dashboard onboarding flow.
- **FR-014**: The system MUST emit one structured info-level log per
  routing-gate evaluation, capturing the chosen outcome (dashboard, Language,
  Slides, Currency, Cash-account confirmation, or retry) and the inputs used to
  reach it (the overall onboarding-completed flag's value and which per-step
  signals were null at evaluation time). The log MUST NOT include any personally
  identifiable information (no user email, no user id in plaintext if a hashed
  identifier is already conventional, no preference values).

### Key Entities

- **User profile (remote)**: The authoritative record of a user's onboarding
  progress and preferences. Fields relevant to this feature:
  - Preferred language (populated at Language step; part of the resume/skip
    decision).
  - Slides-viewed marker (set true when the Slides step is viewed or skipped).
  - Preferred currency (populated at Currency step; mandatory, non-nullable
    after the step).
  - Overall onboarding-completed flag (set true at the end of the flow; the
    single gate read by the router).
- **Cash account**: The default account auto-created during the Currency step
  using the user's chosen currency. Its presence on a returning user's profile
  is restored locally on sign-in but not used by the routing gate — routing
  reads the overall flag.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of returning users whose remote profile indicates onboarding
  is completed reach the dashboard after sign-in without any onboarding screen
  being rendered.
- **SC-002**: 100% of brand-new users (no remote profile, or remote profile with
  the onboarding-completed flag false and no language set) see the full
  four-step onboarding flow starting at Language, matching the new flow defined
  in US2.
- **SC-003**: On a representative median-speed network, a returning user reaches
  the dashboard within 3 seconds of successful sign-in; the loading state is
  shown for the duration of the fetch and never replaced by the onboarding flow.
- **SC-004**: 0 reported incidents of a returning user's language, currency, or
  cash account being overwritten by fresh onboarding answers after this change
  ships.
- **SC-005**: A user who quit onboarding mid-flow and signs in again resumes at
  their next incomplete step with 0 already-completed steps re-shown.
- **SC-006**: Support tickets and bug reports referencing "asked to pick
  language/currency again after reinstall" or "lost my cash account after
  signing in again" trend to zero within one release cycle of the change going
  live.

## Assumptions

- The remote user profile carries a dedicated overall onboarding-completed flag
  (this is the single source of truth for the routing gate). Per-step signals
  (language set, slides-viewed, currency set) are used only to determine the
  resume point when the overall flag is false.
- The onboarding flow's four steps (Language, Slides, Currency, Cash-account
  confirmation) remain in the order defined above for the scope of this spec.
- The dashboard's first-launch setup-guide card is out of scope and retains its
  current behavior.
- Retrying a failed profile fetch is a user-initiated action (tap retry) rather
  than automatic, to avoid masking persistent failures.
- The app is pre-production, so no migration is required for users whose
  onboarding status lives only in local-device storage today; those users
  (developers/testers) will pass through the new flow once.
- Per the project constitution, the app is offline-first with WatermelonDB as
  the local source of truth. This feature composes with that model as follows:
  (a) sign-in performs a blocking pull-sync from Supabase into the local
  database so the routing gate has accurate state on reinstalls / new devices;
  (b) after the pull-sync completes, the routing gate and onboarding step
  resume-logic read from the local database only; (c) each onboarding step
  writes to the local database first and relies on the existing background
  push-sync to propagate to Supabase. No onboarding step requires live
  connectivity once the user is signed in.

## Dependencies

- Availability and reliability of the remote profile fetch after sign-in — this
  feature's routing decision is gated on it.
- Schema support on the remote profile for the four signals the router reads:
  preferred language, slides-viewed, preferred currency, and the overall
  onboarding-completed flag. Any missing columns are expected to be added as
  part of the planning/implementation phase.
- **Investigation required in planning**: verify that the existing sign-in code
  path performs a blocking pull-sync of the `profiles` row (and related rows —
  language, currency, account) into WatermelonDB before any routing decision. If
  it is non-blocking or missing, the planner must introduce the blocking
  behavior. This investigation also resolves whether the "profile fetch" invoked
  by FR-002 / FR-006 is a dedicated row-level fetch or the regular WatermelonDB
  pull-sync triggered on sign-in.
